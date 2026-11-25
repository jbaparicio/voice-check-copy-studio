/**
 * Turns a stored content item into the small, stable shape Slack (and a future agent) sees.
 * Pure. Reads the saved review values and never recalculates editorial decisions.
 */
import type { ChannelId } from "@/lib/channels";
import { allText, type BrandCheckItem, type ContentFields } from "@/lib/content-types";
import { toAiReview } from "@/lib/review";
import type { SlackFlag, SlackItemSummary } from "./blocks";

export interface StoredItemRow {
  id: string;
  channel: string;
  fields: unknown;
  brand_score: number | null;
  flags: unknown;
  ai_review: unknown;
  status: string;
}

export function toSlackSummary(row: StoredItemRow): SlackItemSummary {
  const fields = (row.fields ?? {}) as ContentFields;
  const review = toAiReview(row.ai_review);
  const basic = Array.isArray(row.flags) ? (row.flags as BrandCheckItem[]) : [];
  const flags: SlackFlag[] = [
    // Deterministic failures first: they can't be argued with.
    ...basic
      .filter((c) => c.status !== "pass")
      .map((c) => ({ label: c.label, message: c.message, span: null })),
    ...(review?.checks ?? [])
      .filter((c) => c.status !== "pass")
      .map((c) => ({ label: c.label, message: c.message, span: c.span })),
  ];
  return {
    id: row.id,
    channel: row.channel as ChannelId,
    text: allText({ ...fields, hashtags: fields.hashtags ?? [] }),
    score: row.brand_score,
    verdict: review?.verdict ?? null,
    summary: review?.main_problem || review?.summary || null,
    flags,
    status: row.status,
  };
}
