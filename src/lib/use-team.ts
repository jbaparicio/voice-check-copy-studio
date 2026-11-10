import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  editor: "Editor",
  approver: "Approver",
};

export const ROLE_HELP: Record<AppRole, string> = {
  admin: "Manages the team and brands.",
  editor: "Writes and edits content, and sends it for review.",
  approver: "Approves content or asks for changes. Only approvers can mark content Approved.",
};

export interface Member {
  userId: string;
  name: string;
  roles: AppRole[];
  joined: string;
}

export interface Team {
  workspaceId: string;
  workspaceName: string;
  members: Member[];
  myRoles: AppRole[];
}

/** Every team I belong to, with its members and my roles in it. */
export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async (): Promise<{ me: string; teams: Team[] }> => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) throw new Error("Please sign in again.");
      const [ws, members] = await Promise.all([
        supabase.from("workspaces").select("id, name").order("created_at"),
        supabase.from("workspace_members").select("workspace_id, user_id, role, created_at"),
      ]);
      if (ws.error) throw ws.error;
      if (members.error) throw members.error;
      const ids = [...new Set(members.data.map((m) => m.user_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, display_name").in("id", ids)
        : { data: [] };
      const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Teammate"]));
      const teams = ws.data.map((w) => {
        const rows = members.data.filter((m) => m.workspace_id === w.id);
        const byUser = new Map<string, Member>();
        for (const r of rows) {
          const m = byUser.get(r.user_id) ?? {
            userId: r.user_id,
            name: nameOf.get(r.user_id) ?? "Teammate",
            roles: [],
            joined: r.created_at,
          };
          m.roles.push(r.role);
          if (r.created_at < m.joined) m.joined = r.created_at;
          byUser.set(r.user_id, m);
        }
        const list = [...byUser.values()].sort((a, b) => a.joined.localeCompare(b.joined));
        return {
          workspaceId: w.id,
          workspaceName: w.name,
          members: list,
          myRoles: byUser.get(me)?.roles ?? [],
        };
      });
      return { me, teams };
    },
  });
}

/** Whether I can approve content for a brand in this team. */
export function canApproveIn(teams: Team[] | undefined, workspaceId: string | undefined) {
  return Boolean(teams?.find((t) => t.workspaceId === workspaceId)?.myRoles.includes("approver"));
}

/** Display names for a set of people (teammates only). */
export function useNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))].sort();
  return useQuery({
    queryKey: ["names", unique],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", unique);
      return new Map((data ?? []).map((p) => [p.id, p.display_name || "Teammate"]));
    },
  });
}
