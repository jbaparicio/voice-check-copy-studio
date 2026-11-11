import { Fragment } from "react";
import type { ContentFields } from "@/lib/content-types";

// Render the narrow writing format as React text, never as injected HTML.
function emphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

export function PortfolioPreview({ fields }: { fields: ContentFields }) {
  return <section aria-label="Project page preview" className="space-y-5 border-b border-border pb-6">
    <h2 className="font-heading text-3xl leading-tight">{fields.h1}</h2>
    {fields.body.split(/\n\s*\n/).filter(Boolean).map((block, i) => {
      if (/^### /.test(block)) { const [heading, ...entries] = block.split("\n"); return <div key={i} className="space-y-2"><h4 className="font-sans text-base font-semibold">{emphasis((heading ?? "").replace(/^### /, ""))}</h4>{entries.map((entry, j) => <p key={j} className="text-sm leading-relaxed">{emphasis(entry)}</p>)}</div>; }
      if (/^## /.test(block) && !block.includes("\n")) return <h3 key={i} className="pt-3 font-heading text-xl">{emphasis(block.slice(3))}</h3>;
      if (/^(?:- |• )/.test(block)) return <ul key={i} className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{block.split("\n").map((line, j) => <li key={j}>{emphasis(line.replace(/^\s*(?:- |• )(?:\[x\] )?/i, ""))}</li>)}</ul>;
      return <p key={i} className="whitespace-pre-line text-sm leading-relaxed">{emphasis(block)}</p>;
    })}
  </section>;
}