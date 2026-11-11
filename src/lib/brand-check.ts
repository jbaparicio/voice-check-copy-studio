import { SLIDE_MAX, SLIDE_MIN } from "./carousel-count";
/**
 * Basic brand check (first version). Runs instantly without any writing service,
 * so it works in the browser after edits and on the server after generation.
 * The fuller second-pass review (tone, facts, clearance) plugs in alongside this later.
 */
import { getChannel, lengthStatus } from "./channels";
import {
  allText,
  countedText,
  type BrandCheckItem,
  type BrandCheckResult,
  type BrandKitForCheck,
  type ContentFields,
} from "./content-types";
import { findSpellingIssues, spellingLabel } from "./spelling";

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRegex(phrase: string) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase.trim())}(?![\\p{L}\\p{N}])`, "giu");
}

export function findPhrases(text: string, phrases: string[]): string[] {
  const found: string[] = [];
  for (const p of phrases) {
    if (!p.trim()) continue;
    if (phraseRegex(p).test(text)) found.push(p);
  }
  return found;
}

export function countEmoji(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

/** Em dash, en dash, or a hyphen with spaces on both sides. Hyphens inside words are left alone. */
const DASH_RE = /[ \t]*[—–][ \t]*|[ \t]+-[ \t]+/g;

export const DASH_FIX =
  "Replace every dash with a full stop or comma as fits the sentence. Change nothing else.";

export function hasDashes(text: string): boolean {
  return new RegExp(DASH_RE.source).test(text);
}

/** Swap each dash for a full stop or comma (or "to" in a number range). Touches nothing else. */
export function removeDashes(text: string): string {
  return text.replace(DASH_RE, (match, offset: number, str: string) => {
    const prev = str[offset - 1];
    const next = str[offset + match.length];
    if (prev === undefined || prev === "\n") return "";
    if (/\d/.test(prev) && next && /\d/.test(next) && match.trim() === match) return " to ";
    if (/[.,:;!?]/.test(prev)) return next === undefined || next === "\n" ? "" : " ";
    if (next === undefined || next === "\n") return ".";
    if (/\p{Lu}/u.test(next)) return ". ";
    return ", ";
  });
}

export function removeDashesFromFields(fields: ContentFields): ContentFields {
  const s = (v: string | null) => (v === null ? null : removeDashes(v));
  return {
    ...fields,
    hook: removeDashes(fields.hook),
    body: removeDashes(fields.body),
    cta: removeDashes(fields.cta),
    alt_text: s(fields.alt_text),
    subject_line: s(fields.subject_line),
    on_screen_text: fields.on_screen_text?.map(removeDashes) ?? null,
    first_2s_hook: s(fields.first_2s_hook),
    h1: s(fields.h1),
    h2s: fields.h2s?.map(removeDashes) ?? null,
    meta_description: s(fields.meta_description),
    faq:
      fields.faq?.map((f) => ({ question: removeDashes(f.question), answer: removeDashes(f.answer) })) ??
      null,
    carousel_slides: fields.carousel_slides?.map((slide) => ({ headline: removeDashes(slide.headline), supporting_line: s(slide.supporting_line) })) ?? null,
  };
}

export function runBrandCheck(
  fields: ContentFields,
  channelId: string,
  kit: BrandKitForCheck,
): BrandCheckResult {
  const channel = getChannel(channelId);
  const text = allText(fields);
  const editorial = Boolean(kit.noDashes);
  const checks: BrandCheckItem[] = [];
  if (channel.id === "instagram_carousel") {
    const slides = fields.carousel_slides ?? [];
    const valid = slides.length >= SLIDE_MIN && slides.length <= SLIDE_MAX && slides.every((s) => s.headline.trim() && s.headline.length <= 80 && (s.supporting_line?.length ?? 0) <= 140);
    checks.push({ id: "carousel", label: "Phone-readable carousel slides", status: valid ? "pass" : "fail", message: valid ? `${slides.length} ordered slides with short on-slide text.` : `Use ${SLIDE_MIN} to ${SLIDE_MAX} slides, each with a headline up to 80 characters and one supporting line up to 140 characters.`, fix: valid ? undefined : "Keep the same substance but keep the same number of slides (between 3 and 10), each with a short headline (up to 80 characters) and one short supporting line (up to 140 characters). The first is a cover hook and the final is a clear call to action. Keep the caption unchanged." });
  }

  // 1. Banned words
  const banned = findPhrases(text, kit.bannedWords);
  checks.push(
    banned.length
      ? {
          id: "banned",
          label: "No banned words",
          status: "fail",
          message: `Uses ${banned.map((b) => `"${b}"`).join(", ")}, which your Brand Kit says to avoid.`,
          fix: `Rewrite only the sentences that contain ${banned.map((b) => `"${b}"`).join(", ")} so those words no longer appear. Keep everything else the same.`,
        }
      : {
          id: "banned",
          label: "No banned words",
          status: "pass",
          message: "None of your banned words or phrases appear.",
        },
  );

  // 2. Preferred terms
  const misses = kit.preferred.filter((p) => p.not && findPhrases(text, [p.not]).length);
  checks.push(
    misses.length
      ? {
          id: "preferred",
          label: "Preferred terms used",
          status: "warn",
          message: misses.map((m) => `Say "${m.say}", not "${m.not}".`).join(" "),
          fix: `Replace ${misses.map((m) => `"${m.not}" with "${m.say}"`).join(", ")}. Adjust grammar if needed and keep everything else the same.`,
        }
      : {
          id: "preferred",
          label: "Preferred terms used",
          status: "pass",
          message: "Your preferred wording is respected.",
        },
  );

  // 3. Spelling variant
  const spelling = findSpellingIssues(text, kit.spellingVariant);
  const variantName = spellingLabel(kit.spellingVariant);
  if (kit.spellingVariant !== "en-GB" && kit.spellingVariant !== "en-US") {
    checks.push({
      id: "spelling",
      label: `Spelling (${variantName})`,
      status: "pass",
      message: `Automatic spelling checks for ${variantName} are coming soon.`,
    });
  } else {
    checks.push(
      spelling.length
        ? {
            id: "spelling",
            label: `Spelling (${variantName})`,
            status: "warn",
            message: `Change ${spelling.map((s) => `"${s.found}" to "${s.suggestion}"`).join(", ")}.`,
            fix: `Change the spelling: ${spelling.map((s) => `"${s.found}" → "${s.suggestion}"`).join(", ")}. Change nothing else.`,
          }
        : {
            id: "spelling",
            label: `Spelling (${variantName})`,
            status: "pass",
            message: `Spelling matches ${variantName}.`,
          },
    );
  }

  // 4. Length
  const count = countedText(fields).length;
  // For BRS, the lower end is advice, not a reason to pad a good argument.
  // Upper ranges and platform hard limits still use the existing check.
  const ls = editorial && count > 0 && count < channel.range[0]
    ? "good"
    : lengthStatus(channel, count);
  const [min, max] = channel.range;
  const tooLong = count > max;
  checks.push({
    id: "length",
    label: "Right length for the channel",
    status: ls === "good" ? "pass" : ls === "close" ? "warn" : "fail",
    message:
      ls === "good"
        ? editorial && count < min
          ? `${count.toLocaleString("en-GB")} characters. A concise argument is fine; no need to pad it to the suggested minimum.`
          : `${count.toLocaleString("en-GB")} characters — inside the recommended ${min.toLocaleString("en-GB")}–${max.toLocaleString("en-GB")}.`
        : `${count.toLocaleString("en-GB")} characters. ${channel.short} works best between ${min.toLocaleString("en-GB")} and ${max.toLocaleString("en-GB")}${channel.hardLimit && count > channel.hardLimit ? `, and the limit is ${channel.hardLimit.toLocaleString("en-GB")}` : ""}.`,
    fix:
      ls === "good"
        ? undefined
        : tooLong
          ? `Make it shorter so it fits between ${min} and ${max} characters including hashtags.`
          : `Make it a little longer so it reaches at least ${min} characters, without adding new facts.`,
  });

  // 5. Hashtags
  const [hMin, hMax] = channel.hashtagRange;
  const hCount = fields.hashtags.length;
  if (editorial) {
    checks.push({ id: "hashtags", label: "Hashtags", status: "pass", message: "Hashtags are optional and do not affect approval." });
  } else if (hMax === 0) {
    checks.push(
      hCount
        ? {
            id: "hashtags",
            label: "Hashtags",
            status: "warn",
            message: `${channel.short} doesn't usually use hashtags. Consider removing them.`,
          }
        : {
            id: "hashtags",
            label: "Hashtags",
            status: "pass",
            message: "No hashtags, which suits this channel.",
          },
    );
  } else {
    checks.push(
      hCount >= hMin && hCount <= hMax
        ? {
            id: "hashtags",
            label: "Hashtags",
            status: "pass",
            message: `${hCount} hashtag${hCount === 1 ? "" : "s"} — a good number for ${channel.short}.`,
          }
        : {
            id: "hashtags",
            label: "Hashtags",
            status: "warn",
            message: `${hCount} hashtags. ${channel.short} usually works best with ${hMin}–${hMax}.`,
          },
    );
  }

  // 6. Emoji policy
  const emoji = countEmoji(text);
  if (kit.emojiPolicy === "none" && emoji > 0) {
    checks.push({
      id: "emoji",
      label: "Emoji policy",
      status: "fail",
      message: `Contains ${emoji} emoji, but your brand doesn't use emoji.`,
      fix: "Remove every emoji. Change nothing else.",
    });
  } else if (kit.emojiPolicy === "sparing" && emoji > 3) {
    checks.push({
      id: "emoji",
      label: "Emoji policy",
      status: "warn",
      message: `Contains ${emoji} emoji. Your brand uses emoji sparingly (up to 3).`,
      fix: "Keep at most the two most meaningful emoji and remove the rest. Change nothing else.",
    });
  } else {
    checks.push({
      id: "emoji",
      label: "Emoji policy",
      status: "pass",
      message: emoji ? `${emoji} emoji, within your brand's policy.` : "No emoji.",
    });
  }

  // 7. Exclamation marks
  const allowed = editorial ? channel.id !== "linkedin" : kit.exclamationAllowed[channel.id] ?? true;
  // Hook and CTA mirror the body: don't count those copies twice.
  const punctuationText = editorial
    ? [fields.body, fields.subject_line, fields.h1, fields.alt_text, ...(fields.on_screen_text ?? []), ...(fields.carousel_slides ?? []).flatMap((s) => [s.headline, s.supporting_line])].filter(Boolean).join("\n")
    : text;
  const bangs = (punctuationText.match(/!/g) ?? []).length;
  checks.push(
    (!allowed && bangs > 0) || (editorial && bangs > 1)
      ? {
          id: "exclamation",
          label: "Exclamation marks",
          status: "warn",
          message: editorial && allowed ? "BRS allows at most one exclamation mark on this channel." : `Uses ${bangs} exclamation mark${bangs > 1 ? "s" : ""}. Your brand doesn't use them on ${channel.short}.`,
          fix: editorial && allowed ? "Keep at most one exclamation mark. Change nothing else." : "Replace every exclamation mark with a full stop or rephrase. Change nothing else.",
        }
      : {
          id: "exclamation",
          label: "Exclamation marks",
          status: "pass",
          message: allowed ? "Fine for this channel." : "None used.",
        },
  );

  // 8. Names that must never be mentioned
  const never = findPhrases(text, kit.neverNames);
  if (never.length) {
    checks.push({
      id: "names",
      label: "Names cleared",
      status: "fail",
      message: `Mentions ${never.join(", ")}, which must never be mentioned.`,
      fix: `Remove every mention of ${never.join(", ")}. Keep everything else.`,
    });
  }

  // 9. No dashes (house rule for brands that don't use them)
  if (kit.noDashes) {
    checks.push(
      hasDashes(`${text}\n${fields.alt_text ?? ""}`)
        ? {
            id: "dashes",
            label: "No dashes",
            status: "fail",
            message: "BRS does not use dashes. Replace with a full stop, comma or colon.",
            fix: DASH_FIX,
          }
        : { id: "dashes", label: "No dashes", status: "pass", message: "No dashes used." },
    );
  }

  // 10. Placeholders someone still has to fill in or clear
  const withAlt = `${text}\n${fields.alt_text ?? ""}`;
  const placeholders = withAlt.match(/\[NEEDS CONFIRMATION[^\]]*\]/gi) ?? [];
  if (placeholders.length) {
    checks.push({
      id: "placeholders",
      label: "Needs confirmation",
      status: "warn",
      message: `${placeholders.length} detail${placeholders.length > 1 ? "s" : ""} to confirm before publishing: ${[...new Set(placeholders)].join(", ")}.`,
    });
  }
  const clearance = withAlt.match(/\[NEEDS CLEARANCE[^\]]*\]/gi) ?? [];
  if (clearance.length) {
    checks.push({
      id: "clearance",
      label: "Needs clearance",
      status: "warn",
      message: `${[...new Set(clearance)].join(", ")} — get permission to mention ${clearance.length > 1 ? "these names" : "this name"} (or remove ${clearance.length > 1 ? "them" : "it"}) before publishing.`,
    });
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const score = Math.max(0, Math.min(100, 100 - fails * 20 - warns * 8));
  return { score, checks };
}
