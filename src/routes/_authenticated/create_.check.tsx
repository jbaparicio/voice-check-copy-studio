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
import { splitBatch } from "@/lib/batch";
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
  const [bulk, setBulk] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

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
    if (bulk) return void submitBulk();
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

  async function submitBulk() {
    const posts = splitBatch(text, channel);
    if (posts.length === 0) return void toast.error("Please paste at least one post.");
    setBusy(true);
    let failed = 0;
    for (let i = 0; i < posts.length; i++) {
      setProgress(`Checking post ${i + 1} of ${posts.length}…`);
      try {
        await check({
          data: {
            brandId: k.brand.id,
            channel: posts[i].channel,
            text: posts[i].text,
            personaId: personaId === NONE ? null : personaId,
            goalId: goalId === NONE ? null : goalId,
          },
        });
      } catch {
        failed++;
      }
    }
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["gate"] });
    const ok = posts.length - failed;
    if (failed) toast.error(`${failed} of ${posts.length} posts couldn't be checked. Please try those again.`);
    if (ok) toast.success(`${ok} ${ok === 1 ? "post" : "posts"} checked and waiting at the gate.`);
    navigate({ to: "/gate" });
  }

  const batchCount = bulk ? splitBatch(text, channel).length : 0;

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
        <div
          role="radiogroup"
          aria-label="How many posts"
          className="inline-flex rounded-md border border-border bg-muted/40 p-1 text-sm"
        >
          {[
            { v: false, label: "One post" },
            { v: true, label: "Check several at once" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={bulk === o.v}
              onClick={() => setBulk(o.v)}
              className={`rounded px-3 py-1.5 transition-colors ${bulk === o.v ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pasted-post">{bulk ? "The posts" : "The post"}</Label>
          {bulk && (
            <p className="text-xs text-muted-foreground">
              Put a line with only <code>---</code> between posts. A post can start with a line like{" "}
              <code>Channel: Instagram</code>; otherwise the channel below is used.
            </p>
          )}
          <Textarea
            id="pasted-post"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              bulk
                ? "First post…\n---\nChannel: Instagram\nSecond post…"
                : "Paste the full post here, including hashtags."
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            {bulk
              ? `${batchCount} ${batchCount === 1 ? "post" : "posts"} found`
              : `${text.length.toLocaleString("en-GB")} characters`}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="check-channel">{bulk ? "Channel (default)" : "Channel"}</Label>
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
          {busy
            ? (progress ?? "Checking… this takes a few seconds")
            : bulk
              ? "Check all and send to the gate"
              : "Check and send for review"}
        </Button>
      </form>
    </div>
  );
}
