import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Info, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/components/review-panel";
import { getChannel } from "@/lib/channels";
import { emptyFields, type ContentFields } from "@/lib/content-types";
import { PLATFORMS, linkedInPostUrl, planPublishing, type PlatformId } from "@/lib/publish";
import { getLinkedInStatus, postToLinkedIn } from "@/lib/linkedin.functions";
import { useActiveBrand } from "@/lib/use-brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/publish")({
  head: () => ({
    meta: [
      { title: "Publish — Brand Voice Studio" },
      {
        name: "description",
        content: "Pick approved pieces and the platforms to send them to, all at once.",
      },
      { property: "og:title", content: "Publish — Brand Voice Studio" },
      {
        property: "og:description",
        content: "Pick approved pieces and the platforms to send them to, all at once.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublishPage,
});

type Outcome = { state: "done" | "failed" | "planned" | "manual"; note: string; url?: string };

function PublishPage() {
  const { brand } = useActiveBrand();
  const qc = useQueryClient();
  const statusFn = useServerFn(getLinkedInStatus);
  const postFn = useServerFn(postToLinkedIn);

  const [platforms, setPlatforms] = useState<PlatformId[]>(["linkedin"]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  const linkedIn = useQuery({
    queryKey: ["linkedin-status", "account"],
    queryFn: () => statusFn({ data: {} }),
  });

  const items = useQuery({
    queryKey: ["publish-items", brand?.id],
    enabled: Boolean(brand?.id),
    queryFn: async () => {
      const [{ data, error }, posts] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, channel, fields, status, approved_at")
          .eq("brand_id", brand!.id)
          .eq("status", "approved")
          .order("approved_at", { ascending: false })
          .limit(200),
        supabase
          .from("linkedin_posts")
          .select("content_item_id, post_urn")
          .eq("brand_id", brand!.id),
      ]);
      if (error) throw error;
      const posted = new Map((posts.data ?? []).map((p) => [p.content_item_id, p.post_urn]));
      return (data ?? []).map((i) => ({
        ...i,
        fields: { ...emptyFields(), ...(i.fields as unknown as Partial<ContentFields>) },
        linkedInUrn: posted.get(i.id) ?? null,
      }));
    },
  });

  const chosen = useMemo(
    () => (items.data ?? []).filter((i) => selected.includes(i.id)),
    [items.data, selected],
  );
  const plan = useMemo(() => planPublishing(chosen, platforms), [chosen, platforms]);
  const canPost = Boolean(linkedIn.data?.canPost);

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const allIds = (items.data ?? []).map((i) => i.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  async function run() {
    setRunning(true);
    const next: Record<string, Outcome> = {};
    for (const { item, platform } of plan.rows) {
      const key = `${item.id}:${platform.id}`;
      if (!platform.live) {
        next[key] = {
          state: "planned",
          note: `${platform.label} isn't connected yet — nothing sent.`,
        };
      } else if (item.linkedInUrn) {
        next[key] = {
          state: "done",
          note: "Already on LinkedIn.",
          url: linkedInPostUrl(item.linkedInUrn),
        };
      } else if (!canPost) {
        next[key] = {
          state: "manual",
          note: "Use “Open in LinkedIn” on its page to post it yourself.",
        };
      } else {
        try {
          const res = await postFn({ data: { itemId: item.id } });
          next[key] = { state: "done", note: "Posted to LinkedIn.", url: res.url };
        } catch (e) {
          next[key] = {
            state: "failed",
            note:
              e instanceof Error
                ? e.message
                : "LinkedIn couldn't publish this. Nothing was posted.",
          };
        }
      }
      setOutcomes((o) => ({ ...o, ...next }));
    }
    setRunning(false);
    setConfirmOpen(false);
    const done = Object.values(next).filter((o) => o.state === "done").length;
    const failed = Object.values(next).filter((o) => o.state === "failed").length;
    if (failed) toast.error(`${failed} couldn't be posted. See the details below.`);
    else if (done) toast.success(`Done: ${done} live on LinkedIn.`);
    else toast("Nothing was posted. See the details below.");
    void qc.invalidateQueries({ queryKey: ["publish-items", brand?.id] });
  }

  const liveCount = plan.rows.filter(
    (r) => r.platform.live && canPost && !r.item.linkedInUrn,
  ).length;

  return (
    <div>
      <PageHeader
        title="Publish"
        description="Pick approved pieces and where they should go, then send them in one go. Nothing goes out until you press Publish."
      />
      <div className="grid gap-6 px-5 py-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="platforms-h">
            <h2 id="platforms-h" className="font-sans text-base font-semibold">
              1. Where should it go?
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlatforms((l) => toggle(l, p.id))}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{p.label}</span>
                      {p.live ? (
                        <Badge className="bg-success-soft text-success hover:bg-success-soft">
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                          Coming soon
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {p.id === "linkedin"
                        ? canPost
                          ? `Posts as ${linkedIn.data?.accountName ?? "the connected account"}`
                          : "Ask the account owner to post, or use Open in LinkedIn"
                        : `Takes ${p.hint}. Plan it now, connect later.`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="items-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="items-h" className="font-sans text-base font-semibold">
                2. Which approved pieces?
              </h2>
              {allIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(allSelected ? [] : allIds)}
                >
                  {allSelected ? "Clear selection" : "Select all"}
                </Button>
              )}
            </div>
            {items.isLoading ? (
              <Skeleton className="mt-3 h-40 w-full rounded-xl" />
            ) : !items.data?.length ? (
              <div className="mt-3">
                <EmptyState
                  title="Nothing approved yet"
                  action={
                    <Button asChild>
                      <Link to="/library">Go to the library</Link>
                    </Button>
                  }
                >
                  Pieces show up here once an approver has approved them.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-3 divide-y rounded-xl border bg-card">
                {items.data.map((i) => {
                  const title =
                    i.fields.h1 || i.fields.subject_line || i.fields.hook || i.fields.body;
                  const rowOutcomes = PLATFORMS.map((p) => ({
                    p,
                    o: outcomes[`${i.id}:${p.id}`],
                  })).filter((x) => x.o);
                  return (
                    <li key={i.id} className="flex gap-3 p-4">
                      <Checkbox
                        id={`pick-${i.id}`}
                        checked={selected.includes(i.id)}
                        onCheckedChange={() => setSelected((l) => toggle(l, i.id))}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`pick-${i.id}`} className="block cursor-pointer">
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{getChannel(i.channel).short}</Badge>
                            {i.linkedInUrn && (
                              <Badge className="bg-success-soft text-success hover:bg-success-soft">
                                On LinkedIn
                              </Badge>
                            )}
                            {i.approved_at && (
                              <span className="text-xs text-muted-foreground">
                                Approved {formatDate(i.approved_at)}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-sm">{title}</span>
                        </label>
                        {rowOutcomes.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm">
                            {rowOutcomes.map(({ p, o }) => (
                              <li key={p.id} className="flex items-start gap-1.5">
                                <OutcomeIcon state={o!.state} />
                                <span>
                                  <span className="font-medium">{p.label}:</span> {o!.note}{" "}
                                  {o!.url && (
                                    <a
                                      href={o!.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline"
                                    >
                                      View post
                                    </a>
                                  )}
                                  {o!.state === "manual" && (
                                    <Link
                                      to="/library/$itemId"
                                      params={{ itemId: i.id }}
                                      className="underline"
                                    >
                                      Open its page
                                    </Link>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" asChild className="shrink-0">
                        <Link
                          to="/library/$itemId"
                          params={{ itemId: i.id }}
                          aria-label="Open this piece"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section
            aria-labelledby="summary-h"
            className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5"
          >
            <h2 id="summary-h" className="font-sans text-base font-semibold">
              3. What will happen
            </h2>
            {!chosen.length || !platforms.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Choose at least one platform and one piece to see the plan.
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-3 text-sm">
                  {PLATFORMS.filter((p) => platforms.includes(p.id)).map((p) => {
                    const rows = plan.rows.filter((r) => r.platform.id === p.id);
                    return (
                      <li key={p.id}>
                        <p className="font-medium">
                          {p.label}: {rows.length} piece{rows.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-muted-foreground">
                          {!rows.length
                            ? `None of the selected pieces are ${p.hint}.`
                            : !p.live
                              ? "Coming soon — saved as part of the plan, nothing is sent."
                              : canPost
                                ? "Goes live straight away, text only."
                                : "You'll get a link to post each one yourself."}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                {plan.skipped.length > 0 && (
                  <p className="mt-3 flex gap-1.5 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {plan.skipped.length} selected piece
                    {plan.skipped.length === 1 ? " doesn't" : "s don't"} fit any chosen platform and
                    will be skipped.
                  </p>
                )}
              </>
            )}
            <Button
              className="mt-5 w-full"
              disabled={!plan.rows.length || running}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="size-4" aria-hidden="true" /> Publish
              {plan.rows.length > 0 && ` (${plan.rows.length})`}
            </Button>
          </section>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !running && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish now?</AlertDialogTitle>
            <AlertDialogDescription>
              {liveCount > 0
                ? `${liveCount} post${liveCount === 1 ? "" : "s"} will go live on ${linkedIn.data?.accountName ?? "the connected"}'s LinkedIn straight away, visible to everyone. `
                : "Nothing will go live right now. "}
              Platforms marked "Coming soon" aren't connected yet, so nothing is sent there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={running}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              {running ? "Publishing…" : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OutcomeIcon({ state }: { state: Outcome["state"] }) {
  if (state === "done")
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />;
  if (state === "failed")
    return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />;
  return <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not sent" />;
}
