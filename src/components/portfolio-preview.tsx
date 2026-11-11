import { Fragment } from "react";
import type { ContentFields } from "@/lib/content-types";
import type { FlagSpan } from "@/lib/highlight";
import { HighlightedText } from "@/components/highlighted-text";

// Render the narrow writing format as React text, never as injected HTML.
function emphasis(text: string, marks: FlagSpan[]) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={i}><HighlightedText text={part.slice(2, -2)} spans={marks} /></strong> : <Fragment key={i}><HighlightedText text={part} spans={marks} /></Fragment>);
}

export function PortfolioPreview({ fields, spans = [] }: { fields: ContentFields; spans?: FlagSpan[] }) {
  const emphasisOf = (text: string) => emphasis(text, spans);
  return <section aria-label="Project page preview" className="space-y-5 border-b border-border pb-6">
    <h2 className="font-heading text-3xl leading-tight"><HighlightedText text={fields.h1 ?? ""} spans={spans} /></h2>
    {fields.body.split(/\n\s*\n/).filter(Boolean).map((block, i) => {
      if (/^### /.test(block)) { const [heading, ...entries] = block.split("\n"); return <div key={i} className="space-y-2"><h4 className="font-sans text-base font-semibold">{emphasisOf((heading ?? "").replace(/^### /, ""))}</h4>{entries.map((entry, j) => <p key={j} className="text-sm leading-relaxed">{emphasisOf(entry)}</p>)}</div>; }
      if (/^## /.test(block) && !block.includes("\n")) return <h3 key={i} className="pt-3 font-heading text-xl">{emphasisOf(block.slice(3))}</h3>;
      if (/^(?:- |• )/.test(block)) return <ul key={i} className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{block.split("\n").map((line, j) => <li key={j}>{emphasisOf(line.replace(/^\s*(?:- |• )(?:\[x\] )?/i, ""))}</li>)}</ul>;
      return <p key={i} className="whitespace-pre-line text-sm leading-relaxed">{emphasisOf(block)}</p>;
    })}
  </section>;
}