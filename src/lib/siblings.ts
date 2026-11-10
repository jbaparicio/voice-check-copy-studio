/**
 * Drafts written from the same brief for the same channel (for example one by Claude and one by
 * Gemini when "Compare two writers" was on). Used to switch between them on the review page.
 */
export interface DraftCandidate {
  id: string;
  channel: string;
  variant_of: string | null;
  request_id: string | null;
  created_by: string;
  created_at: string;
  brief: string | null;
}

/** Drafts from one compare run are written within a few minutes of each other. */
export const SIBLING_WINDOW_MS = 30 * 60 * 1000;

const norm = (s: string | null) => (s ?? "").trim().replace(/\s+/g, " ");

export function isSiblingDraft(current: DraftCandidate, other: DraftCandidate): boolean {
  if (other.variant_of || current.variant_of) return false;
  if (other.channel !== current.channel) return false;
  if (other.created_by !== current.created_by) return false;
  if (current.request_id && other.request_id === current.request_id) return true;
  if (!norm(current.brief) || norm(current.brief) !== norm(other.brief)) return false;
  const gap = Math.abs(Date.parse(other.created_at) - Date.parse(current.created_at));
  return gap <= SIBLING_WINDOW_MS;
}

/** The current draft plus its siblings, oldest first (so the order matches the Create screen). */
export function siblingDrafts<T extends DraftCandidate>(current: T, candidates: T[]): T[] {
  const all = [current, ...candidates.filter((c) => c.id !== current.id && isSiblingDraft(current, c))];
  return all.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
