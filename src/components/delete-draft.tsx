import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { canDeleteDraft } from "@/lib/workflow";

/** Delete a draft after a confirmation. Hidden for pieces in review or approved. */
export function DeleteDraftButton({
  itemId,
  status,
  onDeleted,
  size = "sm",
  iconOnly = false,
  className,
}: {
  itemId: string;
  status: string;
  onDeleted: () => void;
  size?: "sm" | "default";
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!canDeleteDraft(status)) return null;

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("content_items").delete().eq("id", itemId);
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Only drafts")
          ? "Only drafts can be deleted."
          : "We couldn't delete this draft. Please try again.",
      );
      return;
    }
    setOpen(false);
    toast.success("Draft deleted.");
    onDeleted();
  }

  return (
    <>
      <Button
        variant="ghost"
        size={iconOnly ? "icon" : size}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Delete draft"
        title="Delete draft"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {!iconOnly && "Delete draft"}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              It's removed for everyone on the team, along with its alternatives and history. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy ? "Deleting…" : "Delete draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
