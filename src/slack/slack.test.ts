import { describe, expect, it } from "vitest";
import {
  hmacSha256Hex,
  timingSafeEqualStr,
  verifySlackSignature,
  MAX_SKEW_SECONDS,
} from "./verify";
import { createLinkToken, verifyLinkToken, LINK_TOKEN_TTL_SECONDS } from "./link-token";
import { parseCommand, resolveChannel } from "./commands";
import {
  ACTION,
  decidedMessage,
  esc,
  parseReasonMetadata,
  queueMessage,
  reasonModal,
  REASON_BLOCK,
  REASON_CALLBACK,
  REASON_INPUT,
  reviewMessage,
  type SlackItemSummary,
} from "./blocks";
import { readInteraction } from "./interactions";
import { toSlackSummary } from "./summary";
import { AGENT_TOOLS, isAgentTool } from "./agent-tools";

const SECRET = "test-signing-secret";
const NOW = 1_800_000_000;
const ITEM = "3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

async function sign(body: string, ts: number, secret = SECRET) {
  return `v0=${await hmacSha256Hex(secret, `v0:${ts}:${body}`)}`;
}

describe("Slack request signatures", () => {
  const body = "token=x&team_id=T1&user_id=U1&text=check+hello";

  it("accepts a valid, fresh signature", async () => {
    const r = await verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(NOW),
      signature: await sign(body, NOW),
      rawBody: body,
      nowSeconds: NOW + 10,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects a stale timestamp even with a correct signature (replay)", async () => {
    const r = await verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(NOW),
      signature: await sign(body, NOW),
      rawBody: body,
      nowSeconds: NOW + MAX_SKEW_SECONDS + 1,
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects a tampered body", async () => {
    const r = await verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(NOW),
      signature: await sign(body, NOW),
      rawBody: body.replace("hello", "approve"),
      nowSeconds: NOW,
    });
    expect(r).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects the wrong secret and missing headers", async () => {
    const wrong = await verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(NOW),
      signature: await sign(body, NOW, "other"),
      rawBody: body,
      nowSeconds: NOW,
    });
    expect(wrong.ok).toBe(false);
    const missing = await verifySlackSignature({
      signingSecret: SECRET,
      timestamp: null,
      signature: null,
      rawBody: body,
      nowSeconds: NOW,
    });
    expect(missing).toEqual({ ok: false, reason: "missing" });
    const noSecret = await verifySlackSignature({
      signingSecret: "",
      timestamp: String(NOW),
      signature: await sign(body, NOW),
      rawBody: body,
      nowSeconds: NOW,
    });
    expect(noSecret).toEqual({ ok: false, reason: "missing" });
  });

  it("compares strings of different lengths safely", () => {
    expect(timingSafeEqualStr("abc", "abc")).toBe(true);
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
    expect(timingSafeEqualStr("", "a")).toBe(false);
  });
});

describe("account-link tokens", () => {
  const secret = "link-secret";

  it("round-trips team, user and nonce", async () => {
    const token = await createLinkToken({
      teamId: "T1",
      userId: "U1",
      secret,
      nowSeconds: NOW,
      nonce: "n1",
    });
    const r = await verifyLinkToken({ token, secret, nowSeconds: NOW + 60 });
    expect(r).toEqual({
      ok: true,
      payload: { t: "T1", u: "U1", exp: NOW + LINK_TOKEN_TTL_SECONDS, n: "n1" },
    });
  });

  it("expires", async () => {
    const token = await createLinkToken({ teamId: "T1", userId: "U1", secret, nowSeconds: NOW });
    const r = await verifyLinkToken({
      token,
      secret,
      nowSeconds: NOW + LINK_TOKEN_TTL_SECONDS + 1,
    });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token whose payload was swapped for another Slack user", async () => {
    const token = await createLinkToken({ teamId: "T1", userId: "U1", secret, nowSeconds: NOW });
    const [, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ t: "T1", u: "U_ATTACKER", exp: NOW + 600, n: "x" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyLinkToken({ token: `${forged}.${sig}`, secret, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects garbage, a wrong secret and extra segments", async () => {
    const token = await createLinkToken({ teamId: "T1", userId: "U1", secret, nowSeconds: NOW });
    expect((await verifyLinkToken({ token: "nope", secret, nowSeconds: NOW })).ok).toBe(false);
    expect((await verifyLinkToken({ token, secret: "other", nowSeconds: NOW })).ok).toBe(false);
    expect((await verifyLinkToken({ token: `${token}.x`, secret, nowSeconds: NOW })).ok).toBe(
      false,
    );
  });

  it("makes a fresh nonce each time (single use is enforced in the database)", async () => {
    const a = await createLinkToken({ teamId: "T1", userId: "U1", secret, nowSeconds: NOW });
    const b = await createLinkToken({ teamId: "T1", userId: "U1", secret, nowSeconds: NOW });
    expect(a).not.toEqual(b);
  });
});

describe("/brand command parsing", () => {
  it("defaults to help", () => {
    expect(parseCommand("")).toEqual({ kind: "help" });
    expect(parseCommand("  help ")).toEqual({ kind: "help" });
  });

  it("parses link, unlink and queue", () => {
    expect(parseCommand("link").kind).toBe("link");
    expect(parseCommand("Unlink").kind).toBe("unlink");
    expect(parseCommand("queue").kind).toBe("queue");
  });

  it("checks a LinkedIn post by default and keeps line breaks", () => {
    expect(parseCommand("check We built a stage.\n\nWhat would you build?")).toEqual({
      kind: "check",
      channel: "linkedin",
      text: "We built a stage.\n\nWhat would you build?",
    });
  });

  it("reads a channel word or alias", () => {
    expect(parseCommand("check instagram: Hello there")).toMatchObject({
      channel: "instagram",
      text: "Hello there",
    });
    expect(parseCommand("check IG: Hello")).toMatchObject({ channel: "instagram", text: "Hello" });
    expect(parseCommand("check case_study: Body")).toMatchObject({ channel: "case_study" });
    expect(resolveChannel("twitter")).toBe("x");
    expect(resolveChannel("Hello")).toBeNull();
  });

  it("doesn't mistake a first word for a channel", () => {
    expect(parseCommand("check LinkedIn is changing fast")).toMatchObject({
      channel: "linkedin",
      text: "LinkedIn is changing fast",
    });
    expect(parseCommand("check Email marketing is back")).toMatchObject({
      channel: "linkedin",
      text: "Email marketing is back",
    });
    expect(parseCommand("check Big news today")).toMatchObject({
      channel: "linkedin",
      text: "Big news today",
    });
  });

  it("explains empty, unknown and oversized input", () => {
    expect(parseCommand("check").kind).toBe("error");
    expect(parseCommand("check linkedin:").kind).toBe("error");
    expect(parseCommand("approve 123").kind).toBe("error");
    expect(parseCommand(`check ${"a".repeat(20001)}`).kind).toBe("error");
  });
});

const summary: SlackItemSummary = {
  id: ITEM,
  channel: "linkedin",
  text: "We built a <stage> & a story.",
  score: 80,
  verdict: "Send back",
  summary: "Stacked opening fragments.",
  flags: [
    { label: "No dashes", message: "Replace the em dash.", span: "stage — story" },
    { label: "Numbers", message: "Needs a source.", span: null },
  ],
  status: "in_review",
};

describe("Slack message layouts", () => {
  it("escapes user text", () => {
    expect(esc("<a> & b")).toBe("&lt;a&gt; &amp; b");
    expect(
      JSON.stringify(reviewMessage(summary, { appUrl: "https://app.test", submittedBy: "U1" })),
    ).not.toContain("<stage>");
  });

  it("shows the recommendation, flags and four decision buttons", () => {
    const m = reviewMessage(summary, { appUrl: "https://app.test/", submittedBy: "U1" });
    const actions = m.blocks.find((b) => b["type"] === "actions") as {
      elements: { action_id: string; value?: string; url?: string }[];
    };
    expect(actions.elements.map((e) => e.action_id)).toEqual([
      ACTION.approve,
      ACTION.sendBack,
      ACTION.kill,
      ACTION.open,
    ]);
    expect(actions.elements[0]!.value).toBe(ITEM);
    expect(actions.elements[3]!.url).toBe(`https://app.test/library/${ITEM}`);
    expect(JSON.stringify(m.blocks)).toContain("80/100");
    expect(JSON.stringify(m.blocks)).toContain("No dashes");
    expect(m.text).toContain("Send back");
  });

  it("removes the buttons once someone has decided", () => {
    const m = decidedMessage(summary, {
      appUrl: "https://app.test",
      decision: "killed",
      decidedBy: "U2",
      reason: "NDA client",
    });
    expect(m.blocks.some((b) => b["type"] === "actions")).toBe(false);
    expect(JSON.stringify(m.blocks)).toContain("Killed");
    expect(JSON.stringify(m.blocks)).toContain("NDA client");
    expect(JSON.stringify(m.blocks)).toContain("<@U2>");
  });

  it("asks for a reason and round-trips the modal metadata", () => {
    const meta = { itemId: ITEM, decision: "killed" as const, channelId: "C1", messageTs: "1.2" };
    const view = reasonModal(meta) as { callback_id: string; private_metadata: string };
    expect(view.callback_id).toBe(REASON_CALLBACK);
    expect(parseReasonMetadata(view.private_metadata)).toEqual(meta);
    expect(parseReasonMetadata('{"itemId":"x","decision":"approved"}')).toBeNull();
    expect(parseReasonMetadata("not json")).toBeNull();
  });

  it("lists the queue, or says it's empty", () => {
    expect(queueMessage([], "https://app.test").text).toContain("Nothing");
    const q = queueMessage(
      [{ id: ITEM, channel: "x", hook: "Hello", score: null }],
      "https://app.test",
    );
    expect(q.text).toBe("1 waiting for review");
    expect(JSON.stringify(q.blocks)).toContain("X / Twitter");
  });
});

describe("Slack interactions", () => {
  const base = { team: { id: "T1" }, user: { id: "U1" } };

  it("reads Approve with the message to update", () => {
    const r = readInteraction({
      ...base,
      type: "block_actions",
      response_url: "https://hooks.slack.com/x",
      container: { channel_id: "C1", message_ts: "1.2" },
      actions: [{ action_id: ACTION.approve, value: ITEM }],
    });
    expect(r).toEqual({
      kind: "approve",
      teamId: "T1",
      slackUserId: "U1",
      itemId: ITEM,
      channelId: "C1",
      messageTs: "1.2",
      responseUrl: "https://hooks.slack.com/x",
    });
  });

  it("turns Send back and Kill into a reason request", () => {
    const r = readInteraction({
      ...base,
      type: "block_actions",
      trigger_id: "trig",
      container: { channel_id: "C1", message_ts: "1.2" },
      actions: [{ action_id: ACTION.sendBack, value: ITEM }],
    });
    expect(r).toMatchObject({
      kind: "ask_reason",
      triggerId: "trig",
      meta: { decision: "changes_requested", itemId: ITEM },
    });
  });

  it("reads a submitted reason", () => {
    const meta = { itemId: ITEM, decision: "killed", channelId: "C1", messageTs: "1.2" };
    const r = readInteraction({
      ...base,
      type: "view_submission",
      view: {
        callback_id: REASON_CALLBACK,
        private_metadata: JSON.stringify(meta),
        state: {
          values: { [REASON_BLOCK]: { [REASON_INPUT]: { value: "  Unannounced client  " } } },
        },
      },
    });
    expect(r).toMatchObject({ kind: "reason_submitted", reason: "Unannounced client", meta });
  });

  it("ignores anything it doesn't recognise", () => {
    expect(readInteraction(null).kind).toBe("ignore");
    expect(
      readInteraction({
        ...base,
        type: "block_actions",
        actions: [{ action_id: ACTION.approve, value: "not-a-uuid" }],
      }).kind,
    ).toBe("ignore");
    expect(
      readInteraction({
        ...base,
        type: "block_actions",
        actions: [{ action_id: "something_else", value: ITEM }],
      }).kind,
    ).toBe("ignore");
    expect(
      readInteraction({
        type: "block_actions",
        actions: [{ action_id: ACTION.approve, value: ITEM }],
      }).kind,
    ).toBe("ignore");
    expect(
      readInteraction({ ...base, type: "view_submission", view: { callback_id: "other" } }).kind,
    ).toBe("ignore");
  });
});

describe("stored item → Slack summary", () => {
  it("lists deterministic failures before AI flags and keeps the saved verdict", () => {
    const s = toSlackSummary({
      id: ITEM,
      channel: "linkedin",
      status: "in_review",
      brand_score: 70,
      fields: { hook: "Hook", body: "Body", cta: "CTA", hashtags: [] },
      flags: [
        { id: "dash", label: "No dashes", status: "fail", message: "Remove dashes" },
        { id: "len", label: "Length", status: "pass", message: "ok" },
      ],
      ai_review: {
        score: 75,
        summary: "Mostly fine",
        verdict: "Approve with edits",
        fingerprint: "f",
        reviewed_at: "2026-11-25",
        checks: [
          {
            id: "t",
            label: "Tone",
            status: "warn",
            message: "A bit stiff",
            category: "tone",
            span: "Hook",
            badge: null,
            suggestion: null,
          },
        ],
      },
    });
    expect(s.flags.map((f) => f.label)).toEqual(["No dashes", "Tone"]);
    expect(s.verdict).toBe("Approve with edits");
    expect(s.score).toBe(70);
    expect(s.text).toContain("Hook");
  });
});

describe("agent tool contracts", () => {
  it("never exposes a decision as an agent tool", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(names).toEqual(["check_post", "list_review_queue"]);
    for (const n of ["approve", "set_content_status", "kill", "send_back", "decide"])
      expect(isAgentTool(n)).toBe(false);
  });
});

import { resolveWaitUntil } from "./background";

describe("background work after the Slack acknowledgement", () => {
  it("uses ctx.waitUntil when the runtime passes ctx", () => {
    const seen: Promise<unknown>[] = [];
    resolveWaitUntil({}, { waitUntil: (p: Promise<unknown>) => seen.push(p) })(Promise.resolve(1));
    expect(seen).toHaveLength(1);
  });

  it("falls back to req.waitUntil (how nitro on Cloudflare calls the server entry)", () => {
    const seen: Promise<unknown>[] = [];
    const req = { waitUntil: (p: Promise<unknown>) => seen.push(p) };
    resolveWaitUntil(req, undefined)(Promise.resolve(1));
    expect(seen).toHaveLength(1);
  });

  it("falls back to req.runtime.cloudflare.context.waitUntil", () => {
    const seen: Promise<unknown>[] = [];
    const req = {
      runtime: { cloudflare: { context: { waitUntil: (p: Promise<unknown>) => seen.push(p) } } },
    };
    resolveWaitUntil(req, undefined)(Promise.resolve(1));
    expect(seen).toHaveLength(1);
  });

  it("never throws when the work fails or nothing can keep it alive", async () => {
    const run = resolveWaitUntil({}, undefined);
    expect(() => run(Promise.reject(new Error("boom")))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
