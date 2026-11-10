import type { ChannelId } from "./channels";

/** The fields every generated piece can have. Channel-specific extras are null when unused. */
export interface ContentFields {
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
  };
}

/** The text that counts towards the channel's character range. */
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
  ]
    .filter(Boolean)
    .join("\n");
}
