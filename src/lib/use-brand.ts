import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadBrandKit } from "./brand-kit";

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  return data.user.id;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const id = await currentUserId();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, is_demo, workspace_id")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useActiveBrand() {
  const profile = useProfile();
  const brands = useBrands();
  const list = brands.data ?? [];
  const active = list.find((b) => b.id === profile.data?.active_brand_id) ?? list[0] ?? null;
  return {
    brand: active,
    brands: list,
    profile: profile.data ?? null,
    isLoading: profile.isLoading || brands.isLoading,
  };
}

export function useSetActiveBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => {
      const id = await currentUserId();
      const { error } = await supabase
        .from("profiles")
        .update({ active_brand_id: brandId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["kit"] });
    },
  });
}

export const kitKey = (brandId: string | undefined) => ["kit", brandId] as const;

export function useBrandKit(brandId: string | undefined) {
  return useQuery({
    queryKey: kitKey(brandId),
    enabled: Boolean(brandId),
    queryFn: () => loadBrandKit(supabase, brandId!),
  });
}
