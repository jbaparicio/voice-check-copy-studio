export interface FlagSpan { id: string; span: string }
export interface TextPiece { text: string; flagId: string | null }

/** Split text into plain and flagged pieces; every exact occurrence of each span is marked, earliest/longest first, never overlapping. */
export function markSpans(text: string, spans: FlagSpan[]): TextPiece[] {
  const hits: { start: number; end: number; id: string }[] = [];
  for (const { id, span } of spans) {
    if (!span.trim()) continue;
    let from = 0;
    for (let i = text.indexOf(span, from); i !== -1; i = text.indexOf(span, from)) {
      hits.push({ start: i, end: i + span.length, id });
      from = i + span.length;
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const pieces: TextPiece[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue;
    if (h.start > pos) pieces.push({ text: text.slice(pos, h.start), flagId: null });
    pieces.push({ text: text.slice(h.start, h.end), flagId: h.id });
    pos = h.end;
  }
  if (pos < text.length || !pieces.length) pieces.push({ text: text.slice(pos), flagId: null });
  return pieces;
}
