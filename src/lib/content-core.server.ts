// Server-only: the shared "save, check and send for review" path. Used by the web app's
// server functions and by the Slack integration, so both go through the same checks,
// the same RLS-scoped client and the same `set_content_status` RPC.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { normaliseSlideCount } from "./carousel-count";
import type { ChannelId } from "./channels";
import { emptyFields, splitPastedPost, type ContentFields } from "./content-types";
import { normaliseSliders } from "./sliders";
import { toPlainText } from "./plain-text";
import { runBrandCheck } from "./brand-check";
import { kitForCheck, loadBrandKit } from "./brand-kit";
import { DEFAULT_WRITER_MODEL, isWriterModel } from "./models";
import type { GenerationInput, KeyFact } from "./prompt.server";
import { runAiReview } from "./review.server";
import { toAiReview, type AiReview } from "./review";

type Client = SupabaseClient<Database>;

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

export function cleanFields(raw: Partial<ContentFields>): ContentFields {
  const base = emptyFields();
  const f = { ...base, ...raw } as ContentFields;
  const tags = (f.hashtags ?? [])
    .map((h) => h.replace(/^#+/, "").replace(/\s+/g, "").trim())
    .filter(Boolean);
  return {
    ...f,
    hook: toPlainText(f.hook ?? ""),
    body: f.portfolio_format === "brs" ? (f.body ?? "").trim() : toPlainText(f.body ?? ""),
    cta: toPlainText(f.cta ?? ""),
    hashtags: Array.from(new Set(tags)),
    carousel_slides:
      f.carousel_slides?.map((s) => ({
        headline: toPlainText(s.headline),
        supporting_line: s.supporting_line === null ? null : toPlainText(s.supporting_line),
      })) ?? null,
  };
}

export const SELECT_ITEM =
  "id, channel, fields, brand_score, flags, status, variant_of, created_at, ai_review, writer_model";

export function toGenerated(row: {
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

export async function loadItemContext(
  supabase: Parameters<typeof loadBrandKit>[0],
  itemId: string,
) {
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
    // Rewrites keep the draft's current slide count (3 to 10); otherwise Auto.
    slideCount: normaliseSlideCount(
      (item.fields as unknown as ContentFields | null)?.carousel_slides?.length,
    ),
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

/** Save a draft together with both checks, and log what the review flagged. */
export async function saveReviewed(
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

export interface PastedPostInput {
  brandId: string;
  channel: ChannelId;
  text: string;
  personaId: string | null;
  goalId: string | null;
}

/**
 * Save a post someone already wrote exactly as pasted (no writing model), run both brand
 * checks on it and send it for review. `supabase` must be a client acting as `userId`,
 * so RLS and the content triggers apply.
 */
export async function checkPastedPost(supabase: Client, userId: string, data: PastedPostInput) {
  const { data: request, error: reqError } = await supabase
    .from("content_requests")
    .insert({
      brand_id: data.brandId,
      created_by: userId,
      brief:
        "Existing post written by a copywriter, checked exactly as written. There is no separate brief, image description or required structure to follow.",
      persona_id: data.personaId,
      goal_id: data.goalId,
      channels: [data.channel],
    })
    .select("id")
    .single();
  if (reqError || !request) throw new Error("We couldn't save the post. Please try again.");

  const fields = { ...emptyFields(), ...splitPastedPost(data.text) };
  const { data: row, error } = await supabase
    .from("content_items")
    .insert({
      request_id: request.id,
      brand_id: data.brandId,
      channel: data.channel,
      fields: fields as unknown as Json,
      created_by: userId,
      change_note: "Pasted for checking",
    })
    .select("id")
    .single();
  if (error || !row) throw new Error("We couldn't save the post. Please try again.");
  await supabase.from("activity_log").insert({
    brand_id: data.brandId,
    content_item_id: row.id,
    actor: userId,
    action: "pasted_for_check",
    details: { persona_id: data.personaId, goal_id: data.goalId } as unknown as Json,
  });

  const ctx = await loadItemContext(supabase, row.id);
  await saveReviewed(supabase, userId, ctx, fields, "reviewed", {});
  const { error: statusError } = await supabase.rpc("set_content_status", {
    _item: row.id,
    _status: "in_review",
    _comment: "",
  });
  if (statusError) throw new Error("The post was checked but couldn't be sent for review.");
  return { itemId: row.id };
}
