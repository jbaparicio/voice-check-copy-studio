import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, HelpTip, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/components/review-panel";
import { ROLE_HELP, ROLE_LABEL, useTeams, type AppRole, type Team } from "@/lib/use-team";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Brand Voice Studio" },
      {
        name: "description",
        content: "See who's on your team, invite people and set who can approve.",
      },
      { property: "og:title", content: "Team — Brand Voice Studio" },
      {
        property: "og:description",
        content: "See who's on your team, invite people and set who can approve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

const ROLES: AppRole[] = ["admin", "editor", "approver"];

function TeamPage() {
  const teams = useTeams();
  return (
    <div>
      <PageHeader
        title="Team"
        description="Who can use this workspace, and what they can do. Only approvers can mark content Approved."
      />
      <div className="space-y-10 px-5 py-6 md:px-10">
        <ul className="grid gap-3 md:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r} className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-semibold">{ROLE_LABEL[r]}</p>
              <p className="mt-1 text-muted-foreground">{ROLE_HELP[r]}</p>
            </li>
          ))}
        </ul>
        {teams.isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          teams.data?.teams.map((t) => (
            <TeamSection key={t.workspaceId} team={t} me={teams.data.me} />
          ))
        )}
      </div>
    </div>
  );
}

function TeamSection({ team, me }: { team: Team; me: string }) {
  const qc = useQueryClient();
  const isAdmin = team.myRoles.includes("admin");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["editor"]);
  const [busy, setBusy] = useState(false);

  const invites = useQuery({
    queryKey: ["invites", team.workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invites")
        .select("id, email, roles, created_at")
        .eq("workspace_id", team.workspaceId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function toggleRole(userId: string, role: AppRole, on: boolean) {
    const { error } = await supabase.rpc("set_member_role", {
      _ws: team.workspaceId,
      _user: userId,
      _role: role,
      _enabled: on,
    });
    if (error) return void toast.error(error.message);
    toast.success(on ? `${ROLE_LABEL[role]} role added.` : `${ROLE_LABEL[role]} role removed.`);
    void qc.invalidateQueries({ queryKey: ["teams"] });
  }

  async function remove(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} from ${team.workspaceName}?`)) return;
    const { error } = await supabase.rpc("remove_member", { _ws: team.workspaceId, _user: userId });
    if (error) return void toast.error(error.message);
    toast.success(`${name} was removed.`);
    void qc.invalidateQueries({ queryKey: ["teams"] });
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))
      return void toast.error("Please enter a valid email address.");
    if (!roles.length) return void toast.error("Pick at least one role.");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("workspace_invites").insert({
      workspace_id: team.workspaceId,
      email: clean,
      roles,
      invited_by: auth.user!.id,
    });
    setBusy(false);
    if (error)
      return void toast.error(
        error.code === "23505"
          ? "That person has already been invited."
          : "We couldn't add that invite.",
      );
    setEmail("");
    setRoles(["editor"]);
    toast.success("Invite saved. Ask them to sign up or sign in with that email address.");
    void invites.refetch();
  }

  async function cancelInvite(id: string) {
    const { error } = await supabase.from("workspace_invites").delete().eq("id", id);
    if (error) return void toast.error("We couldn't cancel that invite.");
    void invites.refetch();
  }

  return (
    <section aria-labelledby={`team-${team.workspaceId}`} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`team-${team.workspaceId}`} className="text-2xl font-medium">
            {team.workspaceName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {team.members.length} {team.members.length === 1 ? "person" : "people"} · your roles:{" "}
            {team.myRoles.map((r) => ROLE_LABEL[r]).join(", ")}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Team members and their roles</caption>
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Person
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-4 py-3 text-center font-medium">
                  {ROLE_LABEL[r]}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => (
              <tr key={m.userId} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {m.name}
                    {m.userId === me && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(m.joined)}</p>
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-4 py-3">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={m.roles.includes(r)}
                        disabled={!isAdmin}
                        onCheckedChange={(v) => toggleRole(m.userId, r, v === true)}
                        aria-label={`${ROLE_LABEL[r]} role for ${m.name}`}
                      />
                    </div>
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  {isAdmin && m.userId !== me && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.name}`}
                      onClick={() => remove(m.userId, m.name)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Only admins can change roles or invite people.
        </p>
      )}

      {isAdmin && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={invite} className="space-y-4 rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-1.5 font-sans font-semibold">
              <UserPlus className="size-4 text-primary" aria-hidden="true" /> Invite someone
              <HelpTip>
                We don't send an email. Let them know, and they'll join this team automatically the
                next time they sign up or sign in with this address.
              </HelpTip>
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor={`invite-${team.workspaceId}`}>Work email</Label>
              <Input
                id={`invite-${team.workspaceId}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Roles</legend>
              <div className="flex flex-wrap gap-4">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={roles.includes(r)}
                      onCheckedChange={(v) =>
                        setRoles((cur) => (v === true ? [...cur, r] : cur.filter((x) => x !== r)))
                      }
                    />
                    {ROLE_LABEL[r]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={busy}>
              Add invite
            </Button>
          </form>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-1.5 font-sans font-semibold">
              <Mail className="size-4 text-primary" aria-hidden="true" /> Waiting to join
            </h3>
            {!invites.data?.length ? (
              <div className="mt-4">
                <EmptyState icon={<Users className="size-5" />} title="No open invites">
                  People you invite show here until they sign in.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-3 divide-y">
                {invites.data.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.roles.map((r) => ROLE_LABEL[r]).join(", ")} · invited{" "}
                        {formatDate(i.created_at)}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvite(i.id)}
                      aria-label={`Cancel invite for ${i.email}`}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
