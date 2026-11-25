/**
 * Slack Block Kit layouts. Pure: data in, JSON out, so every message is unit-tested.
 * Buttons only *ask* for a decision. The decision itself runs as the person who
 * clicked, through `set_content_status`, so the database decides who may approve.
 */
import { getChannel, type ChannelId } from "@/lib/channels";

export const ACTION = {
  approve: "bvs_approve",
  sendBack: "bvs_send_back",
  kill: "bvs_kill",
  open: "bvs_open",
} as const;
export const REASON_CALLBACK = "bvs_reason";
export const REASON_BLOCK = "reason";
export const REASON_INPUT = "reason_input";

export type Decision = "approved" | "changes_requested" | "killed";

export const DECISION_LABEL: Record<Decision, string> = {
  approved: "Approved",
  changes_requested: "Sent back",
  killed: "Killed",
};

const DECISION_EMOJI: Record<Decision, string> = {
  approved: ":white_check_mark:",
  changes_requested: ":leftwards_arrow_with_hook:",
  killed: ":no_entry:",
};

export interface SlackFlag {
  label: string;
  message: string;
  span?: string | null;
}

export interface SlackItemSummary {
  id: string;
  channel: ChannelId;
  text: string;
  score: number | null;
  verdict: string | null;
  summary: string | null;
  flags: SlackFlag[];
  status: string;
}

type Block = Record<string, unknown>;

/** Slack mrkdwn needs &, < and > escaped; everything user-written goes through this. */
export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function clip(s: string, max: number): string {
  const t = String(s ?? "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function itemUrl(appUrl: string, itemId: string): string {
  return `${appUrl.replace(/\/$/, "")}/library/${encodeURIComponent(itemId)}`;
}

function quote(text: string): string {
  return clip(text, 1200)
    .split("\n")
    .map((l) => `>${esc(l)}`)
    .join("\n");
}

function verdictLine(item: SlackItemSummary): string {
  const score = item.score === null ? "not scored" : `${item.score}/100`;
  // Show the saved verdict when there is one; otherwise count what was flagged rather than
  // inventing a recommendation the review didn't make.
  const n = item.flags.length;
  const verdict = item.verdict
    ? `*${esc(item.verdict)}*`
    : n
      ? `*${n} issue${n === 1 ? "" : "s"} flagged*`
      : "*Nothing flagged*";
  return `${verdict} · brand score ${score}`;
}

function flagLines(flags: SlackFlag[]): string {
  if (!flags.length) return "_Nothing flagged._";
  const shown = flags.slice(0, 5).map((f) => {
    const where = f.span ? ` (“${esc(clip(f.span, 80))}”)` : "";
    return `• *${esc(f.label)}*${where}: ${esc(clip(f.message, 200))}`;
  });
  if (flags.length > 5) shown.push(`_…and ${flags.length - 5} more in the studio._`);
  return shown.join("\n");
}

/** The message posted after `/brand check`: recommendation, flags and decision buttons. */
export function reviewMessage(
  item: SlackItemSummary,
  opts: { appUrl: string; submittedBy: string },
): { text: string; blocks: Block[] } {
  const channelLabel = getChannel(item.channel).label;
  const blocks: Block[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${esc(channelLabel)}* checked for <@${opts.submittedBy}> · now *In review*\n${verdictLine(item)}`,
      },
    },
    { type: "section", text: { type: "mrkdwn", text: quote(item.text) } },
  ];
  if (item.summary) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: esc(clip(item.summary, 300)) }],
    });
  }
  blocks.push({ type: "section", text: { type: "mrkdwn", text: flagLines(item.flags) } });
  blocks.push({
    type: "actions",
    block_id: `decide:${item.id}`,
    elements: [
      {
        type: "button",
        action_id: ACTION.approve,
        text: { type: "plain_text", text: "Approve" },
        style: "primary",
        value: item.id,
      },
      {
        type: "button",
        action_id: ACTION.sendBack,
        text: { type: "plain_text", text: "Send back" },
        value: item.id,
      },
      {
        type: "button",
        action_id: ACTION.kill,
        text: { type: "plain_text", text: "Kill" },
        style: "danger",
        value: item.id,
      },
      {
        type: "button",
        action_id: ACTION.open,
        text: { type: "plain_text", text: "Open in studio" },
        url: itemUrl(opts.appUrl, item.id),
      },
    ],
  });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "The check recommends. Only someone with the Approver role can decide.",
      },
    ],
  });
  const headline = item.verdict ?? `${item.flags.length} issues flagged`;
  return { text: `${channelLabel} checked: ${headline}`, blocks };
}

/** Replaces the review message once a person has decided: no buttons left to press twice. */
export function decidedMessage(
  item: SlackItemSummary,
  opts: { appUrl: string; decision: Decision; decidedBy: string; reason?: string | null },
): { text: string; blocks: Block[] } {
  const label = DECISION_LABEL[opts.decision];
  const reason = opts.reason ? `\n*Reason:* ${esc(clip(opts.reason, 500))}` : "";
  return {
    text: `${label} by a teammate`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${DECISION_EMOJI[opts.decision]} *${label}* by <@${opts.decidedBy}>${reason}`,
        },
      },
      { type: "section", text: { type: "mrkdwn", text: quote(item.text) } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${esc(getChannel(item.channel).label)} · ${verdictLine(item)} · <${itemUrl(opts.appUrl, item.id)}|Open in studio>`,
          },
        ],
      },
    ],
  };
}

export interface ReasonMetadata {
  itemId: string;
  decision: Exclude<Decision, "approved">;
  channelId: string | null;
  messageTs: string | null;
}

/** Send back and Kill both need a reason (the database refuses them without one). */
export function reasonModal(meta: ReasonMetadata): Block {
  const kill = meta.decision === "killed";
  return {
    type: "modal",
    callback_id: REASON_CALLBACK,
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: kill ? "Kill this piece" : "Send back" },
    submit: { type: "plain_text", text: kill ? "Kill it" : "Send back" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      ...(kill
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Killed pieces are frozen for good: they can't be edited, approved or published.",
              },
            },
          ]
        : []),
      {
        type: "input",
        block_id: REASON_BLOCK,
        label: { type: "plain_text", text: kill ? "Why can't this run?" : "What needs to change?" },
        element: {
          type: "plain_text_input",
          action_id: REASON_INPUT,
          multiline: true,
          max_length: 2000,
        },
      },
    ],
  };
}

export function parseReasonMetadata(raw: string): ReasonMetadata | null {
  try {
    const m = JSON.parse(raw) as Partial<ReasonMetadata>;
    if (
      typeof m.itemId !== "string" ||
      (m.decision !== "changes_requested" && m.decision !== "killed")
    )
      return null;
    return {
      itemId: m.itemId,
      decision: m.decision,
      channelId: typeof m.channelId === "string" ? m.channelId : null,
      messageTs: typeof m.messageTs === "string" ? m.messageTs : null,
    };
  } catch {
    return null;
  }
}

export function queueMessage(
  items: { id: string; channel: ChannelId; hook: string; score: number | null }[],
  appUrl: string,
): { text: string; blocks: Block[] } {
  if (!items.length) {
    return {
      text: "Nothing is waiting for review.",
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "Nothing is waiting for review. :tada:" },
        },
      ],
    };
  }
  const lines = items.map((i) => {
    const score = i.score === null ? "–" : `${i.score}`;
    return `• <${itemUrl(appUrl, i.id)}|${esc(clip(i.hook || "Untitled", 80))}> · ${esc(getChannel(i.channel).label)} · ${score}/100`;
  });
  return {
    text: `${items.length} waiting for review`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Waiting for review (${items.length})*\n${lines.join("\n")}`,
        },
      },
    ],
  };
}

export const HELP_TEXT = [
  "*Brand Voice Studio in Slack*",
  "`/brand check <post>`: check a LinkedIn post against the brand kit and send it for review",
  "`/brand check instagram: <post>`: same, for another channel (linkedin, instagram, carousel, tiktok, x, facebook, blog, newsletter, case_study, email)",
  "`/brand queue`: what's waiting for review",
  "`/brand link`: connect your Slack account to your studio account (one time)",
  "`/brand unlink`: disconnect it",
  "",
  "The check recommends; a person with the Approver role decides.",
].join("\n");
