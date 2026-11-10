import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { CHANNEL_MAP, type ChannelId } from "./channels";
import { emptyFields, type ContentFields } from "./content-types";
import { normaliseSliders } from "./sliders";
import { toPlainText } from "./plain-text";
import { runBrandCheck } from "./brand-check";
import { kitForCheck, loadBrandKit } from "./brand-kit";
import { writeStructured, WriterError } from "./ai-gateway.server";
import { DEFAULT_WRITER_MODEL, getWriterModel, isWriterModel } from "./models";
import {
  ADJUSTMENTS,
  buildChannelPrompt,
  buildInstructions,
  buildRevisionPrompt,
  buildSelectionPrompt,
  contentSchema,
  replacementSchema,
  hashtagSchema,
  type AdjustmentId,
  type GenerationInput,
  type KeyFact,
} from "./prompt.server";
import { runAiReview } from "./review.server";
import { applySpanFix, guardSuggestion, toAiReview, type AiReview } from "./review";
import { locateSelection, SELECTABLE_FIELDS, spliceText, type SelectableField } from "./selection";

/** Everything a number is allowed to come from: the brief, its key facts and approved facts. */
function factSources(kit: Awaited<ReturnType<typeof loadBrandKit>>, input: GenerationInput) {
  return [
    input.brief,
    ...input.keyFacts.map((f) => f.text),
    ...kit.facts.map((f) => `${f.fact} ${f.value}`),
  ].join("\n");
}

export interface GeneratedItem {
  id: string;
  channel: ChannelId;
  fields: ContentFields;
  brand_score: number | null;
  flags: Json;
  status: string;
  variant_of: string | null;
  created_at: string;
  ai_review: AiReview | null;
  writer_model: string | null;
}

function cleanFields(raw: Partial<ContentFields>): ContentFields {
  const base = emptyFields();
  const f = { ...base, ...raw } as ContentFields;
  const tags = (f.hashtags ?? [])
    .map((h) => h.replace(/^#+/, "").replace(/\s+/g, "").trim())
    .filter(Boolean);
  return {
    ...f,
    hook: toPlainText(f.hook ?? ""),
    body: toPlainText(f.body ?? ""),
    cta: toPlainText(f.cta ?? ""),
    hashtags: Array.from(new Set(tags)),
  };
}

function isChannel(id: string): id is ChannelId {
  return id in CHANNEL_MAP;
}

const SELECT_ITEM =
  "id, channel, fields, brand_score, flags, status, variant_of, created_at, ai_review, writer_model";

function toGenerated(row: {
  id: string;
  channel: string;
  fields: Json;
  brand_score: number | null;
  flags: Json;
  status: string;
  variant_of: string | null;
  created_at: string;
  ai_review: Json | null;
  writer_model: string | null;
}): GeneratedItem {
  return {
    ...row,
    channel: row.channel as ChannelId,
    fields: cleanFields(row.fields as unknown as ContentFields),
    ai_review: toAiReview(row.ai_review),
  };
}

interface GenerateRequest extends GenerationInput {
  brandId: string;
  channels: string[];
  /** One of the curated writing models; defaults to the house writer. */
  model?: string | null;
}

export const generateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateRequest) => {
    if (!input.brief?.trim()) throw new Error("Please describe what you want to say.");
    const channels = (input.channels ?? []).filter(isChannel);
    if (!channels.length) throw new Error("Pick at least one channel.");
    return {
      ...input,
      brief: input.brief.trim().slice(0, 4000),
      channels,
      sliders: normaliseSliders(input.sliders),
      keyFacts: (input.keyFacts ?? []).slice(0, 20).map((f: KeyFact) => ({
        text: String(f.text).slice(0, 500),
        verified: Boolean(f.verified),
      })),
      link: input.link?.trim() || null,
      exampleIds: (input.exampleIds ?? []).slice(0, 5),
      model: isWriterModel(input.model) ? input.model : DEFAULT_WRITER_MODEL,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const kit = await loadBrandKit(supabase, data.brandId);
    const checkKit = kitForCheck(kit);
    const instructions = buildInstructions(kit);

    const { data: request, error: reqError } = await supabase
      .from("content_requests")
      .insert({
        brand_id: data.brandId,
        created_by: userId,
        brief: data.brief,
        key_facts: data.keyFacts as unknown as Json,
        link: data.link,
        example_ids: data.exampleIds,
        persona_id: data.personaId,
        goal_id: data.goalId,
        channels: data.channels,
        sliders: data.sliders as unknown as Json,
        hashtags: data.hashtags as unknown as Json,
        model: data.model,
      })
      .select("id")
      .single();
    if (reqError || !request) throw new Error("We couldn't save your brief. Please try again.");

    const results = await Promise.all(
      data.channels.map(async (channel) => {
        try {
          const { data: raw } = await writeStructured({
            instructions,
            prompt: buildChannelPrompt(kit, channel, data),
            schema: contentSchema,
            model: data.model,
          });
          const fields = cleanFields(raw);
          const check = runBrandCheck(fields, channel, checkKit);
          const { data: row, error } = await supabase
            .from("content_items")
            .insert({
              request_id: request.id,
              brand_id: data.brandId,
              channel,
              fields: fields as unknown as Json,
              brand_score: check.score,
              flags: check.checks as unknown as Json,
              created_by: userId,
              writer_model: data.model,
              change_note: `First draft · ${getWriterModel(data.model).name}`,
            })
            .select(SELECT_ITEM)
            .single();
          if (error || !row) throw new Error("We couldn't save this draft.");
          await supabase.from("activity_log").insert({
            brand_id: data.brandId,
            content_item_id: row.id,
            actor: userId,
            action: "generated",
            details: {
              sliders: data.sliders,
              persona_id: data.personaId,
              goal_id: data.goalId,
              model: data.model,
              brand_score: check.score,
              flagged: check.checks.filter((c) => c.status !== "pass").map((c) => c.label),
            } as unknown as Json,
          });
          return { ok: true as const, item: toGenerated(row) };
        } catch (e) {
          const message =
            e instanceof WriterError || e instanceof Error ? e.message : "Something went wrong.";
          return { ok: false as const, channel, message };
        }
      }),
    );

    return {
      requestId: request.id,
      items: results.flatMap((r) => (r.ok ? [r.item] : [])),
      errors: results.flatMap((r) => (r.ok ? [] : [{ channel: r.channel, message: r.message }])),
    };
  });

async function loadItemContext(supabase: Parameters<typeof loadBrandKit>[0], itemId: string) {
  const { data: item, error } = await supabase
    .from("content_items")
    .select("id, brand_id, channel, fields, request_id, variant_of, writer_model")
    .eq("id", itemId)
    .single();
  if (error || !item) throw new Error("We couldn't find that draft.");
  const { data: req } = item.request_id
    ? await supabase.from("content_requests").select("*").eq("id", item.request_id).single()
    : { data: null };
  const kit = await loadBrandKit(supabase, item.brand_id);
  const input: GenerationInput = {
    brief: req?.brief ?? "",
    keyFacts: (req?.key_facts as unknown as KeyFact[]) ?? [],
    link: req?.link ?? null,
    personaId: req?.persona_id ?? null,
    goalId: req?.goal_id ?? null,
    exampleIds: req?.example_ids ?? [],
    sliders: normaliseSliders(req?.sliders),
    hashtags: ((req?.hashtags as Record<string, number>) ?? {}) as GenerationInput["hashtags"],
  };
  const channel = item.channel as ChannelId;
  const model = isWriterModel(req?.model) ? req.model : DEFAULT_WRITER_MODEL;
  return {
    item,
    kit,
    input,
    channel,
    model,
    current: cleanFields(item.fields as unknown as ContentFields),
  };
}

const ADJUST_NOTE: Record<string, string> = {
  shorter: "Made shorter",
  longer: "Made longer",
  emotional: "More emotional",
  factual: "More factual",
  hook: "Punchier hook",
  angle: "Different angle",
};

export const reviseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      adjustment?: AdjustmentId;
      fix?: string;
      /** A person's own note: "rewrite with my note" (whole piece, keeps their edits as the base). */
      note?: string;
      /** Optional: a different writing model for this rewrite. */
      model?: string | null;
      current?: ContentFields;
    }) => {
      if (!input.adjustment && !input.fix && input.note === undefined)
        throw new Error("Nothing to change.");
      if (input.adjustment && !(input.adjustment in ADJUSTMENTS))
        throw new Error("Unknown adjustment.");
      return {
        ...input,
        fix: input.fix?.slice(0, 1000),
        note: input.note?.trim().slice(0, 1000),
        model: isWriterModel(input.model) ? input.model : null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadItemContext(supabase, data.itemId);
    const model = data.model ?? ctx.item.writer_model ?? ctx.model;
    const current = data.current ? cleanFields(data.current) : ctx.current;
    const instruction = data.adjustment
      ? ADJUSTMENTS[data.adjustment]
      : data.fix
        ? data.fix
        : data.note
          ? `${data.note}\nThe current draft includes edits a person made by hand — keep the parts they wrote unless the request says otherwise.`
          : "Write a fresh version of this piece. Keep the person's hand edits and the same facts, but improve the flow and the hook.";
    const prompt = buildRevisionPrompt(
      buildChannelPrompt(ctx.kit, ctx.channel, ctx.input),
      current,
      instruction,
      Boolean(data.fix),
    );
    const { data: raw } = await writeStructured({
      instructions: buildInstructions(ctx.kit),
      prompt,
      schema: contentSchema,
      model,
    });
    const fields = cleanFields(raw);
    const check = runBrandCheck(fields, ctx.channel, kitForCheck(ctx.kit));
    const noteLabel = data.adjustment
      ? (ADJUST_NOTE[data.adjustment] ?? "Adjusted")
      : data.fix
        ? "Fixed a brand check flag"
        : data.note
          ? `Rewrote: “${data.note.slice(0, 80)}”`
          : "New version";
    const { data: row, error } = await supabase
      .from("content_items")
      .update({
        fields: fields as unknown as Json,
        brand_score: check.score,
        flags: check.checks as unknown as Json,
        ai_review: null,
        status: "draft",
        writer_model: model,
        change_note: `${noteLabel} · ${getWriterModel(model).name}`,
      })
      .eq("id", data.itemId)
      .select(SELECT_ITEM)
      .single();
    if (error || !row) throw new Error("We couldn't save the new version.");
    await supabase.from("activity_log").insert({
      brand_id: ctx.item.brand_id,
      content_item_id: data.itemId,
      actor: userId,
      action: data.fix ? "fixed" : "adjusted",
      details: {
        request: data.adjustment ?? data.fix ?? data.note ?? "new version",
        model,
        brand_score: check.score,
      } as unknown as Json,
    });
    return toGenerated(row);
  });

/** Rewrite only the words a person highlighted, following their note. */
export const rewriteSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      current: ContentFields;
      field: SelectableField;
      start: number;
      end: number;
      selected: string;
      note: string;
    }) => {
      if (!SELECTABLE_FIELDS.includes(input.field)) throw new Error("That part can't be changed.");
      if (!input.selected?.trim()) throw new Error("Highlight some words first.");
      if (!input.note?.trim()) throw new Error("Say what should change.");
      return {
        ...input,
        start: Math.max(0, Math.floor(input.start)),
        end: Math.max(0, Math.floor(input.end)),
        selected: input.selected.slice(0, 3000),
        note: input.note.trim().slice(0, 500),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadItemContext(supabase, data.itemId);
    const model = ctx.item.writer_model ?? ctx.model;
    const current = cleanFields(data.current);
    const text = current[data.field] ?? "";
    const range = locateSelection(text, data.start, data.end, data.selected);
    if (!range) throw new Error("The highlighted words changed. Highlight them again.");
    const { data: out } = await writeStructured({
      instructions: buildInstructions(ctx.kit),
      prompt: buildSelectionPrompt({
        channelLabel: CHANNEL_MAP[ctx.channel].label,
        before: text.slice(Math.max(0, range.start - 600), range.start),
        selected: data.selected,
        after: text.slice(range.end, range.end + 600),
        note: data.note,
      }),
      schema: replacementSchema,
      model,
    });
    const sources = factSources(ctx.kit, ctx.input);
    const replacement = guardSuggestion(
      toPlainText(out.replacement ?? "").trim(),
      data.selected,
      sources,
      "number in the new wording",
    );
    const nextText = spliceText(text, range, replacement);
    const fields = cleanFields({ ...current, [data.field]: nextText });
    const check = runBrandCheck(fields, ctx.channel, kitForCheck(ctx.kit));
    const { data: row, error } = await supabase
      .from("content_items")
      .update({
        fields: fields as unknown as Json,
        brand_score: check.score,
        flags: check.checks as unknown as Json,
        writer_model: model,
        change_note: `Changed highlighted words: “${data.note.slice(0, 80)}” · ${getWriterModel(model).name}`,
      })
      .eq("id", data.itemId)
      .select(SELECT_ITEM)
      .single();
    if (error || !row) throw new Error("We couldn't save the change.");
    await supabase.from("activity_log").insert({
      brand_id: ctx.item.brand_id,
      content_item_id: data.itemId,
      actor: userId,
      action: "edited_selection",
      details: {
        request: data.note,
        selected: data.selected.slice(0, 300),
        replacement: replacement.slice(0, 300),
        model,
        brand_score: check.score,
      } as unknown as Json,
    });
    return { item: toGenerated(row), replacement };
  });

export const generateVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadItemContext(supabase, data.itemId);
    const model = ctx.item.writer_model ?? ctx.model;
    const rootId = ctx.item.variant_of ?? ctx.item.id;
    const base = buildChannelPrompt(ctx.kit, ctx.channel, ctx.input);
    const instructions = buildInstructions(ctx.kit);
    const checkKit = kitForCheck(ctx.kit);
    const angles = [
      "Write an alternative version with a clearly different hook and structure from the current draft.",
      "Write a second alternative that leads with a different benefit or detail than the current draft, with a different opening line.",
    ];
    const rows = await Promise.all(
      angles.map(async (angle) => {
        const { data: raw } = await writeStructured({
          instructions,
          prompt: buildRevisionPrompt(base, ctx.current, angle, false),
          schema: contentSchema,
          model,
        });
        const fields = cleanFields(raw);
        const check = runBrandCheck(fields, ctx.channel, checkKit);
        const { data: row, error } = await supabase
          .from("content_items")
          .insert({
            request_id: ctx.item.request_id,
            brand_id: ctx.item.brand_id,
            channel: ctx.channel,
            fields: fields as unknown as Json,
            brand_score: check.score,
            flags: check.checks as unknown as Json,
            variant_of: rootId,
            created_by: userId,
            writer_model: model,
            change_note: `Alternative version · ${getWriterModel(model).name}`,
          })
          .select(SELECT_ITEM)
          .single();
        if (error || !row) throw new Error("We couldn't save a variant.");
        await supabase.from("activity_log").insert({
          brand_id: ctx.item.brand_id,
          content_item_id: row.id,
          actor: userId,
          action: "generated_variant",
          details: { variant_of: rootId, brand_score: check.score } as unknown as Json,
        });
        return toGenerated(row);
      }),
    );
    return rows;
  });

export const suggestHashtags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; current: string[]; body: string }) => ({
    ...input,
    body: input.body.slice(0, 6000),
  }))
  .handler(async ({ data, context }) => {
    const ctx = await loadItemContext(context.supabase, data.itemId);
    const { data: out } = await writeStructured({
      instructions: buildInstructions(ctx.kit),
      prompt: `Suggest 5 more hashtags for this ${CHANNEL_MAP[ctx.channel].label}. They must be specific to the content and audience — never generic filler (no "marketing", "business", "success", "motivation", "love"). Don't repeat these existing ones: ${data.current.join(", ") || "none"}. Return them without the # symbol.\n\nCOPY:\n${data.body}`,
      schema: hashtagSchema,
    });
    const existing = new Set(data.current.map((h) => h.toLowerCase()));
    return out.hashtags
      .map((h) => h.replace(/^#+/, "").replace(/\s+/g, ""))
      .filter((h) => h && !existing.has(h.toLowerCase()))
      .slice(0, 5);
  });

/** Save a draft together with both checks, and log what the review flagged. */
async function saveReviewed(
  supabase: Parameters<typeof loadBrandKit>[0],
  userId: string,
  ctx: Awaited<ReturnType<typeof loadItemContext>>,
  fields: ContentFields,
  action: string,
  details: Record<string, unknown>,
  changeNote?: string,
) {
  const basic = runBrandCheck(fields, ctx.channel, kitForCheck(ctx.kit));
  const review = await runAiReview({
    kit: ctx.kit,
    channel: ctx.channel,
    input: ctx.input,
    fields,
  });
  const score = Math.min(basic.score, review.score);
  const { data: row, error } = await supabase
    .from("content_items")
    .update({
      fields: fields as unknown as Json,
      brand_score: score,
      flags: basic.checks as unknown as Json,
      ai_review: review as unknown as Json,
      ...(changeNote ? { change_note: changeNote } : {}),
    })
    .eq("id", ctx.item.id)
    .select(SELECT_ITEM)
    .single();
  if (error || !row) throw new Error("We couldn't save the brand check.");
  await supabase.from("activity_log").insert({
    brand_id: ctx.item.brand_id,
    content_item_id: ctx.item.id,
    actor: userId,
    action,
    details: {
      ...details,
      brand_score: score,
      flagged: review.checks
        .filter((c) => c.status !== "pass")
        .map((c) => ({ label: c.label, badge: c.badge, span: c.span })),
    } as unknown as Json,
  });
  return toGenerated(row);
}

/** The full AI brand check: a second pass on one draft. */
export const reviewItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; current?: ContentFields }) => input)
  .handler(async ({ data, context }) => {
    const ctx = await loadItemContext(context.supabase, data.itemId);
    const fields = data.current ? cleanFields(data.current) : ctx.current;
    return saveReviewed(context.supabase, context.userId, ctx, fields, "reviewed", {});
  });

/** "Fix this" for a review flag: rewrite only the flagged words, then check again. */
export const fixFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      current: ContentFields;
      span: string | null;
      suggestion: string | null;
      label: string;
      message: string;
    }) => ({
      ...input,
      span: input.span?.slice(0, 1000) ?? null,
      suggestion: input.suggestion?.slice(0, 1000) ?? null,
      label: String(input.label).slice(0, 200),
      message: String(input.message).slice(0, 1000),
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadItemContext(context.supabase, data.itemId);
    const current = cleanFields(data.current);
    let fields = current;
    let replaced = false;
    if (data.span && data.suggestion !== null) {
      const r = applySpanFix(current, data.span, data.suggestion);
      fields = r.fields;
      replaced = r.changed;
    }
    if (!replaced) {
      // The flagged words couldn't be matched exactly — ask for a minimal rewrite instead.
      const instruction = `${data.label}: ${data.message}${data.span ? `\nThe problem is in these words: "${data.span}". Rewrite only that phrase.` : ""}
Never add facts, numbers, clients, awards, quotes or people that aren't in the approved facts or the brief — use a [NEEDS CONFIRMATION: …] placeholder instead.`;
      const { data: raw } = await writeStructured({
        instructions: buildInstructions(ctx.kit),
        prompt: buildRevisionPrompt(
          buildChannelPrompt(ctx.kit, ctx.channel, ctx.input),
          current,
          instruction,
          true,
        ),
        schema: contentSchema,
      });
      fields = cleanFields(raw);
    }
    return saveReviewed(context.supabase, context.userId, ctx, fields, "fixed", {
      request: data.label,
      span: data.span,
      replacement: replaced ? data.suggestion : null,
    }, `Fixed: ${data.label}`);
  });
