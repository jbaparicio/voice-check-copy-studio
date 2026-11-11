/** Sending approved copy to other platforms. Pure and browser-safe. */
import type { ContentFields } from "./content-types";
import { toPlainText } from "./plain-text";

/** The copy as plain text, ready to paste or post: no markdown symbols. */
export function plainCopy(f: ContentFields): string {
  const parts = [
    ...(f.carousel_slides ?? []).map((s, i) => `Slide ${i + 1}\n${s.headline}${s.supporting_line ? `\n${s.supporting_line}` : ""}`),
    f.carousel_slides?.length ? "Caption" : "",
    f.subject_line ? `Subject: ${f.subject_line}` : "",
    f.h1 ?? "",
    f.body,
    f.hashtags.length ? f.hashtags.map((h) => `#${h}`).join(" ") : "",
    f.carousel_slides?.length && f.alt_text ? `Cover alt text: ${f.alt_text}` : "",
  ].filter(Boolean);
  return toPlainText(parts.join("\n\n"));
}

/** Link to a live LinkedIn post from its id. */
export function linkedInPostUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

/** LinkedIn's own post box, opened with the text filled in. The person still presses Post. */
export function linkedInComposerUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

/** Only approved pieces can go out. */
export function canPublish(status: string): boolean {
  return status === "approved";
}

/** LinkedIn's limit for a post's text. */
export const LINKEDIN_MAX_CHARS = 3000;

/** True when the app runs inside the editor's preview frame, where LinkedIn refuses to open. */
export function inPreviewFrame(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

export type PlatformId =
  "linkedin" | "substack" | "blog" | "medium" | "x" | "instagram" | "facebook";

export interface Platform {
  id: PlatformId;
  label: string;
  /** Which of our channels fit this platform. */
  channels: string[];
  /** false = shown so the team can plan, but not connected yet. */
  live: boolean;
  hint: string;
}

export const PLATFORMS: Platform[] = [
  { id: "linkedin", label: "LinkedIn", channels: ["linkedin"], live: true, hint: "LinkedIn posts" },
  {
    id: "substack",
    label: "Substack",
    channels: ["newsletter", "blog"],
    live: false,
    hint: "newsletters and blog posts",
  },
  {
    id: "blog",
    label: "Company blog",
    channels: ["blog", "case_study"],
    live: false,
    hint: "blog posts and case studies",
  },
  {
    id: "medium",
    label: "Medium",
    channels: ["blog", "case_study"],
    live: false,
    hint: "blog posts and case studies",
  },
  { id: "x", label: "X (Twitter)", channels: ["x"], live: false, hint: "X posts" },
  {
    id: "instagram",
    label: "Instagram",
    channels: ["instagram", "instagram_carousel"],
    live: false,
    hint: "Instagram captions and carousels",
  },
  {
    id: "facebook",
    label: "Facebook",
    channels: ["facebook"],
    live: false,
    hint: "Facebook posts",
  },
];

export interface PlanRow<T> {
  item: T;
  platform: Platform;
}

/**
 * Which selected piece goes to which selected platform.
 * Only approved pieces whose channel fits the platform are included; the rest are listed as skipped.
 */
export function planPublishing<T extends { id: string; channel: string; status: string }>(
  items: T[],
  platformIds: PlatformId[],
): { rows: PlanRow<T>[]; skipped: T[] } {
  const platforms = PLATFORMS.filter((p) => platformIds.includes(p.id));
  const rows: PlanRow<T>[] = [];
  const skipped: T[] = [];
  for (const item of items) {
    const fits = canPublish(item.status)
      ? platforms.filter((p) => p.channels.includes(item.channel))
      : [];
    if (!fits.length) skipped.push(item);
    for (const platform of fits) rows.push({ item, platform });
  }
  return { rows, skipped };
}
