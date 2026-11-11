import type { ChannelId } from "./channels";

export interface CarouselSlide {
  headline: string;
  supporting_line: string | null;
}

/** The fields every generated piece can have. Channel-specific extras are null when unused. */
export interface ContentFields {
  portfolio_format?: "brs" | null | undefined;
  carousel_slides?: CarouselSlide[] | null | undefined;
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  alt_text: string | null;
  subject_line: string | null;
  // TikTok
  on_screen_text: string[] | null;
  first_2s_hook: string | null;
  // Blog & case study
  h1: string | null;
  h2s: string[] | null;
  meta_description: string | null;
  faq: { question: string; answer: string }[] | null;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface BrandCheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  /** When present, the card can offer a one-click "Fix this". */
  fix?: string | undefined;
}

export interface BrandCheckResult {
  score: number;
  checks: BrandCheckItem[];
}

export interface BrandKitForCheck {
  bannedWords: string[];
  preferred: { say: string; not: string }[];
  spellingVariant: string;
  emojiPolicy: "none" | "sparing" | "free";
  exclamationAllowed: Partial<Record<ChannelId, boolean>>;
  neverNames: string[];
  /** Brand doesn't use dashes (em dash, en dash or a spaced hyphen). */
  noDashes?: boolean;
}

export function emptyFields(): ContentFields {
  return {
    hook: "",
    body: "",
    hashtags: [],
    cta: "",
    alt_text: null,
    subject_line: null,
    on_screen_text: null,
    first_2s_hook: null,
    h1: null,
    h2s: null,
    meta_description: null,
    faq: null,
    carousel_slides: null,
  };
}

/** The text that counts towards the channel's character range. */
/**
 * Keep a pasted post exactly as written. Only a final paragraph made purely of "#tag #tag" is moved
 * into hashtags, because the app adds it back in exactly that form when copying or posting.
 */
export function splitPastedPost(
  text: string,
): Pick<ContentFields, "body" | "hashtags" | "hook" | "cta"> {
  const m = text.match(/^([\s\S]*?)\n\n(#[\p{L}\p{N}_]+(?: #[\p{L}\p{N}_]+)*)\s*$/u);
  const split = m && m[1]!.trim();
  const body = split ? m[1]! : text;
  const hashtags = split ? m[2]!.split(" ").map((t) => t.slice(1)) : [];
  // Hook and CTA only mirror the post's own first and last paragraphs; the body stays as pasted.
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return {
    body,
    hashtags,
    hook: paras[0] ?? "",
    cta: paras.length > 1 ? paras[paras.length - 1]! : "",
  };
}

export function countedText(fields: ContentFields): string {
  const tags = fields.hashtags.length
    ? "\n\n" + fields.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")
    : "";
  return `${fields.body}${tags}`;
}

/** Every piece of text in the item, for checks. */
export function allText(fields: ContentFields): string {
  return [
    fields.subject_line,
    fields.h1,
    fields.hook,
    fields.body,
    fields.cta,
    fields.first_2s_hook,
    ...(fields.on_screen_text ?? []),
    ...(fields.h2s ?? []),
    fields.meta_description,
    ...(fields.faq ?? []).flatMap((f) => [f.question, f.answer]),
    ...(fields.carousel_slides ?? []).flatMap((s) => [s.headline, s.supporting_line]),
  ]
    .filter(Boolean)
    .join("\n");
}
