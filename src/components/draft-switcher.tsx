import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Columns2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModelTag } from "@/components/model-picker";
import { StatusBadge } from "@/components/review-panel";
import { getWriterModel } from "@/lib/models";
import { emptyFields, type ContentFields } from "@/lib/content-types";
import { siblingDrafts, SIBLING_WINDOW_MS, type DraftCandidate } from "@/lib/siblings";
import { cn } from "@/lib/utils";

interface Current extends Omit<DraftCandidate, "brief"> {
  brand_id: string;
  brief: string | null;
}

export const siblingsKey = (itemId: string) => ["siblings", itemId] as const;

export function useSiblingDrafts(current: Current | null) {
  return useQuery({
    enabled: Boolean(current),
    queryKey: siblingsKey(current?.id ?? ""),
    queryFn: async () => {
      const c = current!;
      const t = Date.parse(c.created_at);
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id, channel, variant_of, request_id, created_by, created_at, writer_model, brand_score, status, fields, content_requests(brief)",
        )
        .eq("brand_id", c.brand_id)
        .eq("channel", c.channel)
        .eq("created_by", c.created_by)
        .is("variant_of", null)
        .gte("created_at", new Date(t - SIBLING_WINDOW_MS).toISOString())
        .lte("created_at", new Date(t + SIBLING_WINDOW_MS).toISOString())
        .limit(20);
      if (error) throw error;
      const rows = (data ?? []).map((r) => ({
        ...r,
        brief: r.content_requests?.brief ?? null,
        fields: { ...emptyFields(), ...(r.fields as unknown as ContentFields) },
      }));
      const me = rows.find((r) => r.id === c.id);
      return me ? siblingDrafts(me, rows) : [];
    },
  });
}

type Sibling = NonNullable<ReturnType<typeof useSiblingDrafts>["data"]>[number];

function scoreTone(score: number | null) {
  if (score === null) return "text-muted-foreground";
  return score >= 85 ? "text-success" : score >= 65 ? "text-warning" : "text-destructive";
}

/** "Claude Sonnet · 82 | Gemini Flash · 40" toggle shown when one brief has several drafts. */
export function DraftSwitcher({ currentId, drafts }: { currentId: string; drafts: Sibling[] }) {
  const [compareOpen, setCompareOpen] = useState(false);
  if (drafts.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <p className="text-sm font-medium">
        {drafts.length} drafts from this brief
        <span className="block text-xs font-normal text-muted-foreground">
          Switch between them, or read them side by side.
        </span>
      </p>
      <nav aria-label="Drafts from this brief" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {drafts.map((d) => {
          const active = d.id === currentId;
          return (
            <Link
              key={d.id}
              to="/library/$itemId"
              params={{ itemId: d.id }}
              replace
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              {d.writer_model ? getWriterModel(d.writer_model).name : "Draft"}
              {d.brand_score !== null && (
                <span className={cn("text-xs font-semibold tabular-nums", scoreTone(d.brand_score))}>
                  {d.brand_score}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <Button variant="outline" size="sm" className="ml-auto" onClick={() => setCompareOpen(true)}>
        <Columns2 className="size-3.5" aria-hidden="true" /> Side by side
      </Button>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-[min(1200px,95vw)] flex-col">
          <DialogHeader>
            <DialogTitle>Compare the drafts</DialogTitle>
            <DialogDescription>
              Same brief, different writers. Open the one you want to keep working on.
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-4 overflow-y-auto",
              drafts.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
            )}
          >
            {drafts.map((d) => (
              <article key={d.id} className="flex min-w-0 flex-col rounded-xl border bg-card">
                <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                  <ModelTag modelId={d.writer_model} />
                  <StatusBadge status={d.status} />
                  {d.brand_score !== null && (
                    <span className={cn("ml-auto text-sm font-semibold", scoreTone(d.brand_score))}>
                      Brand score {d.brand_score}
                    </span>
                  )}
                </header>
                <div className="flex-1 px-4 py-3">
                  {(d.fields.h1 || d.fields.subject_line) && (
                    <p className="mb-2 font-semibold">{d.fields.h1 || d.fields.subject_line}</p>
                  )}
                  <p className="whitespace-pre-line text-sm leading-relaxed">{d.fields.body}</p>
                  {d.fields.cta && !d.fields.body.trim().endsWith(d.fields.cta.trim()) && <p className="mt-3 text-sm font-medium">{d.fields.cta}</p>}
                  {d.fields.hashtags.length > 0 && (
                    <p className="mt-3 text-sm text-primary">
                      {d.fields.hashtags.map((h) => `#${h}`).join(" ")}
                    </p>
                  )}
                </div>
                <footer className="border-t px-4 py-3">
                  {d.id === currentId ? (
                    <Button size="sm" variant="secondary" onClick={() => setCompareOpen(false)}>
                      You're on this one
                    </Button>
                  ) : (
                    <Button size="sm" asChild onClick={() => setCompareOpen(false)}>
                      <Link to="/library/$itemId" params={{ itemId: d.id }} replace>
                        Open this one
                      </Link>
                    </Button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
