/**
 * Review & approval rules shown in the app. Pure and browser-safe.
 * The database enforces the same rules (only approvers can approve or request changes).
 */
export type ContentStatus = "draft" | "in_review" | "approved" | "changes_requested" | "killed";

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  changes_requested: "Changes requested",
  killed: "Killed",
};

export const STATUS_HELP: Record<ContentStatus, string> = {
  draft: "Still being written. Send it for review when it's ready.",
  in_review: "Waiting for an approver to approve it or ask for changes.",
  approved: "Signed off by an approver. Ready to publish by hand.",
  changes_requested: "An approver asked for changes. Edit it, then send it for review again.",
  killed: "An approver decided this must never run. It can't be edited or published.",
};

export const STATUS_ORDER: ContentStatus[] = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "killed",
];

export function isStatus(s: string): s is ContentStatus {
  return s in STATUS_LABEL;
}

export type WorkflowAction = "submit" | "approve" | "request_changes" | "back_to_draft" | "kill";

/** Which buttons a person sees for a piece, given its status and whether they're an approver. */
export function availableActions(status: ContentStatus, canApprove: boolean): WorkflowAction[] {
  const out: WorkflowAction[] = [];
  if (status === "killed") return out; // terminal
  if (status === "draft" || status === "changes_requested") out.push("submit");
  if (canApprove && status !== "approved") out.push("approve");
  if (canApprove && (status === "in_review" || status === "approved")) out.push("request_changes");
  if (status === "in_review" || status === "approved") out.push("back_to_draft");
  if (canApprove) out.push("kill");
  return out;
}

export const ACTION_TARGET: Record<WorkflowAction, ContentStatus> = {
  submit: "in_review",
  approve: "approved",
  request_changes: "changes_requested",
  back_to_draft: "draft",
  kill: "killed",
};

const ACTIVITY: Record<string, string> = {
  generated: "wrote the first draft",
  generated_variant: "wrote an alternative version",
  adjusted: "asked for a rewrite",
  fixed: "fixed a brand check flag",
  edited: "edited the text",
  edited_selection: "changed some highlighted words",
  restored_version: "went back to an earlier version",
  pasted_for_check: "pasted an existing post to check",
  reviewed: "ran the full brand check",
  submitted: "sent it for review",
  approved: "approved it",
  changes_requested: "asked for changes",
  moved_to_draft: "moved it back to draft",
  killed: "killed it (cannot run)",
  opened_in_linkedin: "opened it in LinkedIn to post",
  posted_to_linkedin: "posted it to LinkedIn",
};

export function describeActivity(action: string): string {
  return ACTIVITY[action] ?? action.replace(/_/g, " ");
}

/** Make a value safe for a CSV cell, including against spreadsheet formulas. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

