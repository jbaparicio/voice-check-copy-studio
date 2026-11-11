import { Fragment } from "react";
import { markSpans, type FlagSpan } from "@/lib/highlight";

/** Read-only text with each flagged phrase marked in the highlight colour. */
export function HighlightedText({ text, spans }: { text: string; spans: FlagSpan[] }) {
  return <>{markSpans(text, spans).map((p, i) => p.flagId
    ? <mark key={i} data-flag-id={p.flagId} className="scroll-mt-24 rounded-sm bg-highlight px-0.5 text-foreground transition-shadow">{p.text}</mark>
    : <Fragment key={i}>{p.text}</Fragment>)}</>;
}
