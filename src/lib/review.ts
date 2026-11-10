/**
 * The AI brand check (second pass). This file is pure and browser-safe:
 * types, scoring, staleness and the "fix only the flagged words" logic.
 * The writing-service call itself lives in review.server.ts.
 */
import { allText, type BrandCheckItem, type ContentFields } from "./content-types";

export type ReviewCategory = "tone" | "facts" | "names" | "superlatives" | "rules";
export type ReviewBadge = "needs_confirmation" | "needs_clearance";

export interface ReviewItem extends BrandCheckItem {
  category: ReviewCategory;
  /** The exact words in the draft this item is about. */
  span: string | null;
  badge: ReviewBadge | null;
  /** Replacement text for `span` only. */
  suggestion: string | null;
}

export interface AiReview {
  score: number;
  summary: string;
  checks: ReviewItem[];
  /** Fingerprint of the text that was reviewed, so edits can mark it out of date. */
  fingerprint: string;
  reviewed_at: string;
}

export const BADGE_LABEL: Record<ReviewBadge, string> = {
  needs_confirmation: "Needs confirmation",
  needs_clearance: "Needs clearance",
};

/** A short, stable fingerprint of everything the reviewer read. */
export function fingerprint(fields: ContentFields): string {
  const s = `${allText(fields)} ${fields.hashtags.join(" ")} ${fields.alt_text ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

export function isReviewFresh(review: AiReview | null | undefined, fields: ContentFields) {
  return Boolean(review && review.fingerprint === fingerprint(fields));
}

/** The card's score: the stricter of the quick check and the full review. */
export function combinedScore(basic: number, review: AiReview | null | undefined, fresh: boolean) {
  if (!review || !fresh) return basic;
  return Math.max(0, Math.min(100, Math.round(Math.min(basic, review.score))));
}

/** Placeholders already in the copy that someone still has to fill in. */
export function placeholderBadges(text: string) {
  return {
    confirm: (text.match(/\[NEEDS CONFIRMATION[^\]]*\]/gi) ?? []).length,
    clear: (text.match(/\[NEEDS CLEARANCE[^\]]*\]/gi) ?? []).length,
  };
}

const NUMBER_RE = /(?:[£$€]\s?)?\d[\d,.]*(?:\s?(?:%|k|m|bn|million|billion|thousand))?/gi;

function normaliseNumber(n: string) {
  return n
    .toLowerCase()
    .replace(/[£$€\s,]/g, "")
    .replace(/\.$/, "");
}

/** Numbers in the draft, and whether each appears in the approved sources. */
export function scanNumbers(draft: string, sources: string) {
  const clean = draft.replace(/\[NEEDS (CONFIRMATION|CLEARANCE)[^\]]*\]/gi, "");
  const known = new Set(
    (sources.match(NUMBER_RE) ?? [])
      .map(normaliseNumber)
      .flatMap((n) => [n, n.replace(/\D+$/, "")]),
  );
  const seen = new Map<string, boolean>();
  for (const raw of clean.match(NUMBER_RE) ?? []) {
    const n = normaliseNumber(raw);
    if (!n || !/\d/.test(n)) continue;
    seen.set(raw.trim(), known.has(n) || known.has(n.replace(/\D+$/, "")));
  }
  return [...seen].map(([value, supported]) => ({ value, supported }));
}

/**
 * Safety net for suggested fixes: a fix may never bring in a number that isn't
 * already in the flagged words or the approved sources. If it does, we swap it
 * for a placeholder instead.
 */
export function guardSuggestion(
  suggestion: string,
  span: string,
  sources: string,
  label: string,
): string {
  const unsupported = scanNumbers(suggestion, `${sources}\n${span}`).filter((n) => !n.supported);
  if (!unsupported.length) return suggestion;
  return `[NEEDS CONFIRMATION: ${label.toLowerCase()}]`;
}

/** Replace the flagged words wherever they appear, and nothing else. */
export function applySpanFix(
  fields: ContentFields,
  span: string,
  replacement: string,
): { fields: ContentFields; changed: boolean } {
  if (!span.trim()) return { fields, changed: false };
  let changed = false;
  const swap = (s: string) => {
    if (!s.includes(span)) return s;
    changed = true;
    return s.split(span).join(replacement);
  };
  const opt = (s: string | null) => (s === null ? null : swap(s));
  const arr = (a: string[] | null) => (a === null ? null : a.map(swap));
  const next: ContentFields = {
    ...fields,
    hook: swap(fields.hook),
    body: swap(fields.body),
    cta: swap(fields.cta),
    alt_text: opt(fields.alt_text),
    subject_line: opt(fields.subject_line),
    on_screen_text: arr(fields.on_screen_text),
    first_2s_hook: opt(fields.first_2s_hook),
    h1: opt(fields.h1),
    h2s: arr(fields.h2s),
    meta_description: opt(fields.meta_description),
    faq: fields.faq
      ? fields.faq.map((f) => ({ question: swap(f.question), answer: swap(f.answer) }))
      : null,
  };
  return { fields: next, changed };
}

export function toAiReview(raw: unknown): AiReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AiReview>;
  if (typeof r.score !== "number" || !Array.isArray(r.checks) || !r.fingerprint) return null;
  return r as AiReview;
}
