import { SLIDE_MAX, SLIDE_MIN } from "@/lib/carousel-count";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Columns2,
  Copy,
  PenLine,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { ModelGuide, ModelPicker, ModelTag } from "@/components/model-picker";
import { DEFAULT_WRITER_MODEL, getWriterModel, isWriterModel, WRITER_MODELS } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpTip } from "@/components/common";
import { CompactToneSliders } from "@/components/tone-sliders";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteDraftButton } from "@/components/delete-draft";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/review-panel";
import { CreateModeSwitch } from "@/components/create-mode-switch";
import { ErrorCard, ResultSkeleton, ResultCard } from "@/components/result-card";
import { plainCopy } from "@/lib/publish";
import { CHANNELS, defaultHashtags, getChannel, type ChannelId } from "@/lib/channels";
import {
  capEmoji,
  describeSliders,
  normaliseSliders,
  PRESETS,
  type EmojiPolicy,
  type SliderValues,
} from "@/lib/sliders";
import { kitForCheck } from "@/lib/brand-kit";
import { generateContent, type GeneratedItem } from "@/lib/content.functions";
import { useActiveBrand, useBrandKit } from "@/lib/use-brand";
import { cn } from "@/lib/utils";
import { emptyFields, type ContentFields } from "@/lib/content-types";
import { toAiReview } from "@/lib/review";

const LAST_RUN_KEY = "bvs.last-run";
interface LastRun {
  brandId: string;
  ids: string[];
  runModels: string[];
  brief: string;
  tab: string;
}

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (s: Record<string, unknown>): { idea?: string | undefined } => ({
    idea: typeof s["idea"] === "string" ? s["idea"].slice(0, 4000) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create content — Brand Voice Studio" },
      {
        name: "description",
        content:
          "Write on-brand posts, emails and articles for every channel in three simple steps.",
      },
      { property: "og:title", content: "Create content — Brand Voice Studio" },
      {
        property: "og:description",
        content:
          "Write on-brand posts, emails and articles for every channel in three simple steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatePage,
});

interface KeyFact {
  text: string;
  verified: boolean;
}

function PanelHeading({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <h2 className="flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {help && <HelpTip>{help}</HelpTip>}
    </h2>
  );
}

function CreatePage() {
  const { brand } = useActiveBrand();
  const kit = useBrandKit(brand?.id);
  const generate = useServerFn(generateContent);

  const { idea } = Route.useSearch();
  const [brief, setBrief] = useState(idea ?? "");
  const [keyFacts, setKeyFacts] = useState<KeyFact[]>([]);
  const [factDraft, setFactDraft] = useState("");
  const [link, setLink] = useState("");
  const [exampleIds, setExampleIds] = useState<string[]>([]);
  const [personaId, setPersonaId] = useState<string>("");
  const [goalId, setGoalId] = useState<string>("");
  const [channels, setChannels] = useState<ChannelId[]>(["linkedin"]);
  const [sliders, setSliders] = useState<SliderValues | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState(defaultHashtags());
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [errors, setErrors] = useState<{ channel: string; message: string }[]>([]);
  const [pending, setPending] = useState<ChannelId[]>([]);
  const [toneOpen, setToneOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingBrief, setEditingBrief] = useState(true);
  const [tab, setTab] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_WRITER_MODEL);
  const [compareModel, setCompareModel] = useState<string>(WRITER_MODELS[1]!.id);
  const [compare, setCompare] = useState(false);
  const [runModels, setRunModels] = useState<string[]>([]);

  // Remember the last writer and compare choice on this device.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MODEL_STORAGE_KEY) ?? "{}");
      if (isWriterModel(saved.model)) setModel(saved.model);
      if (isWriterModel(saved.compareModel)) setCompareModel(saved.compareModel);
      if (typeof saved.compare === "boolean") setCompare(saved.compare);
    } catch {
      /* ignore */
    }
  }, []);
  function saveModels(next: { model?: string; compareModel?: string; compare?: boolean }) {
    const merged = { model, compareModel, compare, ...next };
    if (merged.compareModel === merged.model)
      merged.compareModel = WRITER_MODELS.find((m) => m.id !== merged.model)!.id;
    setModel(merged.model);
    setCompareModel(merged.compareModel);
    setCompare(merged.compare);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }

  const defaults = useMemo(
    () => normaliseSliders(kit.data?.brand.default_sliders),
    [kit.data?.brand.default_sliders],
  );
  useEffect(() => {
    if (kit.data) {
      setSliders(normaliseSliders(kit.data.brand.default_sliders));
      setPersonaId((p) => (p && kit.data.personas.some((x) => x.id === p) ? p : ""));
      setGoalId((g) => (g && kit.data.goals.some((x) => x.id === g) ? g : ""));
      setItems([]);
      // Coming back from Review: show the last drafts again (fresh from the database).
      const brandId = kit.data.brand.id;
      let saved: LastRun | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(LAST_RUN_KEY) ?? "null");
      } catch {
        /* ignore */
      }
      if (saved && saved.brandId === brandId && saved.ids?.length && !idea) {
        const run = saved;
        void supabase
          .from("content_items")
          .select(
            "id, channel, fields, brand_score, flags, status, variant_of, created_at, ai_review, writer_model",
          )
          .in("id", run.ids)
          .then(({ data }) => {
            if (!data?.length) return;
            setItems(
              data.map((r) => ({
                ...r,
                channel: r.channel as ChannelId,
                fields: { ...emptyFields(), ...(r.fields as unknown as ContentFields) },
                ai_review: toAiReview(r.ai_review),
              })),
            );
            setRunModels(run.runModels ?? []);
            if (run.brief) setBrief(run.brief);
            setTab(run.tab ?? "");
            setEditingBrief(false);
          });
      }
    }
    // Reset only when the brand changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit.data?.brand.id]);

  // Remember the drafts on screen for this tab, so "Back" from Review brings them back.
  useEffect(() => {
    if (!kit.data) return;
    try {
      if (!items.length) return;
      const run: LastRun = {
        brandId: kit.data.brand.id,
        ids: items.map((i) => i.id),
        runModels,
        brief,
        tab,
      };
      sessionStorage.setItem(LAST_RUN_KEY, JSON.stringify(run));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, runModels, tab, kit.data?.brand.id]);

  if (!kit.data || !sliders) {
    return (
      <div className="space-y-4 p-10">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full max-w-xl" />
      </div>
    );
  }

  const k = kit.data;
  const checkKit = kitForCheck(k);
  const emojiCap = capEmoji(5, k.brand.emoji_policy as EmojiPolicy);
  const persona = k.personas.find((p) => p.id === personaId);
  const goal = k.goals.find((g) => g.id === goalId);
  const greatExamples = k.examples.filter((e) => e.label === "great");
  const busy = pending.length > 0;

  function toggleChannel(id: ChannelId) {
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function addFact(text: string, verified: boolean) {
    const t = text.trim();
    if (!t || keyFacts.some((f) => f.text === t)) return;
    setKeyFacts([...keyFacts, { text: t, verified }]);
  }

  async function onGenerate() {
    if (!brief.trim()) return void toast.error("Start with step 1: tell us what you want to say.");
    if (!channels.length) return void toast.error("Pick at least one channel in Settings.");
    const models = compare ? [model, compareModel] : [model];
    setPending(channels);
    setRunModels(models);
    setErrors([]);
    try {
      const base = {
        brandId: k.brand.id,
        brief,
        keyFacts,
        link: link || null,
        exampleIds,
        personaId: personaId || null,
        goalId: goalId || null,
        channels,
        sliders: sliders!,
        hashtags,
        slideCount: channels.includes("instagram_carousel") ? slideCount : null,
      };
      const settled = await Promise.allSettled(
        models.map((m) => generate({ data: { ...base, model: m } })),
      );
      const nextItems: GeneratedItem[] = [];
      const nextErrors: { channel: string; message: string }[] = [];
      settled.forEach((r, i) => {
        const name = getWriterModel(models[i]).name;
        const prefix = models.length > 1 ? `${name}: ` : "";
        if (r.status === "fulfilled") {
          nextItems.push(...r.value.items);
          nextErrors.push(
            ...r.value.errors.map((e) => ({ ...e, message: `${prefix}${e.message}` })),
          );
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : "Something went wrong.";
          nextErrors.push({ channel: channels[0]!, message: `${prefix}${msg}` });
        }
      });
      setItems(nextItems);
      setErrors(nextErrors);
      setTab(nextItems.find((x) => !x.variant_of)?.channel ?? "");
      if (nextItems.length) {
        setEditingBrief(false);
        toast.success(
          models.length > 1
            ? `Ready: ${nextItems.length} drafts to compare.`
            : `Ready: ${nextItems.length} draft${nextItems.length > 1 ? "s" : ""} to review.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending([]);
    }
  }

  const roots = items.filter((i) => !i.variant_of);
  const toneAdjusted = SLIDER_KEYS.some((key) => sliders[key] !== defaults[key]);
  const toneSummary = describeSliders(
    { ...sliders, emoji: Math.min(sliders.emoji, emojiCap) },
    k.brand.voice_adjectives,
  );
  const channelTabs = Array.from(new Set(roots.map((r) => r.channel)));
  const activeTab = channelTabs.includes(tab as ChannelId) ? tab : (channelTabs[0] ?? "");
  const order = (m: string | null) => {
    const i = runModels.indexOf(m ?? "");
    return i === -1 ? 99 : i;
  };
  const comparing = runModels.length > 1;
  const wide = compare || comparing;
  const writer = getWriterModel(model);

  async function keepOnly(keep: GeneratedItem) {
    const others = roots.filter((r) => r.channel === keep.channel && r.id !== keep.id);
    const ids = others.flatMap((o) => [o.id, ...items.filter((x) => x.variant_of === o.id).map((x) => x.id)]);
    if (!ids.length) return;
    const { error } = await supabase.from("content_items").delete().in("id", ids);
    if (error) return void toast.error("We couldn't remove the other draft. Please try again.");
    setItems((all) => all.filter((x) => !ids.includes(x.id)));
    toast.success(`Kept the ${getWriterModel(keep.writer_model).name} draft.`);
  }

  const settings = (p: string) => (
    <div className="space-y-6">
      <section aria-labelledby={`${p}-model-h`} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span id={`${p}-model-h`}>
            <PanelHeading help="Different writers have different strengths and costs. Pick one for this piece — you can change it any time.">
              Writer
            </PanelHeading>
          </span>
          <ModelGuide />
        </div>
        <ModelPicker
          id={`${p}-model`}
          label={compare ? "First writer" : "Write with"}
          value={model}
          onChange={(v) => saveModels({ model: v })}
          drafts={channels.length}
        />
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
          <Label htmlFor={`${p}-compare`} className="flex items-center gap-1.5 text-xs">
            <Columns2 className="size-3.5 text-primary" aria-hidden="true" />
            Compare two writers
          </Label>
          <Switch
            id={`${p}-compare`}
            checked={compare}
            onCheckedChange={(v) => saveModels({ compare: v })}
          />
        </div>
        {compare && (
          <ModelPicker
            id={`${p}-model-b`}
            label="Second writer"
            value={compareModel}
            exclude={model}
            onChange={(v) => saveModels({ compareModel: v })}
            drafts={channels.length}
          />
        )}
      </section>

      <fieldset className="space-y-2">
        <legend className="mb-2">
          <PanelHeading help="Each channel gets its own draft, written for that platform.">
            Channels
          </PanelHeading>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => {
            const on = channels.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                title={c.help}
                onClick={() => toggleChannel(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "border-primary bg-primary-soft text-accent-foreground"
                    : "border-input bg-card hover:border-primary/50",
                )}
              >
                {c.short}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3">
        <PanelHeading>Who & why</PanelHeading>
        <div className="space-y-1">
          <Label htmlFor={`${p}-persona`} className="text-xs">
            Who is it for?
          </Label>
          <Select
            value={personaId || "none"}
            onValueChange={(v) => setPersonaId(v === "none" ? "" : v)}
          >
            <SelectTrigger id={`${p}-persona`} className="h-9 bg-card">
              <SelectValue placeholder="Pick a persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Anyone (general audience)</SelectItem>
              {k.personas.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {persona?.role && <p className="text-xs text-muted-foreground">{persona.role}</p>}
          {!k.personas.length && (
            <p className="text-xs text-muted-foreground">
              No personas yet.{" "}
              <Link
                to="/brand-kit"
                search={{ tab: "personas" }}
                className="font-medium text-primary hover:underline"
              >
                Add one
              </Link>
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}-goal`} className="text-xs">
            What's the goal?
          </Label>
          <Select value={goalId || "none"} onValueChange={(v) => setGoalId(v === "none" ? "" : v)}>
            <SelectTrigger id={`${p}-goal`} className="h-9 bg-card">
              <SelectValue placeholder="Pick a goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Just raise awareness</SelectItem>
              {k.goals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {goal?.cta_type && (
            <p className="text-xs text-muted-foreground">Asks people to: {goal.cta_type}</p>
          )}
        </div>
        {greatExamples.length > 0 && (
          <div className="space-y-1.5">
            <span className="flex items-center gap-1 text-xs font-medium">
              Write it a bit like…{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
              <HelpTip>
                Pick past content to use as a style reference. If you don't, we'll pick the best
                examples for each channel.
              </HelpTip>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {greatExamples.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={exampleIds.includes(e.id)}
                  onClick={() =>
                    setExampleIds((ids) =>
                      ids.includes(e.id) ? ids.filter((x) => x !== e.id) : [...ids, e.id],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    exampleIds.includes(e.id)
                      ? "border-primary bg-primary-soft text-accent-foreground"
                      : "border-input bg-card hover:border-primary/50",
                  )}
                >
                  {e.title || getChannel(e.channel).short + " example"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <section aria-labelledby={`${p}-tone-h`} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span id={`${p}-tone-h`}>
            <PanelHeading>How it should feel</PanelHeading>
          </span>
          <Badge
            variant="secondary"
            className={cn("shrink-0", toneAdjusted && "bg-primary-soft text-accent-foreground")}
          >
            {toneAdjusted ? "Adjusted" : "Brand default"}
          </Badge>
        </div>
        <p aria-live="polite" className="truncate text-sm" title={`Sounds like: ${toneSummary}`}>
          <span className="font-medium">Sounds like:</span>{" "}
          <span className="text-muted-foreground">{toneSummary}</span>
        </p>
        <button
          type="button"
          aria-expanded={toneOpen}
          aria-controls={`${p}-tone-body`}
          onClick={() => setToneOpen((o) => !o)}
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {toneOpen ? "Done adjusting" : "Adjust for this piece"}
        </button>
        {toneOpen && (
          <div id={`${p}-tone-body`} className="space-y-3 pt-1">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tone presets">
              {PRESETS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  title={x.help}
                  aria-pressed={preset === x.id}
                  onClick={() => {
                    setPreset(x.id);
                    setSliders({ ...sliders, ...x.values });
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    preset === x.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:border-primary/50",
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <CompactToneSliders
              idPrefix={`${p}-tone`}
              value={sliders}
              defaults={defaults}
              emojiCap={emojiCap}
              onChange={(v) => {
                setPreset(null);
                setSliders(v);
              }}
            />
            {toneAdjusted && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setSliders(defaults);
                  setPreset(null);
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> Reset all to brand default
              </Button>
            )}
            {channels.some((c) => getChannel(c).hashtagRange[1] > 0) && (
              <div className="space-y-1 border-t pt-3">
                <span className="flex items-center gap-1 text-xs font-medium">
                  Hashtags per channel
                  <HelpTip>Starts at what works best on each platform.</HelpTip>
                </span>
                {channels
                  .filter((c) => getChannel(c).hashtagRange[1] > 0)
                  .map((c) => (
                    <div key={c} className="flex h-8 items-center gap-2">
                      <label
                        htmlFor={`${p}-ht-${c}`}
                        className="w-[76px] text-[11px] text-muted-foreground"
                      >
                        {getChannel(c).short}
                      </label>
                      <input
                        id={`${p}-ht-${c}`}
                        type="range"
                        min={0}
                        max={10}
                        value={hashtags[c]}
                        onChange={(e) => setHashtags({ ...hashtags, [c]: Number(e.target.value) })}
                        className="flex-1 accent-primary"
                      />
                      <span
                        className="w-5 text-right text-xs font-medium tabular-nums"
                        aria-hidden="true"
                      >
                        {hashtags[c]}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {channels.includes("instagram_carousel") && (
              <div className="space-y-1.5 border-t pt-3" role="group" aria-labelledby={`${p}-slides-label`}>
                <span id={`${p}-slides-label`} className="flex items-center gap-1 text-xs font-medium">
                  Carousel slides
                  <HelpTip>Auto picks 4 to 7. Choose a number from {SLIDE_MIN} to {SLIDE_MAX} to get exactly that many: a cover, the points, and a final call to action.</HelpTip>
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant={slideCount === null ? "default" : "outline"} onClick={() => setSlideCount(null)} aria-pressed={slideCount === null}>Auto</Button>
                  <Button type="button" size="icon" variant="outline" className="size-8" aria-label="Fewer slides" disabled={slideCount === SLIDE_MIN} onClick={() => setSlideCount((n) => Math.max(SLIDE_MIN, (n ?? 5) - 1))}>−</Button>
                  <span className="w-12 text-center text-sm font-medium tabular-nums" aria-live="polite">{slideCount ?? "4–7"}</span>
                  <Button type="button" size="icon" variant="outline" className="size-8" aria-label="More slides" disabled={slideCount === SLIDE_MAX} onClick={() => setSlideCount((n) => Math.min(SLIDE_MAX, (n ?? 5) + 1))}>+</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="xl:grid xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* Settings panel (wide screens) */}
      <aside
        aria-label="Settings"
        className="hidden border-r bg-card/40 xl:sticky xl:top-0 xl:block xl:h-screen xl:overflow-y-auto"
      >
        <div className="px-5 py-6">
          <h2 className="mb-5 font-sans text-base font-semibold">Settings</h2>
          {settings("side")}
        </div>
      </aside>

      {/* Settings drawer (narrower screens) */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="left" className="w-[340px] overflow-y-auto p-5">
          <SheetTitle className="mb-5 font-sans text-base font-semibold">Settings</SheetTitle>
          {settings("drawer")}
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen min-w-0 flex-col">
        <div
          className={cn(
            "mx-auto w-full flex-1 px-5 py-6 md:px-8",
            wide ? "max-w-[1180px]" : "max-w-[760px]",
          )}
        >
          <CreateModeSwitch mode="write" />
          <h1 className="text-3xl font-medium">Create content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Writing for <strong className="font-semibold text-foreground">{k.brand.name}</strong>.
            Each channel gets its own draft, checked against your Brand Kit.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="mt-4 xl:hidden"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" aria-hidden="true" /> Settings
            <span className="text-muted-foreground">
              · {compare ? "2 writers" : writer.name} · {channels.length} channel
              {channels.length === 1 ? "" : "s"} · Tone:{" "}
              {toneAdjusted ? "Adjusted" : "Brand default"}
            </span>
          </Button>

          {/* Step 1: What */}
          {editingBrief || !roots.length ? (
            <section aria-labelledby="what-h" className="mt-6 space-y-5">
              <h2 id="what-h" className="sr-only">
                What
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="brief">What do you want to say?</Label>
                <Textarea
                  id="brief"
                  rows={6}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="min-h-[9.5rem] [field-sizing:content]"
                  placeholder="e.g. We just finished building the Brightwater Festival main stage. Share what it was like behind the scenes and thank the crew."
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">Key facts</span>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                  <HelpTip>
                    Pick from your approved facts, or type a new one. New facts are marked
                    "unverified" and the draft will ask you to confirm them.
                  </HelpTip>
                </div>
                {keyFacts.length > 0 && (
                  <ul className="space-y-1.5">
                    {keyFacts.map((f) => (
                      <li
                        key={f.text}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">{f.text}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {f.verified ? (
                            <Badge className="bg-success-soft text-success hover:bg-success-soft">
                              Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-warning-soft text-warning hover:bg-warning-soft">
                              Unverified
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Remove ${f.text}`}
                            onClick={() => setKeyFacts(keyFacts.filter((x) => x !== f))}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addFact(factDraft, false);
                      setFactDraft("");
                    }}
                  >
                    <Input
                      aria-label="Type a new fact"
                      value={factDraft}
                      onChange={(e) => setFactDraft(e.target.value)}
                      placeholder="Type a new fact…"
                    />
                    <Button type="submit" variant="outline" size="icon" aria-label="Add fact">
                      <Plus className="size-4" />
                    </Button>
                  </form>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" disabled={!k.facts.length}>
                        Pick approved fact
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-1" align="end">
                      <ul>
                        {k.facts.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                              onClick={() => addFact(`${f.fact}: ${f.value}`, true)}
                            >
                              <span className="font-medium">{f.value}</span>{" "}
                              <span className="text-muted-foreground">— {f.fact}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="link">
                  Link <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="link"
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </section>
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">Brief:</span>{" "}
                <span className="text-muted-foreground">{brief}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setEditingBrief(true)}>
                <PenLine className="size-3.5" aria-hidden="true" /> Edit brief
              </Button>
            </div>
          )}

          {/* Drafts */}
          {(busy || roots.length > 0 || errors.length > 0) && (
            <section id="results" aria-label="Your drafts" className="mt-8 space-y-4">
              {busy &&
                pending.map((c) => (
                  <div key={c} className={cn(comparing && "grid gap-4 lg:grid-cols-2")}>
                    {runModels.map((m) => (
                      <ResultSkeleton key={m} channelId={c} />
                    ))}
                  </div>
                ))}
              {!busy &&
                errors.map((e, i) => (
                  <ErrorCard key={`${e.channel}-${i}`} channelId={e.channel} message={e.message} />
                ))}
              {!busy && roots.length > 0 && (
                <Tabs value={activeTab} onValueChange={setTab}>
                  <TabsList className="h-auto flex-wrap justify-start">
                    {channelTabs.map((c) => {
                      const drafts = roots.filter((r) => r.channel === c);
                      return (
                        <TabsTrigger key={c} value={c}>
                          {getChannel(c).short}
                          {drafts.length === 1 &&
                            drafts[0]!.brand_score !== null &&
                            ` · ${drafts[0]!.brand_score}`}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {channelTabs.map((c) => {
                    const drafts = roots
                      .filter((r) => r.channel === c)
                      .sort((a, b) => order(a.writer_model) - order(b.writer_model));
                    return (
                      <TabsContent key={c} value={c} className="mt-3">
                        {drafts.length > 1 && (
                          <p className="mb-3 text-sm text-muted-foreground">
                            Same brief, two writers. Read them side by side, then open either one
                            in review — you can switch between the two drafts there.
                          </p>
                        )}
                        <div
                          className={cn(drafts.length > 1 && "grid items-start gap-4 lg:grid-cols-2")}
                        >
                          {drafts.map((r) => r.channel === "instagram_carousel" || (r.channel === "case_study" && checkKit.noDashes && r.fields.portfolio_format === "brs") ? (
                            <div key={r.id} className="min-w-0 space-y-3">
                              <ResultCard item={r} kit={checkKit} onUpdate={(updated) => setItems((all) => all.map((x) => x.id === updated.id ? updated : x))} onVariants={(variants) => setItems((all) => [...all, ...variants])} />
                              <Button asChild variant="outline"><Link to="/library/$itemId" params={{ itemId: r.id }}>Open review <ArrowRight className="size-4" /></Link></Button>
                            </div>
                          ) : (
                            <DraftPreview
                              key={r.id}
                              item={r}
                              full={drafts.length > 1}
                              onKeep={drafts.length > 1 ? () => void keepOnly(r) : undefined}
                              onDeleted={() =>
                                setItems((all) =>
                                  all.filter((x) => x.id !== r.id && x.variant_of !== r.id),
                                )
                              }
                            />
                          ))}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </section>
          )}
        </div>

        <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur">
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-1.5 px-5 py-3 md:px-8",
              wide ? "max-w-[1180px]" : "max-w-[760px]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <Switch
                  checked={compare}
                  onCheckedChange={(v) => saveModels({ compare: v })}
                  aria-label="Compare two writers"
                />
                Compare models
              </label>
              <span className="text-muted-foreground">
                {compare
                  ? `${writer.name} vs ${getWriterModel(compareModel).name}`
                  : `Writing with ${writer.name}`}{" "}
                · ≈{" "}
                {(
                  (writer.creditsPerDraft +
                    (compare ? getWriterModel(compareModel).creditsPerDraft : 0)) *
                  Math.max(1, channels.length)
                ).toFixed(2)}{" "}
                credits
              </span>
            </div>
            <Button
              size="lg"
              className="h-12 w-full text-base"
              onClick={onGenerate}
              disabled={busy}
            >
              <Sparkles className="size-5" />
              {busy
                ? "Writing…"
                : compare
                  ? "Compare models and generate"
                  : `Generate ${channels.length > 1 ? `${channels.length} drafts` : "draft"}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Nothing is ever published automatically. You review everything first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const MODEL_STORAGE_KEY = "bvs.writer-model";

const SLIDER_KEYS = [
  "formality",
  "playfulness",
  "boldness",
  "emotion",
  "length",
  "cta",
  "emoji",
] as const;

function scoreTone(score: number) {
  return score >= 85
    ? "bg-success-soft text-success"
    : score >= 65
      ? "bg-warning-soft text-warning"
      : "bg-destructive-soft text-destructive";
}

function DraftPreview({
  item,
  onDeleted,
  onKeep,
  full = false,
}: {
  item: GeneratedItem;
  onDeleted: () => void;
  onKeep?: (() => void) | undefined;
  /** Show the whole draft (used when comparing writers side by side). */
  full?: boolean;
}) {
  const [expanded, setExpanded] = useState(full);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const f = item.fields as ContentFields;
  const long = f.body.split("\n").length > 10 || f.body.length > 700;
  const heading = f.h1 || f.subject_line;
  const flagged = Array.isArray(item.flags)
    ? (item.flags as { status?: string }[]).filter((c) => c?.status && c.status !== "pass").length
    : 0;
  return (
    <article className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <span className="text-sm font-semibold">{getChannel(item.channel).label}</span>
        <ModelTag modelId={item.writer_model} />
        <StatusBadge status={item.status} />
        {item.brand_score !== null && (
          <span
            className={cn(
              "ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
              scoreTone(item.brand_score),
            )}
          >
            Brand score {item.brand_score}
          </span>
        )}
      </div>
      <div className="px-5 py-4">
        {heading && <p className="mb-2 font-semibold">{heading}</p>}
        <p
          className={cn(
            "whitespace-pre-line text-sm leading-relaxed",
            !expanded && long && "line-clamp-[10]",
          )}
        >
          {f.body}
        </p>
        {long && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((o) => !o)}
            className="mt-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? "Show less" : "Read the full draft"}
          </button>
        )}
        {f.cta && !f.body.trim().endsWith(f.cta.trim()) && <p className="mt-3 text-sm font-medium">{f.cta}</p>}
        {f.hashtags.length > 0 && (
          <p className="mt-3 text-sm text-primary">{f.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
        {flagged > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {flagged} thing{flagged === 1 ? "" : "s"} to check in the review.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
        <Button asChild size="sm">
          <Link to="/library/$itemId" params={{ itemId: item.id }}>
            Open review <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(plainCopy(f));
            toast.success("Copied as plain text.");
          }}
        >
          <Copy className="size-3.5" aria-hidden="true" /> Copy text
        </Button>
        {onKeep && (
          <Button size="sm" variant="outline" onClick={() => setConfirmKeep(true)}>
            <Check className="size-3.5" aria-hidden="true" /> Keep only this one
          </Button>
        )}
        <AlertDialog open={confirmKeep} onOpenChange={setConfirmKeep}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Keep only the {getWriterModel(item.writer_model).name} draft?</AlertDialogTitle>
              <AlertDialogDescription>
                The other writer's draft will be deleted and you won't be able to switch back to it.
                If you're not sure yet, open both in review — you can switch between them there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not yet</AlertDialogCancel>
              <AlertDialogAction onClick={() => onKeep?.()}>Delete the other draft</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <DeleteDraftButton
          itemId={item.id}
          status={item.status}
          className="ml-auto text-muted-foreground hover:text-destructive"
          onDeleted={onDeleted}
        />
      </div>
    </article>
  );
}
