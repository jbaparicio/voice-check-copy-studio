// Server-only: the AI brand check (second pass on every draft).
import { z } from "zod/v4";
import { getChannel, type ChannelId } from "./channels";
import type { ContentFields } from "./content-types";
import type { BrandKit } from "./brand-kit";
import { writeStructured } from "./ai-gateway.server";
import { buildChannelPrompt, buildInstructions, type GenerationInput } from "./prompt.server";
import {
  fingerprint,
  guardSuggestion,
  scanNumbers,
  type AiReview,
  type ReviewItem,
} from "./review";

const reviewSchema = z.object({
  score: z.number(),
  summary: z.string(),
  checks: z.array(
    z.object({
      category: z.enum(["tone", "facts", "names", "superlatives", "rules"]),
      status: z.enum(["pass", "warn", "fail"]),
      label: z.string(),
      explanation: z.string(),
      span: z.string().nullable(),
      badge: z.enum(["needs_confirmation", "needs_clearance"]).nullable(),
      suggested_fix: z.string().nullable(),
    }),
  ),
});

const REVIEWER = `You are a careful brand editor. You review a marketing draft against a Brand Kit before a human approves it. You do not rewrite the whole piece; you flag specific words and suggest a replacement for only those words.

Check these five things and return at least one item for each category (a "pass" item when all is well):
1. tone — does it match the requested tone (sliders) and the voice adjectives / "we sound like" pairs?
2. facts — every number, statistic, date, client, award, quote, result or factual claim must be supported by the APPROVED FACTS or the brief (including its key facts). Anything else is unsupported: status "fail", badge "needs_confirmation". Facts marked "unverified" in the brief also get badge "needs_confirmation" (status "warn"). Text already inside a [NEEDS CONFIRMATION: …] or [NEEDS CLEARANCE: …] placeholder is fine — never flag it again.
3. names — any company, brand, venue, person or handle that is NOT on the "May be mentioned" or "Handles you may tag" list: status "warn", badge "needs_clearance". Names on the "Never mention" list: status "fail", badge "needs_clearance". The brand's own name is always fine.
4. superlatives — words like "first", "best", "biggest", "leading", "#1", "unrivalled", "world-class" are only allowed if an approved fact supports them. Unsupported ones: status "warn".
5. rules — the DO / DON'T / formatting rules (banned words, spelling and length are checked elsewhere — skip those).

For each problem, make a separate item:
- "label": a short plain-English title (max 6 words), e.g. "Unconfirmed guest number".
- "explanation": one or two plain-English sentences a non-technical marketer understands. No jargon.
- "span": the EXACT words from the draft, copied character for character (keep it short — the smallest phrase that contains the problem). null for pass items or whole-piece issues.
- "suggested_fix": the replacement text for the span only, so it reads naturally in the sentence. null when there's no span.

HONESTY RULES FOR FIXES (most important)
- Never invent facts, numbers, clients, awards, quotes or people in a fix.
- If a fix needs information that isn't in the approved facts or the brief, use a placeholder like [NEEDS CONFIRMATION: guest number] in place of the unsupported detail.
- For a name that needs clearance, either replace it with a neutral description that adds no new facts (e.g. "a client"), or with [NEEDS CLEARANCE: the name].
- For a superlative, soften it to something true (e.g. "one of the" → remove; "the best" → "a") or use [NEEDS CONFIRMATION: source for the claim].

"score" is 0–100 for how ready this is to publish against the Brand Kit: start at 100, roughly −20 per fail, −8 per warn. "summary" is one plain sentence.
Write in the brand's spelling variant.`;

export async function runAiReview(opts: {
  kit: BrandKit;
  channel: ChannelId;
  input: GenerationInput;
  fields: ContentFields;
  runId?: string | undefined;
}): Promise<AiReview> {
  const { kit, channel, input, fields } = opts;
  const sources = [
    input.brief,
    ...input.keyFacts.map((f) => f.text),
    ...kit.facts.map((f) => `${f.fact} ${f.value}`),
  ].join("\n");
  const draftText = JSON.stringify(
    Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)),
    null,
    2,
  );
  const numbers = scanNumbers(
    [
      fields.subject_line,
      fields.h1,
      fields.body,
      fields.cta,
      fields.alt_text,
      fields.meta_description,
    ]
      .filter(Boolean)
      .join("\n"),
    sources,
  );

  const prompt = `THE BRAND KIT (the writer's standing instructions)
${buildInstructions(kit)}

THE BRIEF THE WRITER WAS GIVEN
${buildChannelPrompt(kit, channel, input)}

AUTOMATIC NUMBER SCAN (a hint — double-check yourself)
${numbers.length ? numbers.map((n) => `- ${n.value}: ${n.supported ? "appears in the approved facts or brief" : "NOT found in the approved facts or brief"}`).join("\n") : "No numbers found."}

THE ${getChannel(channel).label.toUpperCase()} DRAFT TO REVIEW
${draftText}`;

  const { data } = await writeStructured({
    instructions: REVIEWER,
    prompt,
    schema: reviewSchema,
    effort: "medium",
    runId: opts.runId,
  });

  const checks: ReviewItem[] = data.checks.map((c, i) => {
    const span = c.span?.trim() ? c.span : null;
    const suggestion =
      span && c.suggested_fix !== null && c.status !== "pass"
        ? guardSuggestion(c.suggested_fix, span, sources, c.label)
        : null;
    return {
      id: `ai-${c.category}-${i}`,
      category: c.category,
      label: c.label,
      status: c.status,
      message: c.explanation,
      span,
      badge: c.badge,
      suggestion,
      fix:
        c.status === "pass"
          ? undefined
          : span
            ? `Replace "${span}" with "${suggestion ?? ""}".`
            : `${c.label}: ${c.explanation}`,
    };
  });

  return {
    score: Math.max(0, Math.min(100, Math.round(data.score))),
    summary: data.summary,
    checks,
    fingerprint: fingerprint(fields),
    reviewed_at: new Date().toISOString(),
  };
}
