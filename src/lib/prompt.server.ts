// Server-only: builds the writing brief from the Brand Kit.
import { z } from "zod/v4";
import { getChannel, type ChannelId } from "./channels";
import type { ContentFields } from "./content-types";
import { exclamationMap, soundLikePairs, type BrandKit, type Example } from "./brand-kit";
import { capEmoji, slidersToInstructions, type EmojiPolicy, type SliderValues } from "./sliders";
import { spellingLabel } from "./spelling";

export const contentSchema = z.object({
  hook: z.string(),
  body: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
  alt_text: z.string().nullable(),
  subject_line: z.string().nullable(),
  on_screen_text: z.array(z.string()).nullable(),
  first_2s_hook: z.string().nullable(),
  h1: z.string().nullable(),
  h2s: z.array(z.string()).nullable(),
  meta_description: z.string().nullable(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).nullable(),
});

export const hashtagSchema = z.object({ hashtags: z.array(z.string()) });

export interface KeyFact {
  text: string;
  verified: boolean;
}

export interface GenerationInput {
  brief: string;
  keyFacts: KeyFact[];
  link: string | null;
  personaId: string | null;
  goalId: string | null;
  exampleIds: string[];
  sliders: SliderValues;
  hashtags: Partial<Record<ChannelId, number>>;
}

function list(items: string[], empty = "None set."): string {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : empty;
}

function pickExamples(kit: BrandKit, channel: ChannelId, chosen: string[]) {
  const great = kit.examples.filter((e) => e.label === "great");
  const sameChannel = great.filter((e) => e.channel === channel);
  const others = great.filter((e) => e.channel !== channel);
  const picked: Example[] = [];
  for (const id of chosen) {
    const e = kit.examples.find((x) => x.id === id && x.label === "great");
    if (e && picked.length < 3) picked.push(e);
  }
  for (const e of [...sameChannel, ...others]) {
    if (picked.length >= 3) break;
    if (!picked.includes(e)) picked.push(e);
  }
  const avoid = kit.examples.filter((e) => e.label === "avoid").slice(0, 3);
  return { picked, avoid };
}

/** The standing brand instructions shared by every call for this brand. */
export function buildInstructions(kit: BrandKit): string {
  const { brand, rules, facts, names } = kit;
  const byType = (t: string) => rules.filter((r) => r.type === t);
  const pairs = soundLikePairs(brand).filter((p) => p.we || p.never);
  const emojiPolicy = brand.emoji_policy as EmojiPolicy;

  return `You are the in-house copywriter for ${brand.name}. You write on-brand marketing copy that a human will review before anything is published.

ABOUT THE BRAND
${brand.name}: ${brand.description || "(no description yet)"}
Industry: ${brand.industry || "not set"}. Website: ${brand.website || "not set"}.
Brand story: ${brand.brand_story || "not set"}

VOICE
Voice adjectives: ${brand.voice_adjectives.join(", ") || "not set"}.
${pairs.map((p) => `We sound like: ${p.we || "-"} | We never sound like: ${p.never || "-"}`).join("\n")}

LANGUAGE
Write in ${spellingLabel(brand.spelling_variant)} (${brand.language}). Use this spelling variant consistently.
Number format: ${brand.number_format} (e.g. write twenty-five thousand as ${brand.number_format}).

RULES — DO
${list(byType("do").map((r) => r.text))}
RULES — DON'T
${list(byType("dont").map((r) => r.text))}
BANNED WORDS AND PHRASES (never use, in any form)
${list(byType("banned").map((r) => r.text))}
PREFERRED TERMS
${list(byType("preferred").map((r) => `Say "${r.text}"${r.replaces ? `, not "${r.replaces}"` : ""}`))}
FORMATTING RULES
${list(byType("formatting").map((r) => r.text))}
EMOJI POLICY: ${emojiPolicy === "none" ? "Never use emoji." : emojiPolicy === "sparing" ? "Use emoji sparingly — never more than 3 in one piece." : "Emoji are allowed."}

APPROVED FACTS (the only numbers and facts you may state as true)
${list(facts.map((f) => `${f.fact}: ${f.value}${f.source ? ` (source: ${f.source})` : ""}`))}
CLAIMS THAT NEED A SOURCE (only use if a fact above supports it)
${list(byType("needs_source").map((r) => r.text))}

NAMES
May be mentioned: ${
    names
      .filter((n) => n.status === "allowed")
      .map((n) => n.name)
      .join(", ") || "none listed"
  }
Never mention: ${
    names
      .filter((n) => n.status === "never")
      .map((n) => n.name)
      .join(", ") || "none listed"
  }
Handles you may tag: ${
    names
      .filter((n) => n.status === "tag_allowed")
      .map((n) => n.name)
      .join(", ") || "none — don't tag anyone"
  }

HONESTY RULES (most important)
- Never invent facts, numbers, statistics, clients, awards, quotes, testimonials or people.
- Only use numbers that appear in the approved facts or in the brief.
- Every fact, number, client, award, quote or person must come from the APPROVED FACTS or the brief. Anything else must be written as a [NEEDS CONFIRMATION: what is missing] placeholder instead — never a made-up stand-in.
- If something would help but isn't provided, write a clear placeholder in square brackets, e.g. [NEEDS CONFIRMATION: guest number]. Do not guess.
- Treat facts marked "unverified" in the brief as needing confirmation: include them, but follow each with [NEEDS CONFIRMATION: source].
- Never use a superlative ("first", "biggest", "#1", "leading", "best") unless an approved fact supports it.

OUTPUT FORMAT
- Plain text only. No markdown symbols (#, *, _, **). Use line breaks for structure.
- "body" is the full post/copy as it should be published, WITHOUT the hashtags.
- "hook" is the opening line(s) of the body exactly as written at the start of the body.
- "hashtags" are written without the # symbol. Make them specific and relevant to the content — never generic filler like "marketing", "business", "success", "motivation".
- "cta" is the call-to-action line, which must also appear in the body.
- Set fields that don't apply to this channel to null.`;
}

export function buildChannelPrompt(
  kit: BrandKit,
  channelId: ChannelId,
  input: GenerationInput,
): string {
  const channel = getChannel(channelId);
  const persona = kit.personas.find((p) => p.id === input.personaId);
  const goal = kit.goals.find((g) => g.id === input.goalId);
  const { picked, avoid } = pickExamples(kit, channelId, input.exampleIds);
  const sliders = {
    ...input.sliders,
    emoji: capEmoji(input.sliders.emoji, kit.brand.emoji_policy as EmojiPolicy),
  };
  const exclamationOk = exclamationMap(kit.brand)[channelId] ?? true;
  const hashtagCount = input.hashtags[channelId] ?? channel.hashtagDefault;

  const extras: string[] = [];
  if (channel.kind === "social" && channelId !== "x")
    extras.push(
      'Fill "alt_text" with a description of a suitable image for people using screen readers.',
    );
  if (channelId === "tiktok")
    extras.push(
      'Fill "on_screen_text" (3 to 6 short lines shown on the video) and "first_2s_hook" (what happens or is said in the first 2 seconds). The "body" is the caption.',
    );
  if (channel.kind === "long")
    extras.push(
      'Fill "h1" (headline with the outcome), "h2s" (section headings in order), "meta_description" (under 155 characters) and "faq" (3 questions and answers). The "body" is the full article with section headings on their own lines.',
    );
  if (channel.kind === "email") extras.push('Fill "subject_line" (under 50 characters).');

  return `Write a ${channel.label} for ${kit.brand.name}.

WHAT WE WANT TO SAY (the brief)
${input.brief}
${input.keyFacts.length ? `\nKEY FACTS FOR THIS PIECE\n${input.keyFacts.map((f) => `- ${f.text}${f.verified ? "" : " (unverified)"}`).join("\n")}` : ""}
${input.link ? `\nLINK TO INCLUDE: ${input.link}` : ""}

WHO IT'S FOR
${
  persona
    ? `${persona.name} — ${persona.role}${persona.company_type ? ` at ${persona.company_type}` : ""}.
Their goals: ${persona.goals || "-"}
Their pain points: ${persona.pain_points || "-"}
What they care about: ${persona.cares_about || "-"}
Language level: ${persona.language_level || "-"}`
    : "A general professional audience."
}

WHY (business goal)
${goal ? `${goal.name}: ${goal.description}. Desired action: ${goal.cta_type || "-"}. Success is measured by: ${goal.success_measure || "-"}.` : "Raise awareness."}

HOW IT SHOULD FEEL
${slidersToInstructions(sliders)
  .map((s) => `- ${s}`)
  .join("\n")}
- ${exclamationOk ? "Exclamation marks are allowed but use them rarely." : "Do NOT use any exclamation marks on this channel."}

CHANNEL CONVENTIONS — ${channel.label}
${channel.conventions}
Use exactly ${hashtagCount} hashtag${hashtagCount === 1 ? "" : "s"}.
${extras.join("\n")}

${picked.length ? `STYLE REFERENCES — great examples to learn from (don't copy them)\n${picked.map((e) => `[${e.channel}] ${e.title}\n${e.body}${e.notes ? `\nWhy it works: ${e.notes}` : ""}`).join("\n---\n")}` : ""}
${avoid.length ? `\nAVOID WRITING LIKE THIS\n${avoid.map((e) => `${e.body}${e.notes ? `\nWhy to avoid: ${e.notes}` : ""}`).join("\n---\n")}` : ""}`;
}

export const ADJUSTMENTS = {
  shorter: "Make it noticeably shorter while keeping the key message and call to action.",
  longer:
    "Make it a little longer with more useful detail — but don't add any new facts or numbers.",
  emotional: "Make it more emotional and story-led.",
  factual: "Make it more factual and evidence-led, using only approved facts.",
  hook: "Rewrite the opening hook so it's punchier and makes people want to read on. Keep the rest broadly the same.",
  angle: "Take a completely different angle on the same brief.",
} as const;

export type AdjustmentId = keyof typeof ADJUSTMENTS;

export function buildRevisionPrompt(
  basePrompt: string,
  current: ContentFields,
  instruction: string,
  onlyPart: boolean,
): string {
  return `${basePrompt}

CURRENT DRAFT
${JSON.stringify(current, null, 2)}

REVISION REQUEST
${instruction}
${onlyPart ? "Only change the parts needed to fix this. Keep all other wording exactly as it is." : "Return the full revised piece."}`;
}

export const replacementSchema = z.object({ replacement: z.string() });

/** Prompt for rewriting only the words a person highlighted. */
export function buildSelectionPrompt(opts: {
  channelLabel: string;
  before: string;
  selected: string;
  after: string;
  note: string;
}): string {
  return `A person is editing a ${opts.channelLabel} and highlighted some words they want changed.

TEXT JUST BEFORE THE HIGHLIGHT (do not change)
${opts.before || "(start of text)"}

HIGHLIGHTED WORDS (rewrite only these)
${opts.selected}

TEXT JUST AFTER THE HIGHLIGHT (do not change)
${opts.after || "(end of text)"}

WHAT THEY WANT
${opts.note}

Return only the new wording for the highlighted words in "replacement", so it reads naturally between the text before and after. Keep the brand voice, spelling variant and rules. Don't repeat the surrounding text. Never add facts, numbers, clients, awards, quotes or people that aren't in the approved facts or the brief — use a [NEEDS CONFIRMATION: …] placeholder instead. Plain text only, no markdown.`;
}
