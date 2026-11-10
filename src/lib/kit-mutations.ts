import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { kitKey } from "./use-brand";

type T = Database["public"]["Tables"];
export type KitTable =
  "brand_rules" | "facts" | "names" | "examples" | "personas" | "goals" | "guideline_files";

/** Add / change / remove rows in any Brand Kit list, then refresh the kit. */
export function useKitMutations(brandId: string | undefined) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: kitKey(brandId) });

  const add = useMutation({
    mutationFn: async (args: { table: KitTable; row: Record<string, unknown> }) => {
      if (!brandId) throw new Error("Pick a brand first.");
      const { error } = await supabase
        .from(args.table)
        .insert({ ...args.row, brand_id: brandId } as never);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("That didn't save. Please try again."),
  });

  const update = useMutation({
    mutationFn: async (args: { table: KitTable; id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from(args.table)
        .update(args.patch as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("That change didn't save. Please try again."),
  });

  const remove = useMutation({
    mutationFn: async (args: { table: KitTable; id: string }) => {
      const { error } = await supabase.from(args.table).delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("We couldn't remove that. Please try again."),
  });

  const updateBrand = useMutation({
    mutationFn: async (patch: T["brands"]["Update"]) => {
      if (!brandId) throw new Error("Pick a brand first.");
      const { error } = await supabase.from("brands").update(patch).eq("id", brandId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: () => toast.error("That change didn't save. Please try again."),
  });

  return { add, update, remove, updateBrand };
}
