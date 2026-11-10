import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/common";
import { ModelTag } from "@/components/model-picker";
import { formatDate } from "@/components/review-panel";
import { useNames } from "@/lib/use-team";
import { runBrandCheck } from "@/lib/brand-check";
import { emptyFields, type BrandKitForCheck, type ContentFields } from "@/lib/content-types";
import { combinedScore, isReviewFresh, toAiReview } from "@/lib/review";
import { cn } from "@/lib/utils";
import type { ChannelId } from "@/lib/channels";

export const versionsKey = (itemId: string) => ["versions", itemId] as const;

function sameFields(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Every saved version of a piece, newest first, with "Go back to this". */
export function VersionHistory({
  itemId,
  channel,
  currentFields,
  aiReview,
  kit,
  onRestored,
}: {
  itemId: string;
  channel: string;
  currentFields: ContentFields;
  aiReview: Json | null;
  kit: BrandKitForCheck | undefined;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const versions = useQuery({
    queryKey: versionsKey(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_versions")
        .select("id, fields, note, model, created_by, created_at")
        .eq("content_item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const names = useNames((versions.data ?? []).map((v) => v.created_by));

  async function restore(v: NonNullable<typeof versions.data>[number]) {
    if (!kit) return;
    setBusy(v.id);
    const fields = { ...emptyFields(), ...(v.fields as unknown as ContentFields) };
    const check = runBrandCheck(fields, channel as ChannelId, kit);
    const review = toAiReview(aiReview);
    const { data: item, error } = await supabase
      .from("content_items")
      .update({
        fields: fields as unknown as Json,
        brand_score: combinedScore(check.score, review, isReviewFresh(review, fields)),
        flags: check.checks as unknown as Json,
        change_note: `Went back to the version from ${formatDate(v.created_at, true)}`,
      })
      .eq("id", itemId)
      .select("brand_id")
      .single();
    if (error || !item) {
      setBusy(null);
      return void toast.error("We couldn't go back to that version. Please try again.");
    }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user)
      await supabase.from("activity_log").insert({
        brand_id: item.brand_id,
        content_item_id: itemId,
        actor: auth.user.id,
        action: "restored_version",
        details: { version: v.id, note: v.note, brand_score: check.score },
      });
    setBusy(null);
    setOpen(null);
    toast.success("Back to that version. The newer ones are still in the list.");
    onRestored();
    void versions.refetch();
  }

  const list = versions.data ?? [];
  const currentIndex = list.findIndex((v) =>
    sameFields({ ...emptyFields(), ...(v.fields as object) }, currentFields),
  );

  return (
    <section aria-label="Versions" className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-1.5 font-sans text-base font-semibold">
        <History className="size-4 text-primary" aria-hidden="true" />
        Versions
        <HelpTip>
          Every rewrite, fix and edit is saved here. Open any version to read it, and go back to it
          if you liked it better — nothing is ever lost.
        </HelpTip>
      </h2>
      {versions.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : !list.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No saved versions yet. They'll appear here as soon as you edit or rewrite this piece.
        </p>
      ) : (
        <ol className="mt-3 divide-y">
          {list.map((v, i) => {
            const f = { ...emptyFields(), ...(v.fields as unknown as ContentFields) };
            const isCurrent = i === currentIndex;
            const expanded = open === v.id;
            return (
              <li key={v.id} className="py-2.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : v.id)}
                  className="flex w-full items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <span className="line-clamp-2">{v.note.split(" · ")[0]}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          Current
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <time dateTime={v.created_at}>{formatDate(v.created_at, true)}</time>
                      {v.created_by && <>· {names.data?.get(v.created_by) ?? "Someone"}</>}
                      <ModelTag modelId={v.model} />
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <div className="mt-2 space-y-2">
                    <div className="max-h-56 overflow-y-auto rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
                      {(f.h1 || f.subject_line) && (
                        <p className="mb-1 font-semibold">{f.h1 || f.subject_line}</p>
                      )}
                      <p className="whitespace-pre-line">{f.body}</p>
                      {f.cta && <p className="mt-2 font-medium">{f.cta}</p>}
                    </div>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restore(v)}
                        disabled={Boolean(busy) || !kit}
                      >
                        {busy === v.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Undo2 className="size-3.5" aria-hidden="true" />
                        )}
                        Go back to this version
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
