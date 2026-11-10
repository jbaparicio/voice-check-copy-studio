/**
 * The curated list of writing models people can pick per draft.
 * Browser-safe: labels, plain-language guidance and rough costs only.
 * Costs are rough estimates for one channel draft (~3,000 words of brand
 * context in, ~1,400 out), based on the workspace's current credit rates.
 */
export type WriterProvider = "openai" | "anthropic" | "google";

export interface WriterModel {
  id: string;
  name: string;
  maker: string;
  provider: WriterProvider;
  /** Short plain-language tagline. */
  tagline: string;
  /** When to pick it. */
  bestFor: string;
  /** 1 = cheapest, 4 = priciest. */
  costLevel: 1 | 2 | 3 | 4;
  /** Rough credits for one channel draft. */
  creditsPerDraft: number;
  speed: "Fast" | "Medium" | "Slower";
}

export const DEFAULT_WRITER_MODEL = "openai/gpt-6-astra";

export const WRITER_MODELS: WriterModel[] = [
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini Flash",
    maker: "Google",
    provider: "google",
    tagline: "Quick and thrifty",
    bestFor: "First ideas, lots of channels at once, and trying several angles cheaply.",
    costLevel: 1,
    creditsPerDraft: 0.03,
    speed: "Fast",
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet",
    maker: "Anthropic",
    provider: "anthropic",
    tagline: "Natural, human-sounding",
    bestFor: "Warm storytelling, LinkedIn posts, newsletters and everyday copy.",
    costLevel: 2,
    creditsPerDraft: 0.08,
    speed: "Medium",
  },
  {
    id: "anthropic/claude-opus-5-5",
    name: "Claude Opus",
    maker: "Anthropic",
    provider: "anthropic",
    tagline: "Polished long-form",
    bestFor: "Blog posts, case studies and pieces where every sentence matters.",
    costLevel: 3,
    creditsPerDraft: 0.16,
    speed: "Slower",
  },
  {
    id: "openai/gpt-6-astra",
    name: "GPT-6 Astra",
    maker: "OpenAI",
    provider: "openai",
    tagline: "Most careful with rules",
    bestFor: "Strict brand rules, facts and numbers, announcements that must be exactly right.",
    costLevel: 4,
    creditsPerDraft: 0.3,
    speed: "Medium",
  },
];

const MODEL_MAP = new Map(WRITER_MODELS.map((m) => [m.id, m]));

export function isWriterModel(id: unknown): id is string {
  return typeof id === "string" && MODEL_MAP.has(id);
}

export function getWriterModel(id: string | null | undefined): WriterModel {
  return MODEL_MAP.get(id ?? "") ?? MODEL_MAP.get(DEFAULT_WRITER_MODEL)!;
}

export const COST_WORDS: Record<WriterModel["costLevel"], string> = {
  1: "Lowest cost",
  2: "Low cost",
  3: "Medium cost",
  4: "Higher cost",
};

/** "About 0.24 credits for 3 drafts" — a plain-language estimate. */
export function estimateCredits(modelId: string | null | undefined, drafts: number): string {
  const m = getWriterModel(modelId);
  const n = Math.max(1, drafts);
  const total = m.creditsPerDraft * n;
  const shown = total < 0.1 ? total.toFixed(2) : total.toFixed(1);
  return `About ${shown} credits for ${n} draft${n === 1 ? "" : "s"}`;
}
