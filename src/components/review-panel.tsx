import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, Clock, MessageSquareWarning, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpTip } from "@/components/common";
import { canApproveIn, useNames, useTeams } from "@/lib/use-team";
import {
  ACTION_TARGET,
  STATUS_HELP,
  STATUS_LABEL,
  availableActions,
  describeActivity,
  isStatus,
  type ContentStatus,
  type WorkflowAction,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ContentStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  in_review: "bg-primary-soft text-accent-foreground border-primary/30",
  approved: "bg-success-soft text-success border-success/30",
  changes_requested: "bg-warning-soft text-warning border-warning/40",
  killed: "bg-destructive/10 text-destructive border-destructive/40",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s: ContentStatus = isStatus(status) ? status : "draft";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLE[s],
        className,
      )}
    >
      {STATUS_LABEL[s]}
    </span>
  );
}

export function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export const activityKey = (itemId: string) => ["activity", itemId] as const;

export function useActivity(itemId: string) {
  return useQuery({
    queryKey: activityKey(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, actor, details, created_at")
        .eq("content_item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

const ACTIVITY_PREVIEW = 4;

const ACTION_LABEL: Record<WorkflowAction, string> = {
  submit: "Send for review",
  approve: "Approve",
  request_changes: "Request changes",
  back_to_draft: "Back to draft",
  kill: "Kill / cannot run",
};

/** Status, approve / request-changes buttons (with a comment) and the activity log for one piece. */
export function ReviewPanel({
  item,
  workspaceId,
  onChanged,
  children,
}: {
  item: {
    id: string;
    status: string;
    approved_by: string | null;
    approved_at: string | null;
  };
  workspaceId: string | undefined;
  onChanged: () => void;
  /** Shown between the status box and the activity log (e.g. posting and versions). */
  children?: ReactNode;
}) {
  const qc = useQueryClient();
  const teams = useTeams();
  const canApprove = canApproveIn(teams.data?.teams, workspaceId);
  const isAdmin = Boolean(
    teams.data?.teams.find((t) => t.workspaceId === workspaceId)?.myRoles.includes("admin"),
  );
  const status: ContentStatus = isStatus(item.status) ? item.status : "draft";
  const activity = useActivity(item.id);
  const names = useNames([item.approved_by, ...(activity.data ?? []).map((a) => a.actor)]);
  const [dialog, setDialog] = useState<WorkflowAction | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [allActivity, setAllActivity] = useState(false);

  const latestFeedback =
    status === "changes_requested"
      ? (activity.data ?? []).find((a) => a.action === "changes_requested")
      : undefined;
  const killEvent =
    status === "killed" ? (activity.data ?? []).find((a) => a.action === "killed") : undefined;

  async function act(action: WorkflowAction, note?: string) {
    setBusy(true);
    const { error } = await supabase.rpc("set_content_status", {
      _item: item.id,
      _status: ACTION_TARGET[action],
      _comment: note ?? "",
    });
    setBusy(false);
    if (error) return void toast.error(error.message || "That didn't work. Please try again.");
    setDialog(null);
    setComment("");
    toast.success(
      action === "approve"
        ? "Approved."
        : action === "request_changes"
          ? "Changes requested. The writer will see your comment."
          : action === "kill"
            ? "Killed. This piece can't be edited or published."
            : action === "submit"
            ? "Sent for review."
            : "Moved back to draft.",
    );
    qc.invalidateQueries({ queryKey: activityKey(item.id) });
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    onChanged();
  }

  const actions = availableActions(status, canApprove);

  return (
    <div className="space-y-5">
      <section
        aria-label="Status"
        className="z-10 rounded-lg border bg-card p-5 shadow-card lg:sticky lg:top-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-sans text-base font-semibold">Status</h2>
          <StatusBadge status={status} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{STATUS_HELP[status]}</p>
        {status === "approved" && item.approved_at && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Approved by {names.data?.get(item.approved_by ?? "") ?? "an approver"} on{" "}
            {formatDate(item.approved_at)}
          </p>
        )}
        {latestFeedback && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
            <p className="font-medium">
              {names.data?.get(latestFeedback.actor ?? "") ?? "An approver"} asked for changes:
            </p>
            <p className="mt-1 whitespace-pre-line">
              {String((latestFeedback.details as { comment?: string } | null)?.comment ?? "")}
            </p>
          </div>
        )}

        {killEvent && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p className="flex items-center gap-2 font-medium">
              <Ban className="size-4 shrink-0" aria-hidden="true" />
              Killed by {names.data?.get(killEvent.actor ?? "") ?? "an approver"} on{" "}
              {formatDate(killEvent.created_at, true)}
            </p>
            <p className="mt-1 whitespace-pre-line">
              Reason: {String((killEvent.details as { comment?: string } | null)?.comment ?? "")}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a}
              size={a === "approve" ? "lg" : "sm"}
              className={a === "approve" ? "w-full text-base font-semibold" : undefined}
              variant={
                a === "approve" || a === "submit"
                  ? "default"
                  : a === "kill"
                    ? "destructive-quiet"
                    : a === "back_to_draft" ? "ghost" : "outline"
              }
              disabled={busy}
              onClick={() =>
                a === "approve" || a === "request_changes" || a === "kill" ? setDialog(a) : act(a)
              }
            >
              {a === "approve" && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
              {a === "request_changes" && (
                <MessageSquareWarning className="size-3.5" aria-hidden="true" />
              )}
              {a === "submit" && <Send className="size-3.5" aria-hidden="true" />}
              {a === "kill" && <Ban className="size-3.5" aria-hidden="true" />}
              {a === "back_to_draft" && <RotateCcw className="size-3.5" aria-hidden="true" />}
              {ACTION_LABEL[a]}
            </Button>
          ))}
        </div>
        {!canApprove && status === "in_review" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Only people with the approver role can approve or ask for changes.{" "}
            {isAdmin ? (
              <>
                You can give the role to yourself or a teammate on the{" "}
                <Link to="/team" className="font-medium text-primary underline">
                  Team page
                </Link>
                .
              </>
            ) : (
              "Ask a team admin if you need it."
            )}
          </p>
        )}
      </section>

      {children}

      <section aria-label="Activity" className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-1.5 font-sans text-base font-semibold">
          Activity
          <HelpTip>
            Everything that happened to this piece: who wrote it and with which settings, what the
            brand check flagged, and who edited, reviewed and approved it.
          </HelpTip>
        </h2>
        {activity.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : !activity.data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ol className="mt-4 space-y-4 border-l pl-4">
            {(allActivity ? activity.data : activity.data.slice(0, ACTIVITY_PREVIEW)).map((a) => {
              const d = (a.details ?? {}) as {
                comment?: string | null;
                brand_score?: number;
                flagged?: (string | { label: string })[];
                request?: string;
              };
              const flagged = (d.flagged ?? []).map((f) => (typeof f === "string" ? f : f.label));
              return (
                <li key={a.id} className="relative text-sm leading-relaxed text-foreground">
                  <span
                    className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <p>
                    <span className="font-medium">
                      {names.data?.get(a.actor ?? "") ?? "Someone"}
                    </span>{" "}
                    {describeActivity(a.action)}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    <time dateTime={a.created_at}>{formatDate(a.created_at, true)}</time>
                    {typeof d.brand_score === "number" && <> · Brand score {d.brand_score}</>}
                  </p>
                  {d.comment && (
                    <p className="mt-1 whitespace-pre-line rounded-md bg-muted px-2.5 py-1.5">
                      “{d.comment}”
                    </p>
                  )}
                  {a.action !== "submitted" && flagged.length > 0 && (
                    <p className="mt-1 text-sm text-foreground" title={flagged.join(", ")}>
                      Flagged: {flagged.slice(0, 3).join(", ")}
                      {flagged.length > 3 && ` and ${flagged.length - 3} more`}
                    </p>
                  )}
                  {d.request && a.action === "adjusted" && (
                    <p className="mt-1 text-sm text-foreground">Asked for: {d.request}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {(activity.data?.length ?? 0) > ACTIVITY_PREVIEW && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 -ml-2"
            aria-expanded={allActivity}
            onClick={() => setAllActivity((o) => !o)}
          >
            {allActivity ? "Show less" : `Show all ${activity.data!.length} events`}
          </Button>
        )}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "approve"
                ? "Approve this piece"
                : dialog === "kill"
                  ? "Kill this piece"
                  : "Request changes"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "approve"
                ? "Your name and today's date will be shown on it. Nothing is published automatically."
                : dialog === "kill"
                  ? "This piece will never run. It can't be edited, approved or published afterwards. Your name, the date and your reason are recorded."
                  : "Say what needs to change. The writer will see your comment on the piece."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="review-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (dialog === "request_changes" && !comment.trim())
                return void toast.error("Please say what needs to change.");
              if (dialog === "kill" && !comment.trim())
                return void toast.error("Please give a short reason.");
              if (dialog) void act(dialog, comment);
            }}
            className="space-y-2"
          >
            <Label htmlFor="review-comment">
              {dialog === "approve"
                ? "Comment (optional)"
                : dialog === "kill"
                  ? "Why can't it run?"
                  : "What needs to change?"}
            </Label>
            <Textarea
              id="review-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                dialog === "approve"
                  ? "e.g. Lovely — publish on Tuesday morning."
                  : dialog === "kill"
                    ? "e.g. NDA client"
                    : "e.g. Please swap the opening line and confirm the guest number."
              }
              required={dialog === "request_changes" || dialog === "kill"}
            />
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="review-form"
              disabled={busy}
              variant={dialog === "kill" ? "destructive" : "default"}
            >
              {dialog === "approve" ? "Approve" : dialog === "kill" ? "Kill piece" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
