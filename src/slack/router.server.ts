// Server-only: the two Slack endpoints, reached from src/server.ts before TanStack routing.
//
//   POST /api/slack/commands      `/brand …` slash command
//   POST /api/slack/interactions  button clicks and modal submissions
//
// Slack wants an answer within 3 seconds, and a brand check takes longer, so slow work runs
// in `waitUntil` after the acknowledgement. Every decision runs as the Slack user who
// clicked, mapped to their studio account, through `set_content_status`.
import { checkPastedPost } from "@/lib/content-core.server";
import { claimDemoAiAction } from "@/lib/demo-quota.server";
import {
  decidedMessage,
  esc,
  HELP_TEXT,
  queueMessage,
  reasonModal,
  REASON_BLOCK,
  reviewMessage,
  type Decision,
} from "./blocks";
import { parseCommand } from "./commands";
import { readInteraction } from "./interactions";
import { createLinkToken } from "./link-token";
import {
  deleteLink,
  findLink,
  getMessageRef,
  saveMessageRef,
  type SlackLink,
} from "./links.server";
import { SlackIdentityError, withUserClient } from "./session.server";
import { ephemeral, respond, slackApi } from "./slack-api.server";
import { toSlackSummary, type StoredItemRow } from "./summary";
import { verifySlackSignature } from "./verify";
import type { ChannelId } from "@/lib/channels";

export type WaitUntil = (p: Promise<unknown>) => void;

const ITEM_COLUMNS = "id, channel, fields, brand_score, flags, ai_review, status";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function friendly(e: unknown): string {
  if (e instanceof SlackIdentityError) return e.message;
  if (e instanceof Error && e.message && !/fetch|network|undefined/i.test(e.message))
    return e.message;
  return "Something went wrong. Please try again.";
}

function notLinked() {
  return ephemeral("Connect your studio account first: run `/brand link`.");
}

export async function handleSlackRequest(
  request: Request,
  waitUntil: WaitUntil,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const check = await verifySlackSignature({
    signingSecret: process.env["SLACK_SIGNING_SECRET"] ?? "",
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    rawBody,
  });
  if (!check.ok) return new Response("Invalid signature", { status: 401 });

  // Slack retries when we're slow. The first attempt already started the work: don't repeat it.
  if (request.headers.get("x-slack-retry-num")) return new Response("", { status: 200 });

  const form = new URLSearchParams(rawBody);
  const appUrl = url.origin;
  try {
    if (url.pathname === "/api/slack/commands") return await handleCommand(form, appUrl, waitUntil);
    if (url.pathname === "/api/slack/interactions") {
      return await handleInteraction(JSON.parse(form.get("payload") ?? "{}"), appUrl, waitUntil);
    }
  } catch (e) {
    console.error("[slack] request failed", e);
    return json(ephemeral(friendly(e)));
  }
  return new Response("Not found", { status: 404 });
}

/* ───────────── slash command ───────────── */

async function handleCommand(
  form: URLSearchParams,
  appUrl: string,
  waitUntil: WaitUntil,
): Promise<Response> {
  const teamId = form.get("team_id") ?? "";
  const slackUserId = form.get("user_id") ?? "";
  const channelId = form.get("channel_id") ?? "";
  const responseUrl = form.get("response_url");
  const cmd = parseCommand(form.get("text") ?? "");

  switch (cmd.kind) {
    case "help":
      return json(ephemeral(HELP_TEXT));
    case "error":
      return json(ephemeral(cmd.message));
    case "link": {
      const secret = process.env["SLACK_LINK_SECRET"];
      if (!secret) return json(ephemeral("Slack isn't set up for this studio yet."));
      const token = await createLinkToken({ teamId, userId: slackUserId, secret });
      const href = `${appUrl}/connect-slack?token=${encodeURIComponent(token)}`;
      return json(
        ephemeral("Connect your studio account", {
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Open this link while signed in to Brand Voice Studio. It works once and expires in 10 minutes.",
              },
              accessory: {
                type: "button",
                text: { type: "plain_text", text: "Connect account" },
                url: href,
                style: "primary",
              },
            },
          ],
        }),
      );
    }
    case "unlink": {
      const removed = await deleteLink(teamId, slackUserId);
      return json(
        ephemeral(
          removed ? "Disconnected. Run `/brand link` to connect again." : "You weren't connected.",
        ),
      );
    }
    case "queue": {
      const link = await findLink(teamId, slackUserId);
      if (!link) return json(notLinked());
      waitUntil(runQueue(link, appUrl, responseUrl));
      return json(ephemeral("Looking at the review queue…"));
    }
    case "check": {
      const link = await findLink(teamId, slackUserId);
      if (!link) return json(notLinked());
      waitUntil(
        runCheck(link, {
          channel: cmd.channel,
          text: cmd.text,
          channelId,
          slackUserId,
          teamId,
          responseUrl,
          appUrl,
        }),
      );
      return json(
        ephemeral("Checking it against the brand kit. The result will appear here in a moment…"),
      );
    }
  }
}

async function runCheck(
  link: SlackLink,
  opts: {
    channel: ChannelId;
    text: string;
    channelId: string;
    slackUserId: string;
    teamId: string;
    responseUrl: string | null;
    appUrl: string;
  },
) {
  try {
    const row = await withUserClient(link.user_id, async (client, userId) => {
      await claimDemoAiAction(client);
      const { itemId } = await checkPastedPost(client, userId, {
        brandId: link.brand_id,
        channel: opts.channel,
        text: opts.text,
        personaId: null,
        goalId: null,
      });
      const { data, error } = await client
        .from("content_items")
        .select(ITEM_COLUMNS)
        .eq("id", itemId)
        .single();
      if (error || !data)
        throw new Error("The post was checked, but we couldn't read the result back.");
      return data as unknown as StoredItemRow;
    });
    const message = reviewMessage(toSlackSummary(row), {
      appUrl: opts.appUrl,
      submittedBy: opts.slackUserId,
    });
    const posted = await slackApi("chat.postMessage", {
      channel: opts.channelId,
      ...message,
      unfurl_links: false,
    });
    if (posted.ok && posted.ts && posted.channel) {
      await saveMessageRef({
        itemId: row.id,
        teamId: opts.teamId,
        channelId: posted.channel,
        ts: posted.ts,
      });
      return;
    }
    // Bot not in this channel (or a DM): show it to the submitter instead, without buttons
    // that would have no message to update.
    const blocks = message.blocks.filter((b) => b["type"] !== "actions");
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Only you can see this: the app couldn't post to the channel (${esc(posted.error ?? "unknown")}). If it says not_in_channel, invite the app here.`,
        },
      ],
    });
    await respond(opts.responseUrl, ephemeral(message.text, { blocks }));
  } catch (e) {
    console.error("[slack] check failed", e);
    await respond(opts.responseUrl, ephemeral(`Couldn't check that post: ${friendly(e)}`));
  }
}

async function runQueue(link: SlackLink, appUrl: string, responseUrl: string | null) {
  try {
    const items = await withUserClient(link.user_id, async (client) => {
      const { data, error } = await client
        .from("content_items")
        .select("id, channel, fields, brand_score")
        .eq("brand_id", link.brand_id)
        .eq("status", "in_review")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error("We couldn't read the review queue.");
      return (data ?? []).map((r) => ({
        id: r.id,
        channel: r.channel as ChannelId,
        hook: String((r.fields as { hook?: string } | null)?.hook ?? ""),
        score: r.brand_score,
      }));
    });
    await respond(responseUrl, ephemeral("", queueMessage(items, appUrl)));
  } catch (e) {
    await respond(responseUrl, ephemeral(`Couldn't load the queue: ${friendly(e)}`));
  }
}

/* ───────────── buttons and modals ───────────── */

async function handleInteraction(
  payload: unknown,
  appUrl: string,
  waitUntil: WaitUntil,
): Promise<Response> {
  const action = readInteraction(payload);
  if (action.kind === "ignore") return new Response("", { status: 200 });

  const link = await findLink(action.teamId, action.slackUserId);

  if (action.kind === "approve") {
    if (!link) {
      waitUntil(respond(action.responseUrl, { ...notLinked(), replace_original: false }));
      return new Response("", { status: 200 });
    }
    waitUntil(
      decide(link, {
        itemId: action.itemId,
        decision: "approved",
        reason: null,
        slackUserId: action.slackUserId,
        channelId: action.channelId,
        messageTs: action.messageTs,
        appUrl,
      }),
    );
    return new Response("", { status: 200 });
  }

  if (action.kind === "ask_reason") {
    if (!link) {
      waitUntil(respond(action.responseUrl, { ...notLinked(), replace_original: false }));
      return new Response("", { status: 200 });
    }
    // trigger_id expires after about 3 seconds, so open the modal before acknowledging.
    await slackApi("views.open", { trigger_id: action.triggerId, view: reasonModal(action.meta) });
    return new Response("", { status: 200 });
  }

  // reason_submitted
  if (!action.reason) {
    return json({
      response_action: "errors",
      errors: { [REASON_BLOCK]: "Please add a short reason." },
    });
  }
  if (!link) {
    return json({
      response_action: "errors",
      errors: { [REASON_BLOCK]: "Connect your studio account first: run /brand link." },
    });
  }
  waitUntil(
    decide(link, {
      itemId: action.meta.itemId,
      decision: action.meta.decision,
      reason: action.reason,
      slackUserId: action.slackUserId,
      channelId: action.meta.channelId,
      messageTs: action.meta.messageTs,
      appUrl,
    }),
  );
  return new Response("", { status: 200 });
}

async function decide(
  link: SlackLink,
  opts: {
    itemId: string;
    decision: Decision;
    reason: string | null;
    slackUserId: string;
    channelId: string | null;
    messageTs: string | null;
    appUrl: string;
  },
) {
  try {
    const row = await withUserClient(link.user_id, async (client) => {
      // The database decides: approver role, killed-is-final and the reason rules all live in
      // set_content_status and the stamp_content_item trigger.
      // Slack buttons can be stale (decided in the studio, or by someone else a moment ago):
      // only act on pieces still waiting for review.
      const { data: current, error: readError } = await client
        .from("content_items")
        .select("status")
        .eq("id", opts.itemId)
        .maybeSingle();
      if (readError || !current) throw new Error("We couldn't find that piece.");
      if (current.status !== "in_review") {
        throw new Error(
          `This piece isn't waiting for review any more (it's ${current.status.replace("_", " ")}). Open it in the studio.`,
        );
      }
      const { error } = await client.rpc("set_content_status", {
        _item: opts.itemId,
        _status: opts.decision,
        _comment: opts.reason ?? "",
      });
      if (error) throw new Error(error.message);
      const { data } = await client
        .from("content_items")
        .select(ITEM_COLUMNS)
        .eq("id", opts.itemId)
        .single();
      return data as unknown as StoredItemRow | null;
    });
    const ref =
      opts.channelId && opts.messageTs
        ? { channel_id: opts.channelId, message_ts: opts.messageTs }
        : await getMessageRef(opts.itemId);
    if (row && ref) {
      const message = decidedMessage(toSlackSummary(row), {
        appUrl: opts.appUrl,
        decision: opts.decision,
        decidedBy: opts.slackUserId,
        reason: opts.reason,
      });
      await slackApi("chat.update", { channel: ref.channel_id, ts: ref.message_ts, ...message });
    }
  } catch (e) {
    console.error("[slack] decision failed", e);
    if (opts.channelId) {
      await slackApi("chat.postEphemeral", {
        channel: opts.channelId,
        user: opts.slackUserId,
        text: `That didn't go through: ${friendly(e)}`,
      });
    }
  }
}
