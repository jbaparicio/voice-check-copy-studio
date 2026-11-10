import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Starts a private guest demo: a throwaway account with the sample brand and sample content. */
export function TryDemoButton({
  children = "Try the demo",
  ...props
}: ButtonProps & { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const { data: existing } = await supabase.auth.getUser();
    if (!existing.user) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setBusy(false);
        toast.error("The demo couldn't start. Please try again.");
        return;
      }
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <Button type="button" onClick={start} disabled={busy} {...props}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {busy ? "Setting up your demo…" : children}
    </Button>
  );
}

export function useIsGuest() {
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setGuest(!!data.user?.is_anonymous));
  }, []);
  return guest;
}

/** Shown at the top of every signed-in page while someone is exploring as a guest. */
export function DemoBanner() {
  const guest = useIsGuest();
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!guest) return null;

  async function leave() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signup" }, replace: true });
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary-soft px-4 py-2 text-sm text-accent-foreground"
    >
      <span className="flex items-center gap-2">
        <Eye className="size-4" aria-hidden="true" />
        You're trying a demo with sample data. Nothing is posted anywhere, and your changes stay private.
      </span>
      <Button size="sm" variant="outline" className="h-8" onClick={leave}>
        Create your own account
      </Button>
    </div>
  );
}
