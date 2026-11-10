import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    // First login: send people to the friendly setup screen once.
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_done")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile && !profile.onboarding_done) throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: AppShell,
  pendingComponent: () => (
    <div
      className="grid min-h-screen place-items-center text-sm text-muted-foreground"
      role="status"
    >
      Loading your workspace…
    </div>
  ),
});
