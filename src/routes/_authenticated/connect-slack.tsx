import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkSlackAccount } from "@/lib/slack.functions";
import { useActiveBrand } from "@/lib/use-brand";

type Search = { token?: string | undefined };

export const Route = createFileRoute("/_authenticated/connect-slack")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s["token"] === "string" ? s["token"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Connect Slack · Brand Voice Studio" }] }),
  component: ConnectSlackPage,
});

function ConnectSlackPage() {
  const { token } = Route.useSearch();
  const { brand, brands, isLoading } = useActiveBrand();
  const [brandId, setBrandId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!brandId && brand) setBrandId(brand.id);
  }, [brand, brandId]);

  async function connect() {
    if (!token || !brandId) return;
    setBusy(true);
    try {
      await linkSlackAccount({ data: { token, brandId } });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't connect Slack.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Connect Slack"
        description="Check posts and decide on them from Slack. Decisions still follow your role here: only approvers can approve."
      />
      <div className="max-w-xl space-y-6 px-5 py-6 md:px-10">
        {!token ? (
          <p className="text-sm text-muted-foreground">
            This page needs a link from Slack. Run <code>/brand link</code> in Slack and open the
            button it gives you.
          </p>
        ) : done ? (
          <div className="rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden /> Connected
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Go back to Slack and try <code>/brand check</code> followed by a post.
            </p>
            <Button asChild variant="ghost" className="mt-4 px-0">
              <Link to="/dashboard">Back to the studio</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5 rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
              Posts you check from Slack are saved to the brand you pick here.
            </p>
            <div className="space-y-2">
              <Label htmlFor="slack-brand">Brand</Label>
              <Select value={brandId} onValueChange={setBrandId} disabled={isLoading}>
                <SelectTrigger id="slack-brand">
                  <SelectValue placeholder="Pick a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={connect} disabled={!brandId || busy}>
              {busy ? "Connecting…" : "Connect my Slack account"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
