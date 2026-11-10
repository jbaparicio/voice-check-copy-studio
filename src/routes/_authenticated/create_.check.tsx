import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateModeSwitch } from "@/components/create-mode-switch";
import { CHANNELS, type ChannelId } from "@/lib/channels";
import { checkExistingPost } from "@/lib/content.functions";
import { useActiveBrand, useBrandKit } from "@/lib/use-brand";

export const Route = createFileRoute("/_authenticated/create_/check")({
  head: () => ({
    meta: [
      { title: "Check an existing post — Brand Voice Studio" },
      {
        name: "description",
        content: "Paste a post someone already wrote and check it against your Brand Kit before review.",
      },
      { property: "og:title", content: "Check an existing post — Brand Voice Studio" },
      {
        property: "og:description",
        content: "Paste a post someone already wrote and check it against your Brand Kit before review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckPostPage,
});

const NONE = "none";

function CheckPostPage() {
  const { brand } = useActiveBrand();
  const kit = useBrandKit(brand?.id);
  const check = useServerFn(checkExistingPost);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<ChannelId>("linkedin");
  const [personaId, setPersonaId] = useState(NONE);
  const [goalId, setGoalId] = useState(NONE);
  const [busy, setBusy] = useState(false);

  if (!kit.data) {
    return (
      <div className="space-y-4 p-10">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full max-w-xl" />
      </div>
    );
  }
  const k = kit.data;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return void toast.error("Please paste the post you want checked.");
    setBusy(true);
    try {
      const { itemId } = await check({
        data: {
          brandId: k.brand.id,
          channel,
          text,
          personaId: personaId === NONE ? null : personaId,
          goalId: goalId === NONE ? null : goalId,
        },
      });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Checked and sent for review.");
      navigate({ to: "/library/$itemId", params: { itemId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-6 md:px-8">
      <CreateModeSwitch mode="check" />
      <h1 className="text-3xl font-medium">Check an existing post</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a post someone already wrote. We check it against the{" "}
        <strong className="font-semibold text-foreground">{k.brand.name}</strong> Brand Kit exactly
        as written, nothing gets rewritten, and it goes straight to review.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pasted-post">The post</Label>
          <Textarea
            id="pasted-post"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full post here, including hashtags."
            required
          />
          <p className="text-xs text-muted-foreground">
            {text.length.toLocaleString("en-GB")} characters
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="check-channel">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as ChannelId)}>
              <SelectTrigger id="check-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-persona">Audience (optional)</Label>
            <Select value={personaId} onValueChange={setPersonaId}>
              <SelectTrigger id="check-persona">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No specific audience</SelectItem>
                {k.personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-goal">Goal (optional)</Label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger id="check-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No specific goal</SelectItem>
                {k.goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" disabled={busy}>
          <ShieldCheck className="size-4" aria-hidden="true" />
          {busy ? "Checking… this takes a few seconds" : "Check and send for review"}
        </Button>
      </form>
    </div>
  );
}
