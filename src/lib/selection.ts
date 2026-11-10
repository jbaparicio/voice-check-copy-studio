/**
 * "Highlight words and ask for a change": pure helpers shared by the browser and server.
 * Only the highlighted range is ever replaced — the rest of the text stays byte-for-byte.
 */
export const SELECTABLE_FIELDS = ["body", "hook", "cta"] as const;
export type SelectableField = (typeof SELECTABLE_FIELDS)[number];

export interface TextRange {
  start: number;
  end: number;
}

/**
 * Find the highlighted words in the current text. Trusts the given offsets when they
 * still match; otherwise falls back to the only exact occurrence. Returns null if the
 * words can't be found unambiguously.
 */
export function locateSelection(
  text: string,
  start: number,
  end: number,
  selected: string,
): TextRange | null {
  if (!selected) return null;
  if (start >= 0 && end <= text.length && text.slice(start, end) === selected) {
    return { start, end };
  }
  const first = text.indexOf(selected);
  if (first === -1) return null;
  if (text.indexOf(selected, first + 1) !== -1) return null;
  return { start: first, end: first + selected.length };
}

/** Replace exactly one range, keeping the spacing around it tidy. */
export function spliceText(text: string, range: TextRange, replacement: string): string {
  const before = text.slice(0, range.start);
  const after = text.slice(range.end);
  if (replacement === "") {
    // Removing words: avoid leaving a double space behind.
    return `${before.replace(/[ \t]+$/, "")}${/^[\s.,;:!?)]/.test(after) || !before ? "" : " "}${after.replace(/^[ \t]+/, "")}`;
  }
  return `${before}${replacement}${after}`;
}

/** Quick notes offered next to the highlight box. */
export const SELECTION_PRESETS = [
  "Make it shorter",
  "Make it punchier",
  "Say it more simply",
  "Warmer",
  "More formal",
  "Rephrase it",
] as const;
