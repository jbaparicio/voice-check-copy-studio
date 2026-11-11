import { PublishButton } from "@/components/publish-dialog";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteDraftButton } from "@/components/delete-draft";
import { useMemo } from "react";
import { ArrowLeft, Folder, CheckCircle2, Copy, Download, Library, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, HelpTip, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { plainCopy } from "@/components/result-card";
import { StatusBadge, formatDate } from "@/components/review-panel";
import { CHANNELS, getChannel } from "@/lib/channels";
import type { ContentFields } from "@/lib/content-types";
import { useActiveBrand, useBrandKit } from "@/lib/use-brand";
import { useNames } from "@/lib/use-team";
import { groupTopics } from "@/lib/library-topics";
import { STATUS_LABEL, STATUS_ORDER, toCsv } from "@/lib/workflow";

const DATES = { all: "Any time", "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" };
type DateRange = keyof typeof DATES;

interface LibrarySearch {
  topic?: string | undefined;
  q?: string | undefined;
  channel?: string | undefined;
  status?: string | undefined;
  persona?: string | undefined;
  goal?: string | undefined;
  date?: DateRange | undefined;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: (s: Record<string, unknown>): LibrarySearch => ({
    topic: str(s["topic"]),
    q: str(s["q"]),
    channel: str(s["channel"]),
    status: str(s["status"]),
    persona: str(s["persona"]),
    goal: str(s["goal"]),
    date: typeof s["date"] === "string" && s["date"] in DATES ? (s["date"] as DateRange) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Library — Brand Voice Studio" },
      {
        name: "description",
        content: "Find, filter, review and export everything your team has written.",
      },
      { property: "og:title", content: "Library — Brand Voice Studio" },
      {
        property: "og:description",
        content: "Find, filter, review and export everything your team has written.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function download(name: string, text: string) {
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function LibraryPage() {
  const { brand } = useActiveBrand();
  const kit = useBrandKit(brand?.id);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const set = (patch: Partial<LibrarySearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const { q = "", channel = "all", status = "all", persona = "all", goal = "all" } = search;
  const date: DateRange = search.date ?? "all";

  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ["library", brand?.id],
    enabled: Boolean(brand?.id),
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id, request_id, channel, fields, status, brand_score, created_at, created_by, approved_by, approved_at, variant_of, content_requests(brief, created_at, persona_id, goal_id)",
        )
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
;
      if (error) throw error;
      return data;
    },
  });
  const names = useNames((items.data ?? []).flatMap((i) => [i.approved_by, i.created_by]));

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const since = date === "all" ? 0 : Date.now() - Number(date) * 86_400_000;
    return (items.data ?? []).filter((i) => {
      const f = i.fields as unknown as ContentFields;
      const req = i.content_requests;
      if (channel !== "all" && i.channel !== channel) return false;
      if (status !== "all" && i.status !== status) return false;
      if (persona !== "all" && req?.persona_id !== persona) return false;
      if (goal !== "all" && req?.goal_id !== goal) return false;
      if (since && new Date(i.created_at).getTime() < since) return false;
      if (
        term &&
        !`${f.body} ${f.h1 ?? ""} ${f.subject_line ?? ""} ${f.hashtags?.join(" ") ?? ""} ${req?.brief ?? ""}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [items.data, q, channel, status, persona, goal, date]);

  const topics = useMemo(() => groupTopics(items.data ?? []), [items.data]);
  const matchingIds = new Set(filtered.map(i => i.id));
  const visibleTopics = topics.filter(t => t.pieces.some(i => matchingIds.has(i.id)));
  const activeTopic = topics.find(t => t.id === search.topic);
  const visiblePieces = activeTopic?.pieces.filter(i => matchingIds.has(i.id)) ?? [];
  const approved = filtered.filter((i) => i.status === "approved");
  const hasFilters = Boolean(
    q ||
    channel !== "all" ||
    status !== "all" ||
    persona !== "all" ||
    goal !== "all" ||
    date !== "all",
  );

  function exportCsv() {
    const personaName = new Map((kit.data?.personas ?? []).map((p) => [p.id, p.name]));
    const goalName = new Map((kit.data?.goals ?? []).map((g) => [g.id, g.name]));
    const rows = approved.map((i) => {
      const f = i.fields as unknown as ContentFields;
      return [
        brand?.name,
        getChannel(i.channel).label,
        f.subject_line ?? f.h1 ?? "",
        plainCopy({ ...f, subject_line: null, h1: null, hashtags: [] }),
        (f.hashtags ?? []).map((h) => `#${h}`).join(" "),
        f.cta,
        personaName.get(i.content_requests?.persona_id ?? "") ?? "",
        goalName.get(i.content_requests?.goal_id ?? "") ?? "",
        i.brand_score ?? "",
        names.data?.get(i.approved_by ?? "") ?? "",
        i.approved_at ? new Date(i.approved_at).toISOString().slice(0, 10) : "",
        new Date(i.created_at).toISOString().slice(0, 10),
      ];
    });
    const csv = toCsv(
      [
        "Brand",
        "Channel",
        "Subject or headline",
        "Copy",
        "Hashtags",
        "Call to action",
        "Persona",
        "Goal",
        "Brand score",
        "Approved by",
        "Approved on",
        "Written on",
      ],
      rows,
    );
    const slug = (brand?.name ?? "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    download(`${slug}-approved-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${rows.length} approved piece${rows.length === 1 ? "" : "s"}.`);
  }

  return (
    <div>
      <PageHeader
        title="Library"
        description="Everything written for this brand. Search, filter, review and approve, then export what's approved."
        actions={
          <>
            <Button asChild>
              <Link to="/publish">
                <Send className="size-4" aria-hidden="true" /> Publish approved
              </Link>
            </Button>
            <Button onClick={exportCsv} disabled={!approved.length} variant="outline">
              <Download className="size-4" aria-hidden="true" /> Export approved as CSV
              {approved.length > 0 && ` (${approved.length})`}
            </Button>
          </>
        }
      />
      <div className="space-y-6 px-5 py-6 md:px-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[2fr_repeat(5,1fr)]">
          <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Search content"
              value={q}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Search by text or brief…"
              className="pl-9"
            />
          </div>
          <Filter
            label="Channel"
            all="All channels"
            value={channel}
            onChange={(v) => set({ channel: v === "all" ? undefined : v })}
            options={CHANNELS.map((c) => ({ v: c.id, l: c.short }))}
          />
          <Filter
            label="Status"
            all="All statuses"
            value={status}
            onChange={(v) => set({ status: v === "all" ? undefined : v })}
            options={STATUS_ORDER.map((v) => ({ v, l: STATUS_LABEL[v] }))}
          />
          <Filter
            label="Persona"
            all="All personas"
            value={persona}
            onChange={(v) => set({ persona: v === "all" ? undefined : v })}
            options={(kit.data?.personas ?? []).map((p) => ({ v: p.id, l: p.name }))}
          />
          <Filter
            label="Goal"
            all="All goals"
            value={goal}
            onChange={(v) => set({ goal: v === "all" ? undefined : v })}
            options={(kit.data?.goals ?? []).map((g) => ({ v: g.id, l: g.name }))}
          />
          <Filter
            label="Date"
            all="Any time"
            value={date}
            onChange={(v) => set({ date: v === "all" ? undefined : (v as DateRange) })}
            options={Object.entries(DATES)
              .filter(([v]) => v !== "all")
              .map(([v, l]) => ({ v, l }))}
          />
        </div>

        {items.data && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p aria-live="polite">
              {visibleTopics.length} topics · {filtered.length} of {items.data.length} pieces
              <HelpTip>
                The CSV export includes only the approved pieces that match your filters, as plain
                text that's ready to paste.
              </HelpTip>
            </p>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ search: { topic: search.topic }, replace: true })}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {search.topic && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="min-w-0">
              <Button variant="ghost" size="sm" onClick={() => set({ topic: undefined })}>
                <ArrowLeft className="size-4" /> All topics
              </Button>
              <h2 className="mt-2 break-words text-2xl">{activeTopic?.title ?? "Topic not found"}</h2>
              {activeTopic && <p className="mt-1 text-sm text-muted-foreground">{activeTopic.pieces.length} pieces · {formatDate(activeTopic.date)}</p>}
            </div>
            {activeTopic && <DeleteDraftButton brandId={brand?.id} requestId={activeTopic.requestId ?? undefined}
              itemId={activeTopic.requestId ? undefined : activeTopic.pieces[0]?.id} pieceCount={activeTopic.pieces.length}
              onDeleted={() => set({ topic: undefined })} />}
          </div>
        )}
        {items.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : items.error ? (
          <p role="alert" className="text-destructive">We couldn't load the Library. Please refresh.</p>
        ) : !(search.topic ? visiblePieces.length : visibleTopics.length) ? (
          <EmptyState
            icon={<Library className="size-5" />}
            title={items.data?.length ? "Nothing matches those filters" : "Nothing written yet"}
            action={
              !items.data?.length && (
                <Button asChild>
                  <Link to="/create">Create your first post</Link>
                </Button>
              )
            }
          >
            {items.data?.length
              ? "Try clearing a filter or searching for something else."
              : "Everything you generate is saved here automatically."}
          </EmptyState>
        ) : !search.topic ? (
          <ul className="space-y-3">
            {visibleTopics.map(topic => (
              <li key={topic.id} className="flex items-center gap-4 rounded-lg border bg-card p-5 shadow-card">
                <Folder className="size-6 shrink-0 text-primary" aria-hidden="true" />
                <Link to="/library" search={{ ...search, topic: topic.id }} className="min-w-0 flex-1">
                  <h2 className="break-words font-sans text-lg font-semibold text-foreground">{topic.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(topic.date)} · {topic.pieces.length} {topic.pieces.length === 1 ? "piece" : "pieces"} · {[...new Set(topic.pieces.map(i => getChannel(i.channel).label))].join(", ")}</p>
                  <p className="mt-1 text-sm">{topic.pieces.filter(i => i.status === "approved").length} approved · {topic.pieces.filter(i => i.status === "in_review").length} in review</p>
                </Link>
                <DeleteDraftButton brandId={brand?.id} requestId={topic.requestId ?? undefined}
                  itemId={topic.requestId ? undefined : topic.pieces[0]?.id} pieceCount={topic.pieces.length} iconOnly
                  onDeleted={() => {}} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visiblePieces.map((i) => {
              const f = i.fields as unknown as ContentFields;
              return (
                <article
                  key={i.id}
                  className="relative flex flex-col rounded-lg border bg-card p-5 shadow-card transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getChannel(i.channel).short}</Badge>
                    <StatusBadge status={i.status} />
                    {i.variant_of && <Badge variant="secondary">Alternative</Badge>}
                    {i.brand_score !== null && (
                      <span className="ml-auto text-sm font-semibold">Score {i.brand_score}</span>
                    )}
                  </div>
                  <h3 className="font-sans font-semibold">
                    <Link
                      to="/library/$itemId"
                      params={{ itemId: i.id }}
                      className="after:absolute after:inset-0 focus:outline-none"
                    >
                      {f.h1 || f.subject_line || f.hook?.slice(0, 80) || "Untitled"}
                    </Link>
                  </h3>
                  <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                    {f.body}
                  </p>
                  {i.status === "approved" && i.approved_at && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Approved by {names.data?.get(i.approved_by ?? "") ?? "an approver"},{" "}
                      {formatDate(i.approved_at)}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span>
                      {names.data?.get(i.created_by) ?? "Someone"} ·{" "}
                      <time dateTime={i.created_at}>{formatDate(i.created_at)}</time>
                    </span>
                    <span className="flex gap-2">
                      <DeleteDraftButton
                        itemId={i.id}
                        brandId={brand?.id}
                        status={i.status}
                        iconOnly
                        className="relative z-10 size-8 text-muted-foreground hover:text-destructive"
                        onDeleted={() => {
                          void qc.invalidateQueries({ queryKey: ["library"] });
                          void qc.invalidateQueries({ queryKey: ["dashboard"] });
                        }}
                      />
                      {brand && (
                        <PublishButton
                          item={{
                            id: i.id,
                            brand_id: brand.id,
                            channel: i.channel,
                            status: i.status,
                          }}
                          text={plainCopy(f)}
                          className="relative z-10"
                        />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="relative z-10"
                        onClick={async () => {
                          await navigator.clipboard.writeText(plainCopy(f));
                          toast.success("Copied as plain text.");
                        }}
                      >
                        <Copy className="size-3.5" aria-hidden="true" /> Copy
                      </Button>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Filter({
  label,
  all,
  value,
  onChange,
  options,
}: {
  label: string;
  all: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
