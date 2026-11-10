import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Ban, Check, DoorOpen, ExternalLink, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/components/review-panel";
import { getChannel } from "@/lib/channels";
import type { ContentFields } from "@/lib/content-types";
import { toAiReview } from "@/lib/review";
import { useActiveBrand } from "@/lib/use-brand";
import { canApproveIn, useTeams } from "@/lib/use-team";
import { ACTION_TARGET, type WorkflowAction } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/gate")({
  head: () => ({
    meta: [
      { title: "The gate — Brand Voice Studio" },
      { name: "description", content: "Every post waiting for approval, with its verdict, ready to triage." },
      { property: "og:title", content: "The gate — Brand Voice Studio" },
      { property: "og:description", content: "Every post waiting for approval, with its verdict, ready to triage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatePage,
});

interface GateRow {
  id: string;
  channel: string;
  created_at: string;
  brand_score: number | null;
  fields: ContentFields;
  verdict: string | null;
  mainProblem: string | null;
}

function firstLine(f: ContentFields): string {
  const src = (f.hook || f.body || "").trim();
  return src.split("\n").find((l) => l.trim())?.trim() ?? "(empty)";
}

const VERDICT_STYLE: Record<string, string> = {
  Approve: "bg-primary/10 text-primary border-primary/30",
  "Approve with edits": "bg-accent text-accent-foreground border-border",
  "Send back": "bg-muted text-foreground border-border",
  Kill: "bg-destructive/10 text-destructive border-destructive/40",
};

type Pending = { row: GateRow; action: Extract<WorkflowAction, "request_changes" | "kill"> };

function GatePage() {
  const { brand } = useActiveBrand();
  const teams = useTeams();
  const canApprove = canApproveIn(teams.data?.teams, brand?.workspace_id);
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const gate = useQuery({
    queryKey: ["gate", brand?.id],
    enabled: Boolean(brand?.id),
    queryFn: async (): Promise<GateRow[]> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, channel, created_at, brand_score, fields, ai_review")
        .eq("brand_id", brand!.id)
        .eq("status", "in_review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const review = toAiReview(r.ai_review);
        return {
          id: r.id,
          channel: r.channel,
          created_at: r.created_at,
          brand_score: review?.score ?? r.brand_score,
          fields: (r.fields ?? {}) as unknown as ContentFields,
          verdict: review?.verdict ?? null,
          mainProblem: review?.main_problem ?? null,
        };
      });
    },
  });

  async function act(row: GateRow, action: WorkflowAction, comment = "") {
    setBusyId(row.id);
    const { error } = await supabase.rpc("set_content_status", {
      _item: row.id,
      _status: ACTION_TARGET[action],
      _comment: comment,
    });
    setBusyId(null);
    if (error) return void toast.error(error.message || "That didn't work. Please try again.");
    setPending(null);
    setNote("");
    toast.success(
      action === "approve" ? "Approved." : action === "kill" ? "Killed. It can't run." : "Sent back with your note.",
    );
    qc.setQueryData<GateRow[]>(["gate", brand?.id], (old) => (old ?? []).filter((r) => r.id !== row.id));
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const rows = gate.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[1000px] px-5 py-6 md:px-8">
      <PageHeader
        title="The gate"
        description={`Posts waiting for approval${brand ? ` for ${brand.name}` : ""}, newest first. Acting on a post takes it off the gate.`}
      />
      {!canApprove && rows.length > 0 && (
        <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Only people with the Approver role can approve, send back or kill. You can still open each post.
        </p>
      )}
      <div className="mt-6">
        {gate.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : gate.error ? (
          <p role="alert" className="text-sm text-destructive">We couldn't load the gate. Please refresh.</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<DoorOpen className="size-6" aria-hidden="true" />} title="Nothing waiting at the gate">
            Posts sent for review show up here. Check several at once from the Check a post page.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{getChannel(row.channel).short}</Badge>
                    <span>{formatDate(row.created_at, true)}</span>
                  </div>
                  <p className="mt-1.5 truncate font-medium">{firstLine(row.fields)}</p>
                  {row.mainProblem && row.verdict !== "Approve" && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.mainProblem}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${VERDICT_STYLE[row.verdict ?? ""] ?? "border-border text-muted-foreground"}`}
                  >
                    {row.verdict ?? "Not reviewed"}
                  </span>
                  <span className="w-14 text-right text-sm tabular-nums">
                    {row.brand_score ?? "–"}
                    <span className="text-muted-foreground">/100</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {canApprove && (
                    <>
                      <Button size="sm" disabled={busyId === row.id} onClick={() => act(row, "approve")}>
                        <Check className="size-4" aria-hidden="true" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => setPending({ row, action: "request_changes" })}
                      >
                        <Undo2 className="size-4" aria-hidden="true" /> Send back
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === row.id}
                        onClick={() => setPending({ row, action: "kill" })}
                      >
                        <Ban className="size-4" aria-hidden="true" /> Kill
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/library/$itemId" params={{ itemId: row.id }}>
                      Open <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pending || !note.trim()) return;
              void act(pending.row, pending.action, note.trim());
            }}
          >
            <DialogHeader>
              <DialogTitle>{pending?.action === "kill" ? "Why can't it run?" : "What needs changing?"}</DialogTitle>
              <DialogDescription>
                {pending?.action === "kill"
                  ? "Killing is final. The post can't be edited or published."
                  : "One line for the writer."}
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-2">
              <Label htmlFor="gate-note">{pending?.action === "kill" ? "Reason" : "Note"}</Label>
              <Input
                id="gate-note"
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={pending?.action === "kill" ? "For example: NDA client" : "For example: end on a question, not a slogan"}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                variant={pending?.action === "kill" ? "destructive" : "default"}
                disabled={!note.trim() || busyId !== null}
              >
                {pending?.action === "kill" ? "Kill it" : "Send back"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
