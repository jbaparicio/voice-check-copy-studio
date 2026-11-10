/** American ↔ British spelling pairs used by the basic brand check. */
const BASE_PAIRS: [string, string][] = [
  ["color", "colour"],
  ["favorite", "favourite"],
  ["behavior", "behaviour"],
  ["honor", "honour"],
  ["labor", "labour"],
  ["neighbor", "neighbour"],
  ["flavor", "flavour"],
  ["humor", "humour"],
  ["rumor", "rumour"],
  ["endeavor", "endeavour"],
  ["harbor", "harbour"],
  ["center", "centre"],
  ["centered", "centred"],
  ["theater", "theatre"],
  ["liter", "litre"],
  ["catalog", "catalogue"],
  ["dialog", "dialogue"],
  ["defense", "defence"],
  ["offense", "offence"],
  ["gray", "grey"],
  ["jewelry", "jewellery"],
  ["cozy", "cosy"],
  ["mold", "mould"],
  ["aluminum", "aluminium"],
  ["traveled", "travelled"],
  ["traveling", "travelling"],
  ["traveler", "traveller"],
  ["canceled", "cancelled"],
  ["canceling", "cancelling"],
  ["modeling", "modelling"],
  ["labeled", "labelled"],
  ["labeling", "labelling"],
  ["fueled", "fuelled"],
  ["analyze", "analyse"],
  ["analyzed", "analysed"],
  ["analyzing", "analysing"],
  ["program", "programme"],
  ["skeptical", "sceptical"],
  ["enrollment", "enrolment"],
  ["fulfillment", "fulfilment"],
];

const IZE_STEMS = [
  "organ",
  "recogn",
  "real",
  "apolog",
  "priorit",
  "optim",
  "custom",
  "personal",
  "emphas",
  "summar",
  "special",
  "maxim",
  "minim",
  "categor",
  "visual",
  "util",
  "final",
  "standard",
  "modern",
  "revolution",
  "energ",
  "global",
  "local",
  "capital",
  "central",
  "critic",
  "familiar",
  "memor",
  "author",
  "harmon",
  "synchron",
  "monet",
  "mobil",
];

function izePairs(): [string, string][] {
  const out: [string, string][] = [];
  for (const stem of IZE_STEMS) {
    for (const [us, gb] of [
      ["ize", "ise"],
      ["izes", "ises"],
      ["ized", "ised"],
      ["izing", "ising"],
      ["ization", "isation"],
      ["izations", "isations"],
    ]) {
      out.push([stem + us, stem + gb]);
    }
  }
  return out;
}

export const SPELLING_PAIRS: [string, string][] = [
  ...BASE_PAIRS.flatMap(([us, gb]) => {
    const pairs: [string, string][] = [[us, gb]];
    // Simple plurals for nouns that take "s".
    if (!/(ed|ing)$/.test(us)) pairs.push([us + "s", gb + "s"]);
    return pairs;
  }),
  ...izePairs(),
];

export type SpellingVariant = "en-GB" | "en-US" | string;

export interface SpellingIssue {
  found: string;
  suggestion: string;
}

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] && source[0] === source[0].toUpperCase())
    return (target[0] ?? "").toUpperCase() + target.slice(1);
  return target;
}

/** Find words spelt in the other variant. Only English variants are checked. */
export function findSpellingIssues(text: string, variant: SpellingVariant): SpellingIssue[] {
  if (variant !== "en-GB" && variant !== "en-US") return [];
  const issues = new Map<string, SpellingIssue>();
  for (const [us, gb] of SPELLING_PAIRS) {
    const wrong = variant === "en-GB" ? us : gb;
    const right = variant === "en-GB" ? gb : us;
    const re = new RegExp(`(?<![\\p{L}#@])${wrong}(?![\\p{L}])`, "giu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = m[0].toLowerCase();
      if (!issues.has(key)) issues.set(key, { found: m[0], suggestion: matchCase(m[0], right) });
    }
  }
  return Array.from(issues.values());
}

export const SPELLING_VARIANTS: { value: string; label: string }[] = [
  { value: "en-GB", label: "British English" },
  { value: "en-US", label: "American English" },
  { value: "en-AU", label: "Australian English" },
  { value: "de-DE", label: "German" },
  { value: "fr-FR", label: "French" },
  { value: "es-ES", label: "Spanish" },
  { value: "nl-NL", label: "Dutch" },
];

export function spellingLabel(value: string): string {
  return SPELLING_VARIANTS.find((s) => s.value === value)?.label ?? value;
}

export const NUMBER_FORMATS = ["25,000", "25.000", "25 000"];
