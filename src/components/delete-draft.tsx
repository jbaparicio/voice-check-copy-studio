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
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Confirmed, database-authorized deletion for a piece or a complete request. */
export function DeleteDraftButton({
  itemId,
  brandId,
  requestId,
  pieceCount = 1,
  onDeleted,
  size = "sm",
  iconOnly = false,
  className,
}: {
  itemId?: string | undefined;
  brandId?: string | undefined;
  requestId?: string | undefined;
  pieceCount?: number;
  status?: string;
  onDeleted: () => void;
  size?: "sm" | "default";
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const permission = useQuery({
    queryKey: ["delete-permission", brandId ?? itemId],
    queryFn: async () => {
      let id = brandId;
      if (!id && itemId) {
        const { data, error } = await supabase.from("content_items").select("brand_id").eq("id", itemId).maybeSingle();
        if (error) throw error;
        id = data?.brand_id;
      }
      if (!id) return null;
      const { data, error } = await supabase.rpc("can_delete_brand", { _brand: id });
      if (error) throw error;
      return data ? id : null;
    },
  });
  const topic = Boolean(requestId);
  if (!permission.data) return null;

  async function remove() {
    if (!permission.data) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_library_content", {
      _brand: permission.data, ...(itemId ? { _item: itemId } : {}),
      ...(requestId ? { _request: requestId } : {}), _expected_count: pieceCount,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "We couldn't delete this content. Please try again.");
      return;
    }
    setOpen(false);
    toast.success(topic ? "Topic deleted." : "Piece deleted.");
    for (const key of ["library", "gate", "dashboard", "item", "versions", "siblings", "publish", "activity"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
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
        aria-label={topic ? "Delete topic" : "Delete piece"}
        title={topic ? "Delete topic" : "Delete piece"}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {!iconOnly && (topic ? "Delete topic" : "Delete piece")}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{topic ? "Delete this topic?" : "Delete this piece?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {topic ? `All ${pieceCount} pieces in this topic` : "This piece"} will be removed for everyone on the team,
              including saved versions and activity history. Other pieces are kept. This can't be undone.
              Deleting a live post here does not remove it from LinkedIn.
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
              {busy ? "Deleting…" : topic ? `Delete ${pieceCount} pieces` : "Delete piece"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
