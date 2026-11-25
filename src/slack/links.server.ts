// Server-only: Slack ↔ studio account links and message references.
// These tables have no client write policies, so all writes happen here with the
// service-role client, after the checks below. The new tables aren't in the generated
// `types.ts` until the migration runs and types are regenerated, hence the untyped client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyLinkToken } from "./link-token";

export interface SlackLink {
  slack_team_id: string;
  slack_user_id: string;
  user_id: string;
  brand_id: string;
}

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function findLink(teamId: string, slackUserId: string): Promise<SlackLink | null> {
  const db = await admin();
  const { data, error } = await db
    .from("slack_links")
    .select("slack_team_id, slack_user_id, user_id, brand_id")
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  if (error) throw new Error("We couldn't look up your studio account.");
  return (data as SlackLink | null) ?? null;
}

export async function deleteLink(teamId: string, slackUserId: string): Promise<boolean> {
  const db = await admin();
  const { data, error } = await db
    .from("slack_links")
    .delete()
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId)
    .select("user_id");
  if (error) throw new Error("We couldn't disconnect your account.");
  return Array.isArray(data) && data.length > 0;
}

export async function saveMessageRef(ref: {
  itemId: string;
  teamId: string;
  channelId: string;
  ts: string;
}) {
  const db = await admin();
  const { error } = await db.from("slack_messages").upsert({
    content_item_id: ref.itemId,
    slack_team_id: ref.teamId,
    channel_id: ref.channelId,
    message_ts: ref.ts,
  });
  if (error) console.error("[slack] couldn't save message reference", error.message);
}

export async function getMessageRef(
  itemId: string,
): Promise<{ channel_id: string; message_ts: string } | null> {
  const db = await admin();
  const { data } = await db
    .from("slack_messages")
    .select("channel_id, message_ts")
    .eq("content_item_id", itemId)
    .maybeSingle();
  return (data as { channel_id: string; message_ts: string } | null) ?? null;
}

/**
 * Bind the signed-in studio member to the Slack identity in a link token.
 * `client` is the caller's own RLS-scoped client; `userId` comes from their session,
 * never from the request body.
 */
export async function linkSlackAccountCore(opts: {
  client: SupabaseClient;
  userId: string;
  isAnonymous: boolean;
  token: string;
  brandId: string;
}): Promise<{ ok: true }> {
  const secret = process.env["SLACK_LINK_SECRET"];
  if (!secret) throw new Error("Slack isn't set up for this studio yet.");
  if (opts.isAnonymous) throw new Error("Demo guests can't connect Slack. Sign up first.");

  const result = await verifyLinkToken({ token: opts.token, secret });
  if (!result.ok) {
    throw new Error(
      result.reason === "expired"
        ? "This link has expired. Run `/brand link` in Slack for a new one."
        : "This link isn't valid. Run `/brand link` in Slack for a new one.",
    );
  }

  const { data: canAccess, error: accessError } = await opts.client.rpc("can_access_brand", {
    _brand: opts.brandId,
  });
  if (accessError || !canAccess) throw new Error("You don't have access to that brand.");

  const db = await admin();
  // Single use: the nonce's primary key makes a second use fail.
  const { error: nonceError } = await db
    .from("slack_link_nonces")
    .insert({ nonce: result.payload.n });
  if (nonceError) {
    throw new Error(
      nonceError.code === "23505"
        ? "This link was already used. Run `/brand link` in Slack for a new one."
        : "We couldn't connect Slack just now. Please try again.",
    );
  }

  const { error } = await db.from("slack_links").upsert(
    {
      slack_team_id: result.payload.t,
      slack_user_id: result.payload.u,
      user_id: opts.userId,
      brand_id: opts.brandId,
    },
    { onConflict: "slack_team_id,slack_user_id" },
  );
  if (error) throw new Error("We couldn't connect Slack just now. Please try again.");
  return { ok: true };
}
