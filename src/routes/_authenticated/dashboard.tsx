import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock,
  Facebook,
  FileText,
  Instagram,
  Linkedin,
  Mail,
  Music2,
  Newspaper,
  PenLine,
  Twitter,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, HelpTip } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/review-panel";
import { QuickStart } from "@/components/quick-start";
import { getChannel } from "@/lib/channels";
import type { ContentFields } from "@/lib/content-types";
import { useActiveBrand } from "@/lib/use-brand";
import { useNames, useTeams } from "@/lib/use-team";
import { describeActivity } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Brand Voice Studio" },
      {
        name: "description",
        content:
          "Your work queue: what needs review, your drafts and what's approved, plus recent activity.",
      },
      { property: "og:title", content: "Home — Brand Voice Studio" },
      {
        property: "og:description",
        content:
          "Your work queue: what needs review, your drafts and what's approved, plus recent activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const DAY = 86_400_000;

function timeAgo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  let prev = 1;
  for (const [limit, unit] of steps) {
    if (abs < limit) return rtf.format(Math.round(diff / prev), unit);
    prev = limit;
  }
  return rtf.format(Math.round(diff / 31557600), "year");
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [items, activity] = await Promise.all([
        supabase
          .from("content_items")
          .select(
            "id, brand_id, channel, fields, status, brand_score, created_at, created_by, approved_at, variant_of",
          )
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("activity_log")
          .select("id, action, actor, content_item_id, brand_id, created_at, details")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (items.error) throw items.error;
      if (activity.error) throw activity.error;
      return { items: items.data, activity: activity.data };
    },
  });
}

const CHANNEL_ICON: Record<string, LucideIcon> = {
  linkedin: Linkedin,
  instagram: Instagram,
  tiktok: Music2,
  x: Twitter,
  facebook: Facebook,
  blog: FileText,
  newsletter: Newspaper,
  case_study: BriefcaseBusiness,
  email: Mail,
};

/** A one-line title, cut at a word boundary. */
function titleOf(f: ContentFields, max = 64) {
  const raw = (f.h1 || f.subject_line || f.hook || f.body || "").replace(/\s+/g, " ").trim();
  if (!raw) return "Untitled";
  if (raw.length <= max) return raw;
  const cut = raw.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

type QueueTab = "review" | "drafts" | "approved";

function Dashboard() {
  const { profile, brand: activeBrand } = useActiveBrand();
  const teams = useTeams();
  const data = useDashboardData();
  // Everything on Home is for the brand chosen in "Writing for".
  const items = (data.data?.items ?? []).filter((i) => i.brand_id === activeBrand?.id);
  const activity = (data.data?.activity ?? []).filter((a) => a.brand_id === activeBrand?.id);
  const names = useNames([...items.map((i) => i.created_by), ...activity.map((a) => a.actor)]);
  const me = teams.data?.me;
  const myTeams = teams.data?.teams ?? [];

  const now = Date.now();
  const thisWeek = items.filter((i) => now - new Date(i.created_at).getTime() < 7 * DAY).length;
  const lastWeek = items.filter((i) => {
    const age = now - new Date(i.created_at).getTime();
    return age >= 7 * DAY && age < 14 * DAY;
  }).length;
  const approverWs = new Set(
    myTeams.filter((t) => t.myRoles.includes("approver")).map((t) => t.workspaceId),
  );
  const isApprover = activeBrand ? approverWs.has(activeBrand.workspace_id) : false;

  // Each piece sits in exactly one tab.
  const review = items.filter((i) => i.status === "in_review");
  const drafts = items.filter((i) => i.status === "draft" || i.status === "changes_requested");
  const approved = items.filter((i) => i.status === "approved");
  const forMe = isApprover ? review : [];
  const myChanges = items.filter((i) => i.status === "changes_requested" && i.created_by === me);

  const approvedMonth = approved.filter(
    (i) => i.approved_at && now - new Date(i.approved_at).getTime() < 30 * DAY,
  ).length;
  const scored = items.filter(
    (i) => i.brand_score !== null && now - new Date(i.created_at).getTime() < 30 * DAY,
  );
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, i) => s + (i.brand_score ?? 0), 0) / scored.length)
    : null;

  const [picked, setPicked] = useState<QueueTab | null>(null);
  const tab: QueueTab = picked ?? (review.length > 0 ? "review" : "drafts");

  const firstName = profile?.display_name?.split(" ")[0] ?? "";
  const loading = data.isLoading || teams.isLoading;
  const delta = thisWeek - lastWeek;

  const list = (rows: typeof items, status: string) => (
    <>
      <ul className="divide-y">
        {rows.slice(0, 8).map((i) => (
          <QueueRow key={i.id} item={i} who={names.data?.get(i.created_by)} />
        ))}
      </ul>
      {rows.length > 8 && (
        <div className="border-t px-4 py-2.5 text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/library" search={{ status }}>
              See all {rows.length} in the library{" "}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="px-5 py-8 md:px-10">
      {/* Header: who, when, and the one main action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-1 text-3xl font-medium md:text-4xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {loading
              ? "Getting your overview ready…"
              : forMe.length
                ? `${forMe.length} piece${forMe.length === 1 ? "" : "s"} waiting for your approval.`
                : myChanges.length
                  ? `${myChanges.length} of your pieces need${myChanges.length === 1 ? "s" : ""} changes.`
                  : "You're all caught up."}
          </p>
        </div>
        <Button asChild>
          <Link to="/create">
            <PenLine className="size-4" aria-hidden="true" /> Create content
          </Link>
        </Button>
      </div>

      {/* Quick start: type an idea, pick options, get drafts */}
      <QuickStart />

      {/* Key numbers, compact */}
      <section
        aria-label="Key numbers"
        className="mt-6 flex flex-wrap items-stretch gap-y-3 divide-x border-y py-3"
      >
        <Stat
          loading={loading}
          label="Drafted this week"
          value={thisWeek}
          note={lastWeek || thisWeek ? `${delta >= 0 ? "+" : ""}${delta} vs last week` : undefined}
          to="/library"
          search={{ date: "7" }}
        />
        <Stat
          loading={loading}
          label="Waiting for review"
          value={review.length}
          to="/library"
          search={{ status: "in_review" }}
        />
        <Stat
          loading={loading}
          label="Approved (30 days)"
          value={approvedMonth}
          note="Approved, ready to export"
          to="/library"
          search={{ status: "approved" }}
        />
        <Stat
          loading={loading}
          label="Avg brand score"
          value={avgScore ?? "–"}
          help="How well recent drafts match your Brand Kit, out of 100. Above 85 is great."
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Work queue */}
        <section aria-labelledby="queue-h" className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setPicked(v as QueueTab)}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="queue-h" className="font-sans text-base font-semibold">
                Your queue
              </h2>
              <TabsList>
                <TabsTrigger value="review">Needs review ({review.length})</TabsTrigger>
                <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
              </TabsList>
            </div>
            <div className="rounded-xl border bg-card">
              {loading ? (
                <Rows />
              ) : (
                <>
                  <TabsContent value="review" className="mt-0">
                    {review.length ? (
                      list(review, "in_review")
                    ) : (
                      <p className="px-4 py-6 text-sm text-muted-foreground">
                        Nothing waiting for you.{" "}
                        <button
                          type="button"
                          onClick={() => setPicked("drafts")}
                          className="font-medium text-primary underline"
                        >
                          See drafts
                        </button>
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="drafts" className="mt-0">
                    {drafts.length ? (
                      list(drafts, "draft")
                    ) : (
                      <EmptyState
                        icon={<PenLine className="size-5" />}
                        title="No drafts right now"
                        action={
                          <Button asChild>
                            <Link to="/create">Write a post</Link>
                          </Button>
                        }
                      >
                        New drafts show up here as soon as they're written.
                      </EmptyState>
                    )}
                  </TabsContent>
                  <TabsContent value="approved" className="mt-0">
                    {approved.length ? (
                      list(approved, "approved")
                    ) : (
                      <p className="px-4 py-6 text-sm text-muted-foreground">
                        Nothing approved yet. Approved pieces appear here, ready to export or
                        publish.
                      </p>
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </section>

        {/* Activity */}
        <aside aria-labelledby="activity-h">
          <h2
            id="activity-h"
            className="mb-3 flex h-9 items-center gap-2 font-sans text-base font-semibold"
          >
            <Clock className="size-4 text-primary" aria-hidden="true" /> Recent activity
          </h2>
          {loading ? (
            <Rows n={3} />
          ) : !activity.length ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {activity.map((a) => {
                const who = (
                  <span className="font-medium">{names.data?.get(a.actor ?? "") ?? "Someone"}</span>
                );
                return (
                  <li key={a.id} className="text-sm">
                    {a.content_item_id ? (
                      <Link
                        to="/library/$itemId"
                        params={{ itemId: a.content_item_id }}
                        className="hover:underline"
                      >
                        {who} {describeActivity(a.action)}
                      </Link>
                    ) : (
                      <span>
                        {who} {describeActivity(a.action)}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  to,
  search,
  help,
  loading,
}: {
  label: string;
  value: number | string;
  note?: string | undefined;
  to?: "/library";
  search?: { status?: string; date?: "7" | "30" | "90" };
  help?: string;
  loading: boolean;
}) {
  const body = (
    <>
      <span className="flex h-5 items-center gap-1 text-xs text-muted-foreground">
        {label}
        {help && <HelpTip>{help}</HelpTip>}
      </span>
      <span className="mt-0.5 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-6 w-10" />
        ) : (
          <span className="text-xl font-semibold tabular-nums">{value}</span>
        )}
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
    </>
  );
  const cls = "flex flex-col justify-center px-5 first:pl-0";
  return to ? (
    <Link
      to={to}
      search={search ?? {}}
      className={cn(
        cls,
        "rounded-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-success-soft text-success"
      : score >= 65
        ? "bg-warning-soft text-warning"
        : "bg-destructive-soft text-destructive";
  return (
    <span
      className={cn(
        "hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums sm:inline",
        tone,
      )}
    >
      Score {score}
    </span>
  );
}

function QueueRow({
  item,
  who,
}: {
  item: {
    id: string;
    channel: string;
    fields: unknown;
    status: string;
    brand_score: number | null;
    created_at: string;
  };
  who: string | undefined;
}) {
  const f = item.fields as ContentFields;
  const Icon = CHANNEL_ICON[item.channel] ?? FileText;
  const action = item.status === "in_review" ? "Review" : "Open";
  return (
    <li>
      <Link
        to="/library/$itemId"
        params={{ itemId: item.id }}
        className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{getChannel(item.channel).short}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{titleOf(f)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {who ?? "Someone"} · {timeAgo(item.created_at)}
          </span>
        </span>
        {item.brand_score !== null && <ScorePill score={item.brand_score} />}
        <StatusBadge status={item.status} />
        <span className="hidden w-14 shrink-0 text-right text-sm font-medium text-primary md:inline">
          {action}
        </span>
      </Link>
    </li>
  );
}

function Rows({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
