import type { SupabaseClient } from "@supabase/supabase-js";

/** Guests get 1 AI action each, and all guests share 5 per day. Signed-in members are unlimited. */
export async function claimDemoAiAction(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase.rpc("claim_demo_ai_action");
  if (error) throw new Error("We couldn't start that just now. Please try again.");
  if (data === "guest_used")
    throw new Error("Demo limit reached: each guest can try one AI action. You can still browse, edit, approve, send back and kill.");
  if (data === "daily_full")
    throw new Error("Today's demo spots are used up. Please come back tomorrow.");
  if (data !== "ok") throw new Error("Please sign in again.");
}
