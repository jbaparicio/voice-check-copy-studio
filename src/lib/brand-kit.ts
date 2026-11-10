import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { BrandKitForCheck } from "./content-types";
import type { ChannelId } from "./channels";
import type { EmojiPolicy } from "./sliders";

type Tables = Database["public"]["Tables"];
export type Brand = Tables["brands"]["Row"];
export type BrandRule = Tables["brand_rules"]["Row"];
export type Fact = Tables["facts"]["Row"];
export type NameEntry = Tables["names"]["Row"];
export type Example = Tables["examples"]["Row"];
export type Persona = Tables["personas"]["Row"];
export type Goal = Tables["goals"]["Row"];
export type GuidelineFile = Tables["guideline_files"]["Row"];
export type ContentItemRow = Tables["content_items"]["Row"];

export interface BrandKit {
  brand: Brand;
  rules: BrandRule[];
  facts: Fact[];
  names: NameEntry[];
  examples: Example[];
  personas: Persona[];
  goals: Goal[];
}

export type RuleType = BrandRule["type"];

export interface SoundLikePair {
  we: string;
  never: string;
}

export function soundLikePairs(brand: Brand): SoundLikePair[] {
  const raw = Array.isArray(brand.sound_like) ? brand.sound_like : [];
  return raw
    .map((p) => p as unknown as Partial<SoundLikePair>)
    .map((p) => ({ we: String(p?.we ?? ""), never: String(p?.never ?? "") }));
}

export function exclamationMap(brand: Brand): Partial<Record<ChannelId, boolean>> {
  const raw = (brand.exclamation_channels ?? {}) as Record<string, unknown>;
  const out: Partial<Record<ChannelId, boolean>> = {};
  for (const [k, v] of Object.entries(raw)) out[k as ChannelId] = Boolean(v);
  return out;
}

export async function loadBrandKit(
  supabase: SupabaseClient<Database>,
  brandId: string,
): Promise<BrandKit> {
  const [brand, rules, facts, names, examples, personas, goals] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brandId).single(),
    supabase.from("brand_rules").select("*").eq("brand_id", brandId).order("created_at"),
    supabase.from("facts").select("*").eq("brand_id", brandId).order("created_at"),
    supabase.from("names").select("*").eq("brand_id", brandId).order("created_at"),
    supabase.from("examples").select("*").eq("brand_id", brandId).order("created_at"),
    supabase.from("personas").select("*").eq("brand_id", brandId).order("created_at"),
    supabase.from("goals").select("*").eq("brand_id", brandId).order("created_at"),
  ]);
  if (brand.error) throw new Error("We couldn't load this brand.");
  return {
    brand: brand.data,
    rules: rules.data ?? [],
    facts: facts.data ?? [],
    names: names.data ?? [],
    examples: examples.data ?? [],
    personas: personas.data ?? [],
    goals: goals.data ?? [],
  };
}

export function kitForCheck(kit: Pick<BrandKit, "brand" | "rules" | "names">): BrandKitForCheck {
  return {
    bannedWords: kit.rules.filter((r) => r.type === "banned").map((r) => r.text),
    preferred: kit.rules
      .filter((r) => r.type === "preferred" && r.replaces)
      .map((r) => ({ say: r.text, not: r.replaces ?? "" })),
    spellingVariant: kit.brand.spelling_variant,
    emojiPolicy: kit.brand.emoji_policy as EmojiPolicy,
    exclamationAllowed: exclamationMap(kit.brand),
    neverNames: kit.names.filter((n) => n.status === "never").map((n) => n.name),
    // Battle Royal Studios house rule: no dashes in copy.
    noDashes: /battle\s*royal/i.test(kit.brand.name),
  };
}
