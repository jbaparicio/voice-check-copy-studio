import { useState, type FormEvent } from "react";
import { Plus, ThumbsDown, ThumbsUp, Trash2, Quote } from "lucide-react";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CHANNELS, getChannel } from "@/lib/channels";
import type { BrandKit } from "@/lib/brand-kit";
import { useKitMutations } from "@/lib/kit-mutations";

const EMPTY = { channel: "linkedin", title: "", body: "", label: "great", notes: "" };

export function ExamplesTab({ kit }: { kit: BrandKit }) {
  const m = useKitMutations(kit.brand.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) return;
    m.add.mutate(
      { table: "examples", row: form },
      {
        onSuccess: () => {
          setForm(EMPTY);
          setOpen(false);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Past content that shows how you sound at your best — and what to avoid. The writer uses up
          to three great examples for the same channel as style references.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Add example
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Add an example</DialogTitle>
                <DialogDescription>
                  Paste a post, email or article that represents your brand well (or badly).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ex-channel">Channel</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => setForm({ ...form, channel: v })}
                  >
                    <SelectTrigger id="ex-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ex-title">Title</Label>
                  <Input
                    id="ex-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Summer launch post"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-body">The content</Label>
                <Textarea
                  id="ex-body"
                  rows={7}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Paste the full text here…"
                  required
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Is this a good example?</legend>
                <RadioGroup
                  value={form.label}
                  onValueChange={(v) => setForm({ ...form, label: v })}
                  className="flex gap-4"
                >
                  <Label htmlFor="ex-great" className="flex items-center gap-2 font-normal">
                    <RadioGroupItem id="ex-great" value="great" /> Great example
                  </Label>
                  <Label htmlFor="ex-avoid" className="flex items-center gap-2 font-normal">
                    <RadioGroupItem id="ex-avoid" value="avoid" /> Avoid this
                  </Label>
                </RadioGroup>
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="ex-notes">Notes (optional)</Label>
                <Input
                  id="ex-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="What makes it work, or what's wrong with it?"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={m.add.isPending}>
                  Save example
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {kit.examples.length === 0 ? (
        <EmptyState icon={<Quote className="size-5" />} title="No examples yet">
          Add two or three posts your team is proud of. They're the quickest way to teach your
          voice.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kit.examples.map((ex) => (
            <article key={ex.id} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getChannel(ex.channel).short}</Badge>
                  {ex.label === "great" ? (
                    <Badge className="bg-success-soft text-success hover:bg-success-soft">
                      <ThumbsUp className="mr-1 size-3" /> Great example
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive-soft text-destructive hover:bg-destructive-soft">
                      <ThumbsDown className="mr-1 size-3" /> Avoid this
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Remove ${ex.title || "example"}`}
                  onClick={() => m.remove.mutate({ table: "examples", id: ex.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {ex.title && <h3 className="font-sans font-semibold">{ex.title}</h3>}
              <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-muted-foreground">
                {ex.body}
              </p>
              {ex.notes && (
                <p className="mt-3 border-t pt-3 text-sm">
                  <span className="font-medium">Note: </span>
                  {ex.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
