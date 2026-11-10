import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Section } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BrandKit } from "@/lib/brand-kit";
import { useKitMutations } from "@/lib/kit-mutations";
import { SimpleList } from "./simple-list";

export function FactsTab({ kit }: { kit: BrandKit }) {
  const m = useKitMutations(kit.brand.id);
  const [form, setForm] = useState({ fact: "", value: "", source: "", checked_at: "" });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.fact.trim()) return;
    m.add.mutate(
      {
        table: "facts",
        row: {
          fact: form.fact.trim(),
          value: form.value.trim(),
          source: form.source.trim(),
          checked_at: form.checked_at || null,
        },
      },
      { onSuccess: () => setForm({ fact: "", value: "", source: "", checked_at: "" }) },
    );
  }

  const claims = kit.rules
    .filter((r) => r.type === "needs_source")
    .map((r) => ({ id: r.id, text: r.text }));

  return (
    <div className="space-y-12">
      <Section
        title="Approved facts"
        description="The only numbers and facts the writer may use as true — along with anything you add to a brief."
        help="If a post needs a number that isn't here, the writer leaves a clear [NEEDS CONFIRMATION] placeholder instead of guessing."
      >
        {kit.facts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No facts yet. Add the numbers you're proud of — events delivered, customers served,
            awards won — with where they come from.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fact</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date checked</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kit.facts.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.fact}</TableCell>
                    <TableCell>{f.value}</TableCell>
                    <TableCell className="text-muted-foreground">{f.source}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {f.checked_at
                        ? new Date(f.checked_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Remove ${f.fact}`}
                        onClick={() => m.remove.mutate({ table: "facts", id: f.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_1fr_auto] lg:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="f-fact">Fact</Label>
            <Input
              id="f-fact"
              value={form.fact}
              onChange={(e) => setForm({ ...form, fact: e.target.value })}
              placeholder="e.g. Customers served in 2025"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-value">Number</Label>
            <Input
              id="f-value"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="e.g. 1,200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-source">Source</Label>
            <Input
              id="f-source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="e.g. Annual report"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-date">Date checked</Label>
            <Input
              id="f-date"
              type="date"
              value={form.checked_at}
              onChange={(e) => setForm({ ...form, checked_at: e.target.value })}
            />
          </div>
          <Button type="submit" variant="outline">
            <Plus className="size-4" /> Add fact
          </Button>
        </form>
      </Section>

      <Section
        title="Claims that need a source"
        description='Words like "#1" or "biggest" are only used when an approved fact backs them up.'
      >
        <SimpleList
          id="claims"
          items={claims}
          onAdd={(text) =>
            m.add.mutate({ table: "brand_rules", row: { type: "needs_source", text } })
          }
          onRemove={(id) => m.remove.mutate({ table: "brand_rules", id })}
          placeholder='e.g. "first ever"'
          empty='None yet. Common ones: "#1", "biggest", "first ever", "award-winning".'
        />
      </Section>
    </div>
  );
}
