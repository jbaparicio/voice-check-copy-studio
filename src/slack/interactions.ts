/**
 * Turns a raw Slack interaction payload into one of the few things we act on. Pure.
 * Anything unexpected becomes `ignore`, so a malformed payload can't trigger a decision.
 */
import {
  ACTION,
  parseReasonMetadata,
  REASON_BLOCK,
  REASON_CALLBACK,
  REASON_INPUT,
  type Decision,
  type ReasonMetadata,
} from "./blocks";

export type Interaction =
  | {
      kind: "approve";
      teamId: string;
      slackUserId: string;
      itemId: string;
      channelId: string | null;
      messageTs: string | null;
      responseUrl: string | null;
    }
  | {
      kind: "ask_reason";
      teamId: string;
      slackUserId: string;
      triggerId: string;
      meta: ReasonMetadata;
      responseUrl: string | null;
    }
  | {
      kind: "reason_submitted";
      teamId: string;
      slackUserId: string;
      meta: ReasonMetadata;
      reason: string;
    }
  | { kind: "ignore" };

interface RawPayload {
  type?: string;
  team?: { id?: string } | null;
  user?: { id?: string; team_id?: string };
  trigger_id?: string;
  response_url?: string;
  container?: { channel_id?: string; message_ts?: string };
  channel?: { id?: string };
  message?: { ts?: string };
  actions?: { action_id?: string; value?: string }[];
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: { values?: Record<string, Record<string, { value?: string | null }>> };
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readInteraction(raw: unknown): Interaction {
  const p = (raw ?? {}) as RawPayload;
  const teamId = p.team?.id ?? p.user?.team_id ?? "";
  const slackUserId = p.user?.id ?? "";
  if (!teamId || !slackUserId) return { kind: "ignore" };

  if (p.type === "block_actions") {
    const action = p.actions?.[0];
    const itemId = action?.value ?? "";
    if (!action?.action_id || !UUID.test(itemId)) return { kind: "ignore" };
    const channelId = p.container?.channel_id ?? p.channel?.id ?? null;
    const messageTs = p.container?.message_ts ?? p.message?.ts ?? null;
    const responseUrl = p.response_url ?? null;
    if (action.action_id === ACTION.approve) {
      return { kind: "approve", teamId, slackUserId, itemId, channelId, messageTs, responseUrl };
    }
    const decision: Exclude<Decision, "approved"> | null =
      action.action_id === ACTION.sendBack
        ? "changes_requested"
        : action.action_id === ACTION.kill
          ? "killed"
          : null;
    if (decision && p.trigger_id) {
      return {
        kind: "ask_reason",
        teamId,
        slackUserId,
        triggerId: p.trigger_id,
        meta: { itemId, decision, channelId, messageTs },
        responseUrl,
      };
    }
    return { kind: "ignore" };
  }

  if (p.type === "view_submission" && p.view?.callback_id === REASON_CALLBACK) {
    const meta = parseReasonMetadata(p.view.private_metadata ?? "");
    if (!meta || !UUID.test(meta.itemId)) return { kind: "ignore" };
    const reason = p.view.state?.values?.[REASON_BLOCK]?.[REASON_INPUT]?.value ?? "";
    return { kind: "reason_submitted", teamId, slackUserId, meta, reason: reason.trim() };
  }

  return { kind: "ignore" };
}
