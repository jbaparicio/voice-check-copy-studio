import { CheckCircle2, CircleAlert, Ban, PencilLine } from "lucide-react";
import type { AiReview } from "@/lib/review";
import { cn } from "@/lib/utils";

const VERDICT_TONE = {
  Approve: "border-success bg-success-soft text-success",
  "Approve with edits": "border-warning bg-warning-soft text-warning",
  "Send back": "border-warning bg-warning-soft text-warning",
  Kill: "border-destructive bg-destructive-soft text-destructive",
};

/** Present the saved editorial decision without deriving a new verdict or score. */
export function ReviewVerdictBar({ review, fresh }: { review: AiReview | null | undefined; fresh: boolean }) {
  if (!review?.verdict) return null;
  const Icon = review.verdict === "Approve" ? CheckCircle2
    : review.verdict === "Kill" ? Ban
    : review.verdict === "Approve with edits" ? PencilLine : CircleAlert;
  return (
    <section aria-label="Recommended verdict" className={cn("mt-5 border-y border-l-4 px-4 py-4 md:px-5", VERDICT_TONE[review.verdict])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">Recommended verdict{!fresh && " · Last saved check"}</p>
          <p className="mt-1 flex items-center gap-2 font-sans text-2xl font-semibold md:text-3xl">
            <Icon className="size-6 shrink-0" aria-hidden="true" />{review.verdict}
          </p>
          {review.main_problem && <p className="mt-2 break-words text-sm leading-relaxed text-foreground">{review.main_problem}</p>}
        </div>
        <p className="shrink-0 font-sans text-3xl font-semibold tabular-nums text-foreground">
          {review.score}<span className="text-base font-normal text-muted-foreground"> / 100</span>
          <span className="sr-only">Score</span>
        </p>
      </div>
    </section>
  );
}