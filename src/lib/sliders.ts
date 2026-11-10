export type SliderKey =
  "formality" | "playfulness" | "boldness" | "emotion" | "length" | "cta" | "emoji";

export type SliderValues = Record<SliderKey, number>;

export interface SliderDef {
  key: SliderKey;
  left: string;
  right: string;
  help: string;
}

/** Every slider has 5 steps: 1 (left end) to 5 (right end). */
export const SLIDERS: SliderDef[] = [
  { key: "formality", left: "Formal", right: "Casual", help: "How relaxed the language feels." },
  {
    key: "playfulness",
    left: "Serious",
    right: "Playful",
    help: "How much lightness and humour to use.",
  },
  {
    key: "boldness",
    left: "Understated",
    right: "Bold",
    help: "How strongly claims and opinions are made.",
  },
  {
    key: "emotion",
    left: "Rational (facts)",
    right: "Emotional (story)",
    help: "Lead with evidence, or with feelings and story.",
  },
  { key: "length", left: "Short & punchy", right: "Detailed", help: "How much detail to include." },
  {
    key: "cta",
    left: "Soft CTA",
    right: "Direct CTA",
    help: "How directly to ask people to take action.",
  },
  {
    key: "emoji",
    left: "No emoji",
    right: "Plenty of emoji",
    help: "Limited by your brand's emoji policy.",
  },
];

export const DEFAULT_SLIDERS: SliderValues = {
  formality: 3,
  playfulness: 3,
  boldness: 3,
  emotion: 3,
  length: 3,
  cta: 3,
  emoji: 2,
};

export function normaliseSliders(value: unknown): SliderValues {
  const v = (value ?? {}) as Partial<Record<SliderKey, unknown>>;
  const out = { ...DEFAULT_SLIDERS };
  for (const s of SLIDERS) {
    const n = Number(v[s.key]);
    if (Number.isFinite(n)) out[s.key] = Math.min(5, Math.max(1, Math.round(n)));
  }
  return out;
}

export type EmojiPolicy = "none" | "sparing" | "free";

/** The brand emoji policy caps the emoji slider. */
export function capEmoji(value: number, policy: EmojiPolicy): number {
  if (policy === "none") return 1;
  if (policy === "sparing") return Math.min(value, 3);
  return value;
}

export interface Preset {
  id: string;
  label: string;
  help: string;
  values: Partial<SliderValues>;
}

export const PRESETS: Preset[] = [
  {
    id: "announcement",
    label: "Announcement",
    help: "Clear, confident news.",
    values: { formality: 2, playfulness: 2, boldness: 4, emotion: 2, length: 2, cta: 3 },
  },
  {
    id: "behind",
    label: "Behind the scenes",
    help: "Relaxed, human, story-led.",
    values: { formality: 4, playfulness: 3, boldness: 2, emotion: 4, length: 3, cta: 1 },
  },
  {
    id: "thought",
    label: "Thought leadership",
    help: "Considered opinion backed by evidence.",
    values: { formality: 2, playfulness: 1, boldness: 4, emotion: 2, length: 4, cta: 2 },
  },
  {
    id: "celebration",
    label: "Celebration",
    help: "Warm, proud and generous.",
    values: { formality: 4, playfulness: 4, boldness: 3, emotion: 5, length: 2, cta: 1 },
  },
  {
    id: "soft",
    label: "Soft sell",
    help: "Helpful first, with a gentle ask.",
    values: { formality: 3, playfulness: 2, boldness: 2, emotion: 3, length: 3, cta: 2 },
  },
];

const WORDS: Record<SliderKey, [string, string, string, string, string]> = {
  formality: ["very formal", "polished", "", "relaxed", "very casual"],
  playfulness: ["serious", "earnest", "", "light", "playful"],
  boldness: ["understated", "quietly confident", "", "confident", "bold"],
  emotion: ["fact-led", "evidence-first", "", "story-led", "emotional"],
  length: ["very short", "short", "medium length", "detailed", "in-depth"],
  cta: [
    "no hard sell",
    "gentle call to action",
    "clear call to action",
    "direct call to action",
    "strong, direct call to action",
  ],
  emoji: ["no emoji", "almost no emoji", "a few emoji", "some emoji", "plenty of emoji"],
};

const at = (arr: readonly string[], n: number): string => arr[n - 1] ?? "";

/** One-line plain-language summary of the current mix. */
export function describeSliders(v: SliderValues, adjectives: string[] = []): string {
  const parts: string[] = [];
  const tone = [
    at(WORDS.formality, v.formality),
    at(WORDS.playfulness, v.playfulness),
    at(WORDS.boldness, v.boldness),
  ].filter(Boolean);
  const lead = adjectives.slice(0, 2).map((a) => a.toLowerCase());
  const toneWords = Array.from(new Set([...lead, ...tone]));
  if (toneWords.length) {
    const s =
      toneWords.length > 1
        ? `${toneWords.slice(0, -1).join(", ")} and ${toneWords[toneWords.length - 1]}`
        : (toneWords[0] ?? "");
    parts.push(s.charAt(0).toUpperCase() + s.slice(1));
  } else {
    parts.push("Balanced tone");
  }
  parts.push(at(WORDS.length, v.length));
  const emotion = at(WORDS.emotion, v.emotion);
  if (emotion) parts.push(emotion);
  else parts.push("a mix of facts and story");
  parts.push(at(WORDS.cta, v.cta));
  parts.push(at(WORDS.emoji, v.emoji));
  return parts.join(", ");
}

/** Turn slider positions into clear writing instructions for the writer. */
export function slidersToInstructions(v: SliderValues): string[] {
  const scale = (key: SliderKey, lines: [string, string, string, string, string]) =>
    at(lines, v[key]);
  return [
    scale("formality", [
      "Use formal, professional language. No contractions.",
      "Keep it polished and professional, with occasional contractions.",
      "Use a natural, professional-but-friendly register.",
      "Keep it relaxed and conversational.",
      "Write very casually, like talking to a friend.",
    ]),
    scale("playfulness", [
      "Be completely serious. No jokes or wordplay.",
      "Mostly serious, with a little warmth.",
      "A light touch of personality is fine.",
      "Be light and a little playful.",
      "Be playful and witty, while staying clear.",
    ]),
    scale("boldness", [
      "Be understated and modest. Let the facts speak.",
      "Be quietly confident.",
      "Be confident without overclaiming.",
      "Be confident and assertive.",
      "Be bold and opinionated (without unsupported claims).",
    ]),
    scale("emotion", [
      "Lead entirely with facts and evidence.",
      "Lead with evidence, with a little human detail.",
      "Balance facts with a short story.",
      "Lead with story and human detail, backed by a fact.",
      "Lead with emotion and story.",
    ]),
    scale("length", [
      "Keep it as short and punchy as the channel allows.",
      "Keep it on the short side of the channel's range.",
      "Aim for the middle of the channel's range.",
      "Use the upper end of the channel's range with more detail.",
      "Be detailed and thorough, within the channel's range.",
    ]),
    scale("cta", [
      "Do not hard sell. End with a gentle thought rather than an ask.",
      "Use a soft, inviting call to action.",
      "Use a clear call to action.",
      "Use a direct call to action.",
      "Use a strong, direct call to action that is impossible to miss.",
    ]),
    scale("emoji", [
      "Use no emoji at all.",
      "Use at most one emoji, only if it adds meaning.",
      "Use a few emoji where they add meaning.",
      "Use some emoji to add personality.",
      "Use plenty of emoji.",
    ]),
  ];
}
