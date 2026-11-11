import { plainCopy } from "@/lib/publish";
import { CarouselSlides } from "@/components/carousel-slides";
import { PortfolioPreview } from "@/components/portfolio-preview";
import { HighlightedText } from "@/components/highlighted-text";
import type { FlagSpan } from "@/lib/highlight";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/review-panel";
import {
  AlertTriangle,
  Check,
  Copy,
  Hash,
  Loader2,
  Music,
  RefreshCw,
  Wand2,
  X,
  Columns2,
  CircleHelp,
  ShieldAlert,
  Sparkles,
  Send,
  ClipboardCheck,
  Highlighter,
  PenLine,
  Eye,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip, HelpTip } from "@/components/common";
import { getChannel, lengthStatus } from "@/lib/channels";
import {
  countedText,
  type BrandCheckItem,
  type BrandKitForCheck,
  type ContentFields,
} from "@/lib/content-types";
import { runBrandCheck } from "@/lib/brand-check";
import {
  combinedScore,
  fingerprint,
  isReviewFresh,
  placeholderBadges,
  BADGE_LABEL,
  type ReviewBadge,
  type ReviewItem,
} from "@/lib/review";
import { allText } from "@/lib/content-types";
import {
  fixFlag,
  generateVariants,
  reviewItem,
  reviseItem,
  rewriteSelection,
  suggestHashtags,
  type GeneratedItem,
} from "@/lib/content.functions";
import { cn } from "@/lib/utils";
import { SELECTION_PRESETS } from "@/lib/selection";
import { getWriterModel, WRITER_MODELS, COST_WORDS, DEFAULT_WRITER_MODEL } from "@/lib/models";
import { CostDots, ModelTag } from "@/components/model-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ADJUST = [
  { id: "shorter", label: "Shorter" },
  { id: "longer", label: "Longer" },
  { id: "emotional", label: "More emotional" },
  { id: "factual", label: "More factual" },
  { id: "hook", label: "Punchier hook" },
  { id: "angle", label: "Different angle" },
] as const;

export { plainCopy };

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const tone =
    score >= 85
      ? "bg-success-soft text-success"
      : score >= 65
        ? "bg-warning-soft text-warning"
        : "bg-destructive-soft text-destructive";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
        tone,
      )}
    >
      Brand score {score}
      <span className="sr-only">out of 100</span>
    </span>
  );
}

export function FlagBadge({ badge, count }: { badge: ReviewBadge; count?: number }) {
  const Icon = badge === "needs_confirmation" ? CircleHelp : ShieldAlert;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badge === "needs_confirmation"
          ? "border-warning/40 bg-warning-soft text-warning"
          : "border-primary/40 bg-primary-soft text-accent-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {count !== undefined && count > 0 ? `${count} ` : ""}
      {BADGE_LABEL[badge]}
    </span>
  );
}

function CheckIcon({ status }: { status: BrandCheckItem["status"] }) {
  if (status === "pass") return <Check className="size-4 text-success" aria-label="Passed" />;
  if (status === "warn")
    return <AlertTriangle className="size-4 text-warning" aria-label="Worth a look" />;
  return <X className="size-4 text-destructive" aria-label="Needs fixing" />;
}

function LengthBar({ channelId, count }: { channelId: string; count: number }) {
  const ch = getChannel(channelId);
  const status = lengthStatus(ch, count);
  const ceiling = Math.max(ch.range[1] * 1.3, count);
  const pct = Math.min(100, (count / ceiling) * 100);
  const start = (ch.range[0] / ceiling) * 100;
  const end = (ch.range[1] / ceiling) * 100;
  const color =
    status === "good" ? "bg-success" : status === "close" ? "bg-warning" : "bg-destructive";
  const words =
    status === "good"
      ? "Good length"
      : status === "close"
        ? "Nearly there"
        : count > ch.range[1]
          ? "Too long"
          : "Too short";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium">
          {count.toLocaleString("en-GB")} characters · {words}
        </span>
        <span className="text-muted-foreground">
          Best: {ch.range[0].toLocaleString("en-GB")}–{ch.range[1].toLocaleString("en-GB")}
        </span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={ch.range[1]}
        aria-valuenow={count}
        aria-label={`Length: ${words}`}
      >
        <div
          className="absolute inset-y-0 bg-success/15"
          style={{ left: `${start}%`, width: `${end - start}%` }}
        />
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function HookPreview({ body, length }: { body: string; length: number }) {
  const [open, setOpen] = useState(false);
  const shown = body.slice(0, length);
  const rest = body.slice(length, length + 120);
  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Eye className="size-4 text-primary" aria-hidden="true" />
        Preview in the feed
        <span className="font-normal text-muted-foreground">
          — what people see before "see more"
        </span>
        <ChevronDown
          className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t px-4 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Most feeds cut posts off after the first {length} characters or so. The highlighted part
            has to earn the click.
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            <mark className="rounded bg-highlight px-0.5 text-foreground">{shown}</mark>
            {rest && <span className="text-muted-foreground">{rest}… </span>}
            {rest && <span className="font-medium text-muted-foreground">see more</span>}
          </p>
        </div>
      )}
    </div>
  );
}

export function ResultCard({
  item,
  kit,
  onUpdate,
  onVariants,
  isVariant = false,
  showWorkflow = true,
}: {
  item: GeneratedItem;
  kit: BrandKitForCheck;
  onUpdate: (item: GeneratedItem) => void;
  onVariants?: (items: GeneratedItem[]) => void;
  isVariant?: boolean;
  showWorkflow?: boolean;
}) {
  const ch = getChannel(item.channel);
  const [fields, setFields] = useState<ContentFields>(item.fields);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const revise = useServerFn(reviseItem);
  const variants = useServerFn(generateVariants);
  const suggest = useServerFn(suggestHashtags);
  const review = useServerFn(reviewItem);
  const fixFlagFn = useServerFn(fixFlag);
  const rewriteSel = useServerFn(rewriteSelection);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null,
  );
  const [selNote, setSelNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [rewriteNote, setRewriteNote] = useState("");
  const [rewriteModel, setRewriteModel] = useState<string>(
    item.writer_model ?? DEFAULT_WRITER_MODEL,
  );
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const autoReviewed = useRef<string | null>(null);

  const itemRef = useRef(item);
  itemRef.current = item;
  const [showPassed, setShowPassed] = useState(false);

  // The copy box grows with the text, so the whole draft is always readable without scrolling inside it.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [editingText, setEditingText] = useState(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [fields.body, editingText]);

  useEffect(() => {
    setFields(item.fields);
    setDirty(false);
    setSelection(null);
  }, [item.fields]);
  useEffect(() => {
    if (item.writer_model) setRewriteModel(item.writer_model);
  }, [item.writer_model]);

  const check = runBrandCheck(fields, item.channel, kit);
  const aiReview = item.ai_review;
  const fresh = isReviewFresh(aiReview, fields);
  const score = combinedScore(check.score, aiReview, fresh);

  async function runReview(current = fields) {
    setReviewing(true);
    setReviewError(null);
    try {
      const updated = await review({ data: { itemId: item.id, current } });
      // Keep whatever is on screen; if it changed meanwhile, the check shows as out of date.
      onUpdate({
        ...itemRef.current,
        ai_review: updated.ai_review,
        brand_score: updated.brand_score,
        flags: updated.flags,
      });
    } catch (e) {
      setReviewError(
        e instanceof Error ? e.message : "The full brand check didn't finish. Please try again.",
      );
    } finally {
      setReviewing(false);
    }
  }

  // Every new or rewritten draft gets the full brand check automatically, once.
  useEffect(() => {
    const key = `${item.id}:${fingerprint(item.fields)}`;
    if (item.ai_review || autoReviewed.current === key) return;
    autoReviewed.current = key;
    void runReview(item.fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const placeholders = placeholderBadges(`${allText(fields)}\n${fields.alt_text ?? ""}`);
  const aiFlagged = fresh ? (aiReview?.checks ?? []).filter((c) => c.status !== "pass") : [];
  const aiPassed = fresh ? (aiReview?.checks ?? []).filter((c) => c.status === "pass") : [];
  const confirmCount =
    aiFlagged.filter((c) => c.badge === "needs_confirmation").length + placeholders.confirm;
  const clearCount =
    aiFlagged.filter((c) => c.badge === "needs_clearance").length + placeholders.clear;
  const count = countedText(fields).length;

  function edit(patch: Partial<ContentFields>) {
    setFields((f) => ({ ...f, ...patch }));
    setDirty(true);
  }

  async function save(next = fields) {
    const result = runBrandCheck(next, item.channel, kit);
    const { error } = await supabase
      .from("content_items")
      .update({
        fields: next as unknown as Json,
        brand_score: combinedScore(
          result.score,
          item.ai_review,
          isReviewFresh(item.ai_review, next),
        ),
        flags: result.checks as unknown as Json,
      })
      .eq("id", item.id);
    if (error) return void toast.error("Your edit didn't save. Please try again.");
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: row } = await supabase
        .from("content_items")
        .select("brand_id")
        .eq("id", item.id)
        .single();
      if (row)
        await supabase.from("activity_log").insert({
          brand_id: row.brand_id,
          content_item_id: item.id,
          actor: auth.user.id,
          action: "edited",
          details: { brand_score: result.score },
        });
    }
    setDirty(false);
    onUpdate({
      ...item,
      fields: next,
      brand_score: result.score,
      flags: result.checks as unknown as Json,
    });
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const adjust = (id: (typeof ADJUST)[number]["id"]) =>
    run(id, async () => {
      const updated = await revise({ data: { itemId: item.id, adjustment: id, current: fields } });
      onUpdate(updated);
      toast.success(`${ch.short}: updated.`);
    });

  const fix = (c: BrandCheckItem) =>
    run(`fix-${c.id}`, async () => {
      if (!c.fix) return;
      const updated = await revise({ data: { itemId: item.id, fix: c.fix, current: fields } });
      onUpdate(updated);
      toast.success("Fixed. Checking again…");
    });

  const fixAi = (c: ReviewItem) =>
    run(`fix-${c.id}`, async () => {
      const updated = await fixFlagFn({
        data: {
          itemId: item.id,
          current: fields,
          span: c.span,
          suggestion: c.suggestion,
          label: c.label,
          message: c.message,
        },
      });
      onUpdate(updated);
      toast.success("Fixed and checked again.");
    });

  function captureSelection(el: HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end, value } = el;
    const text = value.slice(start, end);
    if (end > start && text.trim()) setSelection({ start, end, text });
  }

  const changeSelection = (note: string) =>
    run("selection", async () => {
      if (!selection || !note.trim()) return;
      const res = await rewriteSel({
        data: {
          itemId: item.id,
          current: fields,
          field: "body",
          start: selection.start,
          end: selection.end,
          selected: selection.text,
          note,
        },
      });
      setSelection(null);
      setSelNote("");
      onUpdate(res.item);
      toast.success("Changed only the highlighted words.");
    });

  const rewriteWithNote = () =>
    run("rewrite", async () => {
      const updated = await revise({
        data: { itemId: item.id, note: rewriteNote, model: rewriteModel, current: fields },
      });
      setRewriteNote("");
      setNoteOpen(false);
      onUpdate(updated);
      toast.success(`New version written with ${getWriterModel(rewriteModel).name}.`);
    });

  const moreVariants = () =>
    run("variants", async () => {
      const rows = await variants({ data: { itemId: item.id } });
      onVariants?.(rows);
    });

  const moreTags = () =>
    run("tags", async () => {
      const tags = await suggest({
        data: { itemId: item.id, current: fields.hashtags, body: fields.body },
      });
      if (!tags.length) return void toast.message("No new suggestions this time.");
      const next = { ...fields, hashtags: [...fields.hashtags, ...tags] };
      setFields(next);
      await save(next);
    });

  const submitForReview = () =>
    run("submit", async () => {
      if (dirty) await save();
      const { error } = await supabase.rpc("set_content_status", {
        _item: item.id,
        _status: "in_review",
        _comment: "",
      });
      if (error) throw new Error(error.message);
      onUpdate({ ...itemRef.current, status: "in_review" });
      toast.success("Sent for review. Approvers will see it on their home screen.");
    });

  async function copy() {
    await navigator.clipboard.writeText(plainCopy(fields));
    toast.success("Copied as plain text.");
  }

  const flagSpans: FlagSpan[] = aiFlagged.flatMap((c) => (c.span ? [{ id: c.id, span: c.span }] : []));
  const showMarks = flagSpans.length > 0 && !editingText;
  function startEditing() {
    setEditingText(true);
    requestAnimationFrame(() => bodyRef.current?.focus());
  }
  function jumpToFlag(id: string) {
    setEditingText(false);
    requestAnimationFrame(() => {
      const el = articleRef.current?.querySelector<HTMLElement>(`[data-flag-id="${CSS.escape(id)}"]`);
      if (!el) return void toast.message("Those exact words aren't in the text any more.");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 1800);
    });
  }
  const flagged = check.checks.filter((c) => c.status !== "pass");
  const passed = check.checks.filter((c) => c.status === "pass");

  return (
    <article
      ref={articleRef}
      className={cn("relative rounded-lg border bg-card shadow-card", isVariant ? "p-4" : "p-5 md:p-6")}
      aria-labelledby={`card-${item.id}`}
    >
      {busy && (
        <div
          className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-card/70 backdrop-blur-[1px]"
          role="status"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin" />{" "}
            {busy === "variants"
              ? "Writing two more versions…"
              : busy === "submit"
                ? "Sending for review…"
                : busy === "tags"
                  ? "Finding better hashtags…"
                  : busy === "selection"
                    ? "Changing the highlighted words…"
                    : busy === "rewrite"
                      ? "Writing a new version…"
                  : busy.startsWith("fix-ai")
                    ? "Fixing and checking again…"
                    : "Rewriting…"}
          </span>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`card-${item.id}`} className="font-sans text-lg font-semibold">
          {isVariant ? `${ch.short} — alternative` : ch.label}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <ModelTag modelId={item.writer_model} />
          {confirmCount > 0 && <FlagBadge badge="needs_confirmation" count={confirmCount} />}
          {clearCount > 0 && <FlagBadge badge="needs_clearance" count={clearCount} />}
          {showWorkflow && <StatusBadge status={item.status} />}
          <ScoreBadge score={score} />
        </div>
      </header>

      <div className="mt-5 space-y-5">
        {item.channel === "instagram_carousel" && (
          <CarouselSlides slides={fields.carousel_slides ?? []} id={item.id} highlight={showMarks ? flagSpans : null} onEdit={startEditing} onChange={(carousel_slides) => edit({ carousel_slides })} onSave={() => { if (dirty) void save(); }} />
        )}

        {fields.subject_line !== null && (
          <Field label="Subject line" id={`subj-${item.id}`}>
            <Input
              id={`subj-${item.id}`}
              value={fields.subject_line ?? ""}
              onChange={(e) => edit({ subject_line: e.target.value })}
              onBlur={() => dirty && save()}
            />
          </Field>
        )}
        {fields.h1 !== null && (
          <Field label="Headline (H1)" id={`h1-${item.id}`}>
            <Input
              id={`h1-${item.id}`}
              value={fields.h1 ?? ""}
              onChange={(e) => edit({ h1: e.target.value })}
              onBlur={() => dirty && save()}
              className="font-medium"
            />
          </Field>
        )}

        {item.channel === "tiktok" && (
          <>
            <Field label="Hook for the first 2 seconds" id={`f2s-${item.id}`}>
              <Input
                id={`f2s-${item.id}`}
                value={fields.first_2s_hook ?? ""}
                onChange={(e) => edit({ first_2s_hook: e.target.value })}
                onBlur={() => dirty && save()}
              />
            </Field>
            <Field label="On-screen text (one line each)" id={`ost-${item.id}`}>
              <Textarea
                id={`ost-${item.id}`}
                rows={4}
                value={(fields.on_screen_text ?? []).join("\n")}
                onChange={(e) => edit({ on_screen_text: e.target.value.split("\n") })}
                onBlur={() =>
                  dirty &&
                  save({
                    ...fields,
                    on_screen_text: (fields.on_screen_text ?? []).filter((l) => l.trim()),
                  })
                }
              />
            </Field>
          </>
        )}

        {item.channel === "case_study" && kit.noDashes && fields.portfolio_format === "brs" && <PortfolioPreview fields={fields} spans={flagSpans} />}

        {flagSpans.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-muted px-3 py-2 text-sm">
            <mark className="rounded-sm bg-highlight px-1 text-foreground">Yellow</mark>
            <span className="flex-1">{showMarks ? "marks the words the brand check flagged." : "You're editing. Show the highlights again when you're done."}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => (showMarks ? startEditing() : setEditingText(false))}>
              {showMarks ? "Edit text" : "Show highlights"}
            </Button>
          </div>
        )}

        <Field
          label={item.channel === "tiktok" || item.channel === "instagram_carousel" ? "Caption" : ch.kind === "long" ? "Article" : "Copy"}
          id={`body-${item.id}`}
          hint="Edit anything — changes save when you click away. Highlight words to ask for a change to just that part."
        >
          {showMarks ? (
            <div
              id={`body-${item.id}`}
              role="button"
              tabIndex={0}
              aria-label="Copy with flagged words highlighted. Press to edit."
              onClick={startEditing}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startEditing(); } }}
              className="min-h-24 cursor-text whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HighlightedText text={fields.body} spans={flagSpans} />
            </div>
          ) : (
          <Textarea
            ref={bodyRef}
            id={`body-${item.id}`}
            value={fields.body}
            onChange={(e) => {
              setSelection(null);
              edit({ body: e.target.value });
            }}
            onSelect={(e) => captureSelection(e.currentTarget)}
            onMouseUp={(e) => captureSelection(e.currentTarget)}
            onKeyUp={(e) => captureSelection(e.currentTarget)}
            onBlur={() => dirty && save()}
            rows={ch.kind === "long" ? 16 : isVariant ? 8 : 10}
            className="resize-none overflow-hidden text-sm leading-relaxed selection:bg-highlight selection:text-foreground"
          />
          )}
        </Field>

        {selection && (
          <div
            className="space-y-2.5 rounded-xl border border-primary/40 bg-primary-soft/40 p-3"
            role="region"
            aria-label="Change the highlighted words"
          >
            <div className="flex items-start gap-2 text-sm">
              <Highlighter className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="min-w-0 flex-1">
                <span className="font-medium">Change only these words: </span>
                <mark className="rounded bg-highlight px-1 text-foreground">
                  {selection.text.length > 160
                    ? `${selection.text.slice(0, 160)}…`
                    : selection.text}
                </mark>
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Cancel"
                onClick={() => setSelection(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick changes">
              {SELECTION_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => changeSelection(p)}
                  className="rounded-full border border-input bg-card px-2.5 py-0.5 text-xs font-medium hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                changeSelection(selNote);
              }}
            >
              <Input
                aria-label="What should change in the highlighted words?"
                value={selNote}
                onChange={(e) => setSelNote(e.target.value)}
                placeholder="Or say what should change, e.g. mention the crew by name"
                className="h-9 bg-card text-sm"
              />
              <Button type="submit" size="sm" className="h-9" disabled={!selNote.trim() || Boolean(busy)}>
                <Wand2 className="size-3.5" aria-hidden="true" /> Change it
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Everything outside the highlight stays exactly as it is.
            </p>
          </div>
        )}

        <LengthBar channelId={item.channel} count={count} />

        {ch.kind === "social" && ch.id !== "x" && (
          <HookPreview body={fields.body} length={ch.hookLength} />
        )}

        <section aria-label="Change the whole draft" className="space-y-3 rounded-lg border border-input bg-muted p-4">
          <h4 className="flex items-center gap-1.5 font-sans text-sm font-semibold">
            Change the whole draft
            <HelpTip>
              Each button writes a new version of the full draft. The current one is saved, so you
              can go back to it from Versions.
            </HelpTip>
          </h4>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick adjustments">
            {ADJUST.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant="secondary"
                onClick={() => adjust(a.id)}
                disabled={Boolean(busy)}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" /> {a.label}
              </Button>
            ))}
          </div>
          {!isVariant && (
            <div className="rounded-lg border border-input bg-card">
              <button
                type="button"
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen((o) => !o)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PenLine className="size-4 text-primary" aria-hidden="true" />
                Write a new version with my note
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  Your edits are kept
                </span>
              </button>
              {noteOpen && (
                <div className="space-y-2.5 border-t px-3 py-3">
                  <Label htmlFor={`note-${item.id}`} className="text-xs">
                    What should change? <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id={`note-${item.id}`}
                    rows={2}
                    value={rewriteNote}
                    onChange={(e) => setRewriteNote(e.target.value)}
                    placeholder="e.g. Lead with the crew, keep my second paragraph, end with a question"
                    className="text-sm"
                  />
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1 space-y-1">
                      <Label htmlFor={`writer-${item.id}`} className="text-xs">
                        Writer
                      </Label>
                      <Select value={rewriteModel} onValueChange={setRewriteModel}>
                        <SelectTrigger id={`writer-${item.id}`} className="h-9 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WRITER_MODELS.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="flex items-center gap-2">
                                {m.name}
                                <CostDots level={m.costLevel} />
                                <span className="text-xs text-muted-foreground">
                                  {COST_WORDS[m.costLevel]}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" className="h-9" onClick={rewriteWithNote} disabled={Boolean(busy)}>
                      <RefreshCw className="size-3.5" aria-hidden="true" /> Write new version
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The current version is saved, so you can go back to it any time from Versions.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {item.channel !== "instagram_carousel" && <Field label="Call to action" id={`cta-${item.id}`}>
          <Input
            id={`cta-${item.id}`}
            value={fields.cta}
            onChange={(e) => edit({ cta: e.target.value })}
            onBlur={() => dirty && save()}
          />
        </Field>}

        {ch.hashtagRange[1] > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Hashtags</span>
              <Button variant="ghost" size="sm" onClick={moreTags} disabled={Boolean(busy)}>
                <Hash className="size-3.5" /> Suggest more
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {fields.hashtags.map((h) => (
                <Chip
                  key={h}
                  onRemove={() => {
                    const next = { ...fields, hashtags: fields.hashtags.filter((x) => x !== h) };
                    setFields(next);
                    save(next);
                  }}
                >
                  #{h}
                </Chip>
              ))}
              <form
                className="flex items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = tagDraft.replace(/^#/, "").replace(/\s+/g, "");
                  if (!t || fields.hashtags.includes(t)) return;
                  const next = { ...fields, hashtags: [...fields.hashtags, t] };
                  setFields(next);
                  setTagDraft("");
                  save(next);
                }}
              >
                <Input
                  aria-label="Add a hashtag"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  placeholder="Add hashtag"
                  className="h-8 w-32 text-sm"
                />
              </form>
            </div>
          </div>
        )}

        {fields.alt_text !== null && ch.kind === "social" && (
          <Field
            label={item.channel === "instagram_carousel" ? "Suggested cover image alt text" : "Suggested image alt text"}
            id={`alt-${item.id}`}
            hint="Describes the image for people using screen readers."
          >
            <Textarea
              id={`alt-${item.id}`}
              rows={2}
              value={fields.alt_text ?? ""}
              onChange={(e) => edit({ alt_text: e.target.value })}
              onBlur={() => dirty && save()}
            />
          </Field>
        )}

        {item.channel === "tiktok" && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm">
            <Music className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            Remember: brand accounts must use commercially licensed audio (for example, from
            TikTok's Commercial Music Library).
          </p>
        )}

        {ch.kind === "long" && (
          <div className="space-y-4 rounded-lg border bg-background p-4">
            <Field label="Section headings (H2)" id={`h2-${item.id}`} hint="One per line.">
              <Textarea
                id={`h2-${item.id}`}
                rows={4}
                value={(fields.h2s ?? []).join("\n")}
                onChange={(e) => edit({ h2s: e.target.value.split("\n") })}
                onBlur={() => dirty && save()}
              />
            </Field>
            <Field
              label="Meta description"
              id={`meta-${item.id}`}
              hint={`${(fields.meta_description ?? "").length} of 155 characters — shown in search results.`}
            >
              <Textarea
                id={`meta-${item.id}`}
                rows={2}
                value={fields.meta_description ?? ""}
                onChange={(e) => edit({ meta_description: e.target.value })}
                onBlur={() => dirty && save()}
              />
            </Field>
            {fields.faq && fields.faq.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">FAQ</p>
                <dl className="space-y-3 text-sm">
                  {fields.faq.map((q, i) => (
                    <div key={i}>
                      <dt className="font-medium">{q.question}</dt>
                      <dd className="text-muted-foreground">{q.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}

        {/* Brand check */}
        <section aria-label="Brand check" className="rounded-lg border-2 border-primary/40 bg-primary-soft p-4 md:p-5">
          <h4 className="mb-3 flex items-center gap-1.5 font-sans text-xl font-semibold">
            Brand check
            <HelpTip>
              A careful second read against your Brand Kit: tone, facts and numbers, names that need
              clearance, unsupported claims like "the best", plus banned words, spelling, length,
              hashtags, emoji and exclamation marks. "Fix this" changes only the words that were
              flagged, then checks again.
            </HelpTip>
          </h4>

          <div aria-live="polite">
            {reviewing ? (
              <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                Reading it carefully against your Brand Kit…
              </p>
            ) : reviewError ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm">
                <span className="flex-1">{reviewError}</span>
                <Button size="sm" variant="outline" onClick={() => runReview()}>
                  Try again
                </Button>
              </div>
            ) : aiReview && !fresh ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="flex-1">
                  You've edited this since the last full check, so the score below only covers the
                  quick checks.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runReview()}
                  disabled={Boolean(busy)}
                >
                  <Sparkles className="size-3.5" aria-hidden="true" /> Check again
                </Button>
              </div>
            ) : aiReview ? (
              <p className="mb-4 border-b border-primary/20 pb-4 text-base leading-relaxed text-foreground">{aiReview.summary}</p>
            ) : null}
          </div>

          <ul className="space-y-3">
            {aiFlagged.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5">
                  <CheckIcon status={c.status} />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {c.label}
                    {c.badge && <FlagBadge badge={c.badge} />}
                  </p>
                  <p className="leading-relaxed text-foreground">{c.message}</p>
                  {c.span && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Flagged words: </span>
                      <button type="button" onClick={() => jumpToFlag(c.id)} title="Show these words in the text" className="rounded bg-highlight px-1 text-left text-foreground underline decoration-dotted underline-offset-2 hover:ring-1 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{c.span}</button>
                    </p>
                  )}
                  {c.span && c.suggestion !== null && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Suggested: </span>
                      <span className="font-medium">{c.suggestion || "(remove these words)"}</span>
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fixAi(c)}
                  disabled={Boolean(busy) || reviewing}
                >
                  <Wand2 className="size-3.5" aria-hidden="true" /> Fix this
                </Button>
              </li>
            ))}
            {flagged.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5">
                  <CheckIcon status={c.status} />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {c.label}
                    {c.id === "placeholders" && <FlagBadge badge="needs_confirmation" />}
                    {c.id === "clearance" && <FlagBadge badge="needs_clearance" />}
                  </p>
                  <p className="leading-relaxed text-foreground">{c.message}</p>
                </div>
                {c.fix && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fix(c)}
                    disabled={Boolean(busy) || reviewing}
                  >
                    <Wand2 className="size-3.5" aria-hidden="true" /> Fix this
                  </Button>
                )}
              </li>
            ))}
            {showPassed && [...aiPassed, ...passed].map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5">
                  <CheckIcon status="pass" />
                </span>
                <p>
                  <span className="font-medium">{c.label}</span>{" "}
                  <span className="text-foreground">— {c.message}</span>
                </p>
              </li>
            ))}
          </ul>
          {aiPassed.length + passed.length > 0 && (
            <button
              type="button"
              aria-expanded={showPassed}
              onClick={() => setShowPassed((o) => !o)}
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check className="size-4" aria-hidden="true" />
              {showPassed
                ? "Hide passed checks"
                : `${aiPassed.length + passed.length} checks passed — show`}
            </button>
          )}
        </section>

        {/* Actions */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={showWorkflow ? "default" : "outline"} onClick={copy}>
              <Copy className="size-3.5" /> Copy text
            </Button>
            {showWorkflow && (item.status === "draft" || item.status === "changes_requested") && (
              <Button
                size="sm"
                variant="outline"
                onClick={submitForReview}
                disabled={Boolean(busy)}
              >
                <Send className="size-3.5" aria-hidden="true" /> Send for review
              </Button>
            )}
            {showWorkflow && (
              <Button size="sm" variant="ghost" asChild>
                <Link to="/library/$itemId" params={{ itemId: item.id }}>
                  <ClipboardCheck className="size-3.5" aria-hidden="true" /> Review page
                </Link>
              </Button>
            )}
            {!isVariant && onVariants && (
              <Button size="sm" variant="outline" onClick={moreVariants} disabled={Boolean(busy)}>
                <Columns2 className="size-3.5" /> Generate 2 more variants
              </Button>
            )}
          </div>
          {showWorkflow && item.channel === "linkedin" && (
            <p className="mt-3 text-sm text-muted-foreground">
              {item.status === "approved" ? (
                <>
                  Approved and ready.{" "}
                  <Link
                    to="/library/$itemId"
                    params={{ itemId: item.id }}
                    className="font-medium text-primary underline"
                  >
                    Post it to LinkedIn
                  </Link>
                </>
              ) : (
                <>
                  Once this is approved, the{" "}
                  <Link
                    to="/library/$itemId"
                    params={{ itemId: item.id }}
                    className="font-medium text-primary underline"
                  >
                    review page
                  </Link>{" "}
                  shows "Open in LinkedIn" and "Post now".
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ResultSkeleton({ channelId }: { channelId: string }) {
  const ch = getChannel(channelId);
  return (
    <div className="rounded-2xl border bg-card p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin text-primary" /> Writing your{" "}
        {ch.label.toLowerCase()}…
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-8/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-9/12 animate-pulse rounded bg-muted" />
      </div>
      <p className="mt-5 text-xs text-muted-foreground">Then we check it against your Brand Kit.</p>
    </div>
  );
}

export function ErrorCard({ channelId, message }: { channelId: string; message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive-soft p-5 text-sm">
      <p className="font-semibold">{getChannel(channelId).label} didn't come through</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
