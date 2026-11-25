// Server-only. Runs one Slack action *as the linked studio member*.
//
// Why not just use the service-role client? Because the database is the source of truth
// for who may approve: `stamp_content_item` refuses a decision when `auth.uid()` is null,
// and RLS scopes every read and write to the member's workspace. A bot with the master
// key would either be refused or bypass the rules. So each action mints a short-lived
// session for the linked person (admin magic link → verify, never emailed), runs with
// that person's JWT, then revokes the session. The JWT never leaves this server.
//
// Known limit: Supabase rate-limits token verification per IP (configurable; the default
// on the Rate limits docs page is 30 per 5 minutes). Every Slack action spends one.
// See docs/slack.md for the numbers and the upgrade path.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** Same header handling as the generated clients: new-style keys are not bearer JWTs. */
function keyedFetch(key: string, bearer?: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", key);
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
    else if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    return fetch(input, { ...init, headers });
  };
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}.`);
  return v;
}

export class SlackIdentityError extends Error {}

export async function withUserClient<T>(
  userId: string,
  fn: (client: SupabaseClient<Database>, userId: string) => Promise<T>,
): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const url = env("SUPABASE_URL");
  const publishable = env("SUPABASE_PUBLISHABLE_KEY");

  const { data: found, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = found?.user?.email;
  if (userError || !email || found.user.is_anonymous) {
    throw new SlackIdentityError(
      "Your studio account can't be used from Slack. Link it again with `/brand link`.",
    );
  }

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash)
    throw new SlackIdentityError("We couldn't act as you just now. Try again in a minute.");

  const anon = createClient<Database>(url, publishable, {
    global: { fetch: keyedFetch(publishable) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  const session = verified?.session;
  if (verifyError || !session || session.user.id !== userId) {
    // 429 here means the verification rate limit was hit.
    throw new SlackIdentityError(
      verifyError?.status === 429
        ? "Lots of Slack requests at once. Please wait a minute and try again."
        : "We couldn't act as you just now. Try again in a minute.",
    );
  }

  const client = createClient<Database>(url, publishable, {
    global: { fetch: keyedFetch(publishable, session.access_token) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  try {
    return await fn(client, userId);
  } finally {
    // Revoke this session's refresh token. The access token expires on its own.
    await supabaseAdmin.auth.admin.signOut(session.access_token, "local").catch((e: unknown) => {
      console.error("[slack] couldn't revoke minted session", e);
    });
  }
}
