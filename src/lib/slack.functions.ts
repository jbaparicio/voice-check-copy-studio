import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { linkSlackAccountCore } from "@/slack/links.server";

/** Finish `/brand link`: bind the signed-in member to the Slack user in the token. */
export const linkSlackAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string; brandId: string }) => ({
    token: String(input.token ?? "").slice(0, 2000),
    brandId: String(input.brandId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    return linkSlackAccountCore({
      client: context.supabase as unknown as SupabaseClient,
      userId: context.userId,
      isAnonymous: Boolean((context.claims as { is_anonymous?: boolean }).is_anonymous),
      token: data.token,
      brandId: data.brandId,
    });
  });
