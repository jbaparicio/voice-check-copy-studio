import { useState, type FormEvent } from "react";
import { Plus, Target, Trash2, Users } from "lucide-react";
import { EmptyState, ToggleChip } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CHANNELS, getChannel } from "@/lib/channels";
import type { BrandKit, Goal, Persona } from "@/lib/brand-kit";
import { useKitMutations } from "@/lib/kit-mutations";

export function PersonaCard({
  p,
  onRemove,
  compact = false,
}: {
  p: Persona;
  onRemove?: () => void;
  compact?: boolean;
}) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-sans font-semibold">{p.name}</h3>
          <p className="text-sm text-muted-foreground">
            {p.role}
            {p.company_type ? ` · ${p.company_type}` : ""}
          </p>
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Remove ${p.name}`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <dl className={compact ? "mt-3 space-y-1 text-sm" : "mt-4 space-y-2 text-sm"}>
        {p.goals && <Row label="Wants">{p.goals}</Row>}
        {p.pain_points && <Row label="Struggles with">{p.pain_points}</Row>}
        {!compact && p.cares_about && <Row label="Cares about">{p.cares_about}</Row>}
        {!compact && p.language_level && <Row label="Language">{p.language_level}</Row>}
      </dl>
      {!compact && p.preferred_channels.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Usually on: {p.preferred_channels.map((c) => getChannel(c).short).join(", ")}
        </p>
      )}
    </article>
  );
}

export function GoalCard({ g, onRemove }: { g: Goal; onRemove?: () => void }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans font-semibold">{g.name}</h3>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Remove ${g.name}`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
      <dl className="mt-3 space-y-1 text-sm">
        {g.cta_type && <Row label="Ask people to">{g.cta_type}</Row>}
        {g.success_measure && <Row label="Success looks like">{g.success_measure}</Row>}
      </dl>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-medium">{label}: </dt>
      <dd className="inline text-muted-foreground">{children}</dd>
    </div>
  );
}

const EMPTY_PERSONA = {
  name: "",
  role: "",
  company_type: "",
  goals: "",
  pain_points: "",
  cares_about: "",
  preferred_channels: [] as string[],
  language_level: "",
};

export function PersonaForm({
  onSave,
  saving,
  submitLabel = "Save persona",
}: {
  onSave: (p: typeof EMPTY_PERSONA) => void;
  saving?: boolean;
  submitLabel?: string;
}) {
  const [f, setF] = useState(EMPTY_PERSONA);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    onSave(f);
    setF(EMPTY_PERSONA);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="p-name"
          label="Persona name"
          value={f.name}
          onChange={(v) => setF({ ...f, name: v })}
          placeholder="e.g. Busy Marketing Manager"
          required
        />
        <Field
          id="p-role"
          label="Role or job title"
          value={f.role}
          onChange={(v) => setF({ ...f, role: v })}
          placeholder="e.g. Head of Marketing"
        />
      </div>
      <Field
        id="p-company"
        label="Type of company"
        value={f.company_type}
        onChange={(v) => setF({ ...f, company_type: v })}
        placeholder="e.g. Fast-growing software companies with 50–200 staff"
      />
      <Area
        id="p-goals"
        label="What they want to achieve"
        value={f.goals}
        onChange={(v) => setF({ ...f, goals: v })}
        placeholder="e.g. Hit pipeline targets without growing the team"
      />
      <Area
        id="p-pain"
        label="What gets in their way"
        value={f.pain_points}
        onChange={(v) => setF({ ...f, pain_points: v })}
        placeholder="e.g. Too many tools, not enough time, agencies that overpromise"
      />
      <Area
        id="p-cares"
        label="What they care about"
        value={f.cares_about}
        onChange={(v) => setF({ ...f, cares_about: v })}
        placeholder="e.g. Proof, clear pricing, a partner who just gets it done"
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Where you'll usually reach them</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => {
            const on = f.preferred_channels.includes(c.id);
            return (
              <ToggleChip
                key={c.id}
                pressed={on}
                onClick={() =>
                  setF({
                    ...f,
                    preferred_channels: on
                      ? f.preferred_channels.filter((x) => x !== c.id)
                      : [...f.preferred_channels, c.id],
                  })
                }
              >
                {c.short}
              </ToggleChip>
            );
          })}
        </div>
      </fieldset>
      <Field
        id="p-lang"
        label="How to speak to them"
        value={f.language_level}
        onChange={(v) => setF({ ...f, language_level: v })}
        placeholder="e.g. Plain English, no jargon"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const EMPTY_GOAL = { name: "", description: "", cta_type: "", success_measure: "" };

export function GoalForm({
  onSave,
  saving,
  submitLabel = "Save goal",
}: {
  onSave: (g: typeof EMPTY_GOAL) => void;
  saving?: boolean;
  submitLabel?: string;
}) {
  const [f, setF] = useState(EMPTY_GOAL);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    onSave(f);
    setF(EMPTY_GOAL);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        id="g-name"
        label="Goal"
        value={f.name}
        onChange={(v) => setF({ ...f, name: v })}
        placeholder="e.g. Generate leads, Build employer brand, Announce an award"
        required
      />
      <Area
        id="g-desc"
        label="What this means for you"
        value={f.description}
        onChange={(v) => setF({ ...f, description: v })}
        placeholder="e.g. Get more enquiries from brands planning launches"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="g-cta"
          label="What should people do?"
          value={f.cta_type}
          onChange={(v) => setF({ ...f, cta_type: v })}
          placeholder="e.g. Book a call"
        />
        <Field
          id="g-measure"
          label="How you'll measure success"
          value={f.success_measure}
          onChange={(v) => setF({ ...f, success_measure: v })}
          placeholder="e.g. Calls booked per month"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Area({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function PersonasTab({ kit }: { kit: BrandKit }) {
  const m = useKitMutations(kit.brand.id);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          The people you're writing for. Pick one when you create content and the writer adapts to
          what they care about.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Add persona
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add a persona</DialogTitle>
              <DialogDescription>
                Describe someone you want to reach. Rough notes are fine.
              </DialogDescription>
            </DialogHeader>
            <PersonaForm
              saving={m.add.isPending}
              onSave={(row) =>
                m.add.mutate({ table: "personas", row }, { onSuccess: () => setOpen(false) })
              }
            />
          </DialogContent>
        </Dialog>
      </div>
      {kit.personas.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="No personas yet">
          Add the two or three types of people you most want to reach.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kit.personas.map((p) => (
            <PersonaCard
              key={p.id}
              p={p}
              onRemove={() => m.remove.mutate({ table: "personas", id: p.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalsTab({ kit }: { kit: BrandKit }) {
  const m = useKitMutations(kit.brand.id);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Why you're posting. The goal shapes the call to action.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Add goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add a business goal</DialogTitle>
              <DialogDescription>What should your content help you achieve?</DialogDescription>
            </DialogHeader>
            <GoalForm
              saving={m.add.isPending}
              onSave={(row) =>
                m.add.mutate({ table: "goals", row }, { onSuccess: () => setOpen(false) })
              }
            />
          </DialogContent>
        </Dialog>
      </div>
      {kit.goals.length === 0 ? (
        <EmptyState icon={<Target className="size-5" />} title="No goals yet">
          Add a goal like "Generate leads" or "Build employer brand".
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kit.goals.map((g) => (
            <GoalCard
              key={g.id}
              g={g}
              onRemove={() => m.remove.mutate({ table: "goals", id: g.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
