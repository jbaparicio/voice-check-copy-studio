import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Chip, Section } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BrandKit } from "@/lib/brand-kit";
import { useKitMutations } from "@/lib/kit-mutations";

const KINDS = [
  { v: "client", l: "Client" },
  { v: "partner", l: "Partner" },
  { v: "person", l: "Person" },
  { v: "handle", l: "Social handle" },
  { v: "other", l: "Other" },
];

const GROUPS = [
  {
    status: "allowed",
    title: "Can be mentioned",
    description: "Clients, partners and people who've agreed to be named.",
  },
  {
    status: "never",
    title: "Never mention",
    description: "Names that must never appear — the brand check flags them.",
  },
  {
    status: "tag_allowed",
    title: "Handles we can tag",
    description: "Social accounts that are OK to @mention.",
  },
] as const;

export function NamesTab({ kit }: { kit: BrandKit }) {
  const m = useKitMutations(kit.brand.id);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("client");
  const [status, setStatus] = useState<string>("allowed");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    m.add.mutate(
      {
        table: "names",
        row: { name: name.trim(), kind: status === "tag_allowed" ? "handle" : kind, status },
      },
      { onSuccess: () => setName("") },
    );
  }

  return (
    <div className="space-y-10">
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="n-name">Name or handle</Label>
          <Input
            id="n-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Harbourline Foods or @handle"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-kind">Type</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id="n-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k.v} value={k.v}>
                  {k.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-status">Clearance</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="n-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((g) => (
                <SelectItem key={g.status} value={g.status}>
                  {g.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          <Plus className="size-4" /> Add
        </Button>
      </form>

      <div className="grid gap-10 lg:grid-cols-3">
        {GROUPS.map((g) => {
          const list = kit.names.filter((n) => n.status === g.status);
          return (
            <Section key={g.status} title={g.title} description={g.description}>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {list.map((n) => (
                    <Chip
                      key={n.id}
                      onRemove={() => m.remove.mutate({ table: "names", id: n.id })}
                      className={
                        g.status === "never" ? "bg-destructive-soft text-destructive" : undefined
                      }
                    >
                      {n.name}
                    </Chip>
                  ))}
                </div>
              )}
            </Section>
          );
        })}
      </div>
    </div>
  );
}
