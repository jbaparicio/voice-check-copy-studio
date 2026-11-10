import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DeleteDraftButton } from "@/components/delete-draft";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultCard, plainCopy } from "@/components/result-card";
import { PublishPanel } from "@/components/publish-panel";
import { VersionHistory, versionsKey } from "@/components/version-history";
import { ReviewPanel, formatDate } from "@/components/review-panel";
import { ReviewVerdictBar } from "@/components/review-verdict";
import { DraftSwitcher, useSiblingDrafts } from "@/components/draft-switcher";
import { kitForCheck } from "@/lib/brand-kit";
import type { GeneratedItem } from "@/lib/content.functions";
import type { ChannelId } from "@/lib/channels";
import { emptyFields, type ContentFields } from "@/lib/content-types";
import { isReviewFresh, toAiReview } from "@/lib/review";
import { useBrandKit } from "@/lib/use-brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library_/$itemId")({
  head: () => ({
    meta: [
      { title: "Review a piece — Brand Voice Studio" },
      {
        name: "description",
        content: "Edit, check, approve or request changes on one piece of content.",
      },
      { property: "og:title", content: "Review a piece — Brand Voice Studio" },
      {
        property: "og:description",
        content: "Edit, check, approve or request changes on one piece of content.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { itemId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = ["item", itemId] as const;
  const item = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id, channel, fields, brand_score, flags, status, variant_of, request_id, created_by, created_at, ai_review, writer_model, approved_by, approved_at, brand_id, brands(name, workspace_id), content_requests(brief)",
        )
        .eq("id", itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const kit = useBrandKit(item.data?.brand_id);
  const row = item.data;
  const [briefOpen, setBriefOpen] = useState(false);
  const siblings = useSiblingDrafts(
    row ? { ...row, brief: row.content_requests?.brief ?? null } : null,
  );
  // Stable objects so the editor only resets when the saved text really changes.
  const fields = useMemo(
    () => (row ? { ...emptyFields(), ...(row.fields as unknown as ContentFields) } : null),
    [row?.fields],
  );
  const generated = useMemo<GeneratedItem | null>(
    () =>
      row && fields
        ? {
            id: row.id,
            channel: row.channel as ChannelId,
            fields,
            brand_score: row.brand_score,
            flags: row.flags,
            status: row.status,
            variant_of: row.variant_of,
            created_at: row.created_at,
            ai_review: toAiReview(row.ai_review),
            writer_model: row.writer_model,
          }
        : null,
    [row, fields],
  );

  // When a piece becomes approved, bring the posting buttons into view.
  const bannerRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = row?.status ?? null;
    if (prevStatus.current && prevStatus.current !== "approved" && status === "approved") {
      bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevStatus.current = status;
  }, [row?.status]);

  if (item.isLoading)
    return (
      <div className="space-y-4 px-5 py-8 md:px-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );

  if (!row || !generated)
    return (
      <div className="px-5 py-10 md:px-10">
        <EmptyState
          title="We couldn't find that piece"
          action={
            <Button asChild>
              <Link to="/library">Back to the library</Link>
            </Button>
          }
        >
          It may have been deleted, or it belongs to a team you're not in.
        </EmptyState>
      </div>
    );

  const publish = (
    <PublishPanel
      itemId={row.id}
      brandId={row.brand_id}
      channel={row.channel}
      status={row.status}
      text={plainCopy(generated.fields)}
    />
  );

  return (
    <div>
      <div className="border-b px-5 py-6 md:px-10">
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link to="/library">
            <ArrowLeft className="size-4" aria-hidden="true" /> Library
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-medium">Review and approve</h1>
          <DeleteDraftButton
            itemId={row.id}
            status={row.status}
            className="text-muted-foreground hover:text-destructive"
            onDeleted={() => {
              void qc.invalidateQueries({ queryKey: ["library"] });
              void qc.invalidateQueries({ queryKey: ["dashboard"] });
              navigate({ to: "/library" });
            }}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.brands?.name} · written {formatDate(row.created_at)}
        </p>
        <ReviewVerdictBar review={generated.ai_review} fresh={isReviewFresh(generated.ai_review, generated.fields)} />
        {row.content_requests?.brief && (
          <div className="mt-3 max-w-3xl rounded-lg border bg-muted px-3 py-2 text-sm">
            <p className={cn("whitespace-pre-line", !briefOpen && "line-clamp-2")}>
              <span className="font-medium">Brief: </span>
              <span className="text-foreground">{row.content_requests.brief}</span>
            </p>
            {row.content_requests.brief.length > 180 && (
              <button
                type="button"
                aria-expanded={briefOpen}
                onClick={() => setBriefOpen((o) => !o)}
                className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {briefOpen ? "Show less" : "Show full brief"}
              </button>
            )}
          </div>
        )}
        {(siblings.data?.length ?? 0) > 1 && (
          <div className="mt-4">
            <DraftSwitcher currentId={row.id} drafts={siblings.data!} />
          </div>
        )}
      </div>
      {row.status === "approved" && (
        <div ref={bannerRef} className="scroll-mt-4 px-5 pt-6 md:px-10">
          {publish}
        </div>
      )}
      <div className="grid gap-6 px-5 py-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {kit.data ? (
            <ResultCard
              key={row.id}
              item={generated}
              kit={kitForCheck(kit.data)}
              showWorkflow={false}
              onUpdate={() => {
                void qc.invalidateQueries({ queryKey: key });
                void qc.invalidateQueries({ queryKey: ["activity", itemId] });
                void qc.invalidateQueries({ queryKey: versionsKey(itemId) });
                void qc.invalidateQueries({ queryKey: ["siblings"] });
              }}
            />
          ) : (
            <Skeleton className="h-96 w-full" />
          )}
        </div>
        <aside className="space-y-5">
          <ReviewPanel
            item={row}
            workspaceId={row.brands?.workspace_id}
            onChanged={() => {
              void qc.invalidateQueries({ queryKey: key });
              void qc.invalidateQueries({ queryKey: ["siblings"] });
            }}
          >
            {row.status !== "approved" && publish}
            <VersionHistory
              itemId={row.id}
              channel={row.channel}
              currentFields={generated.fields}
              aiReview={row.ai_review}
              kit={kit.data ? kitForCheck(kit.data) : undefined}
              onRestored={() => {
                void qc.invalidateQueries({ queryKey: key });
                void qc.invalidateQueries({ queryKey: ["activity", itemId] });
              }}
            />
          </ReviewPanel>
        </aside>
      </div>
    </div>
  );
}
