import { useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CHANNELS, defaultHashtags, type ChannelId } from "@/lib/channels";
import { normaliseSliders, PRESETS } from "@/lib/sliders";
import { generateContent } from "@/lib/content.functions";
import { useActiveBrand, useBrandKit, useSetActiveBrand } from "@/lib/use-brand";
import { cn } from "@/lib/utils";

const STARTERS = [
  "Share a behind-the-scenes moment from our latest build",
  "Celebrate a team milestone",
  "Invite brands planning a launch to get in touch",
];

function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on
          ? "border-primary bg-primary-soft text-accent-foreground"
          : "border-input bg-card hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-20 shrink-0 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** Home "idea bubble": type an idea, pick a few options, get drafts. */
export function QuickStart() {
  const { brand, brands } = useActiveBrand();
  const kit = useBrandKit(brand?.id);
  const setBrand = useSetActiveBrand();
  const generate = useServerFn(generateContent);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [idea, setIdea] = useState("");
  const [channels, setChannels] = useState<ChannelId[]>(["linkedin"]);
  const [personaId, setPersonaId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const k = kit.data;
  const open = idea.trim().length > 0;

  function toggleChannel(id: ChannelId) {
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function submit() {
    if (!idea.trim()) return void toast.error("Type your idea first.");
    if (!k) return;
    if (!channels.length) return void toast.error("Pick at least one channel.");
    setBusy(true);
    try {
      const p = PRESETS.find((x) => x.id === preset);
      const res = await generate({
        data: {
          brandId: k.brand.id,
          brief: idea,
          keyFacts: [],
          link: null,
          exampleIds: [],
          personaId: personaId && k.personas.some((x) => x.id === personaId) ? personaId : null,
          goalId: goalId && k.goals.some((x) => x.id === goalId) ? goalId : null,
          channels,
          sliders: normaliseSliders({ ...normaliseSliders(k.brand.default_sliders), ...p?.values }),
          hashtags: defaultHashtags(),
        },
      });
      for (const e of res.errors) toast.error(`${e.channel}: ${e.message}`);
      const first = res.items.find((x) => !x.variant_of);
      void qc.invalidateQueries();
      if (first) {
        toast.success(
          `Ready: ${res.items.length} draft${res.items.length > 1 ? "s" : ""}. Opening the first one.`,
        );
        navigate({ to: "/library/$itemId", params: { itemId: first.id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <section aria-labelledby="quick-h" className="mt-6">
      <h2 id="quick-h" className="sr-only">
        Start from an idea
      </h2>
      <div
        className={cn(
          "rounded-2xl border bg-card p-3 shadow-sm transition-shadow focus-within:border-primary/60 focus-within:shadow-md",
        )}
      >
        <label htmlFor="quick-idea" className="sr-only">
          What do you want to post about?
        </label>
        <div className="flex items-end gap-2">
          <Sparkles className="mt-3 ml-1 size-4 shrink-0 self-start text-primary" aria-hidden="true" />
          <textarea
            id="quick-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={onKey}
            rows={open ? 3 : 1}
            maxLength={4000}
            disabled={busy}
            placeholder="What do you want to post about? Type an idea…"
            className="min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-base outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            size="icon"
            className="mb-0.5 size-9 shrink-0 rounded-full"
            onClick={submit}
            disabled={busy || !open || !k}
            aria-label="Write drafts"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {open && k && (
          <div className="mt-3 space-y-3 border-t px-1 pt-3">
            {brands.length > 1 && (
              <Row label="Brand">
                {brands.map((b) => (
                  <Chip
                    key={b.id}
                    on={b.id === brand?.id}
                    onClick={() => b.id !== brand?.id && setBrand.mutate(b.id)}
                  >
                    {b.name}
                  </Chip>
                ))}
              </Row>
            )}
            <Row label="Channels">
              {CHANNELS.map((c) => (
                <Chip
                  key={c.id}
                  on={channels.includes(c.id)}
                  onClick={() => toggleChannel(c.id)}
                  title={c.help}
                >
                  {c.short}
                </Chip>
              ))}
            </Row>
            {k.personas.length > 0 && (
              <Row label="For">
                <Chip on={!personaId} onClick={() => setPersonaId("")}>
                  Anyone
                </Chip>
                {k.personas.map((p) => (
                  <Chip
                    key={p.id}
                    on={personaId === p.id}
                    onClick={() => setPersonaId(p.id)}
                    title={p.role}
                  >
                    {p.name}
                  </Chip>
                ))}
              </Row>
            )}
            {k.goals.length > 0 && (
              <Row label="Goal">
                <Chip on={!goalId} onClick={() => setGoalId("")}>
                  No specific goal
                </Chip>
                {k.goals.map((g) => (
                  <Chip
                    key={g.id}
                    on={goalId === g.id}
                    onClick={() => setGoalId(g.id)}
                    title={g.description}
                  >
                    {g.name}
                  </Chip>
                ))}
              </Row>
            )}
            <Row label="Feel">
              <Chip
                on={!preset}
                onClick={() => setPreset(null)}
                title={`Your brand voice: ${k.brand.voice_adjectives.join(", ")}`}
              >
                Brand voice
              </Chip>
              {PRESETS.map((p) => (
                <Chip key={p.id} on={preset === p.id} onClick={() => setPreset(p.id)} title={p.help}>
                  {p.label}
                </Chip>
              ))}
            </Row>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Link
                to="/create"
                search={{ idea }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" /> More options (facts,
                link, fine-tune tone)
              </Link>
              <Button onClick={submit} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Writing{" "}
                    {channels.length} draft{channels.length === 1 ? "" : "s"}…
                  </>
                ) : (
                  <>
                    Write {channels.length} draft{channels.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      {!open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="pt-1 text-xs text-muted-foreground">Try:</span>
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setIdea(s);
                document.getElementById("quick-idea")?.focus();
              }}
              className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
