/** Writer-selectable carousel length; null means Auto. */
export const SLIDE_MIN = 3;
export const SLIDE_MAX = 10;
export const AUTO_SLIDES: [number, number] = [4, 7];

export function normaliseSlideCount(v: unknown): number | null {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) && n >= SLIDE_MIN && n <= SLIDE_MAX ? n : null;
}

/** Slide range the writer must produce: exactly N when chosen, else the Auto range. */
export function slideRange(count: number | null | undefined): [number, number] {
  const n = normaliseSlideCount(count);
  return n ? [n, n] : AUTO_SLIDES;
}
