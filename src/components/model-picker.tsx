import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  COST_WORDS,
  getWriterModel,
  WRITER_MODELS,
  type WriterModel,
} from "@/lib/models";
import { cn } from "@/lib/utils";

/** Four small dots: how expensive a model is, compared with the others. */
export function CostDots({ level, className }: { level: WriterModel["costLevel"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={cn("size-1.5 rounded-full", n <= level ? "bg-primary" : "bg-border")}
        />
      ))}
    </span>
  );
}

/** "Claude Sonnet" pill shown on drafts so people know who wrote it. */
export function ModelTag({ modelId, className }: { modelId: string | null; className?: string }) {
  if (!modelId) return null;
  const m = getWriterModel(modelId);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
      title={`Written with ${m.name} by ${m.maker}`}
    >
      {m.name}
    </span>
  );
}

export function ModelGuide() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Which should I pick?
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <p className="mb-2 text-sm font-semibold">Choosing a writer</p>
        <ul className="space-y-3">
          {WRITER_MODELS.map((m) => (
            <li key={m.id} className="text-sm">
              <p className="flex items-center justify-between gap-2 font-medium">
                {m.name}
                <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <CostDots level={m.costLevel} /> {COST_WORDS[m.costLevel]}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{m.bestFor}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          Costs are rough, per channel, taken from your workspace credits. Every draft also gets the
          same careful brand check, whichever writer you choose.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function ModelPicker({
  id,
  label,
  value,
  onChange,
  exclude,
  drafts,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  /** Hide a model (used so both compare slots can't pick the same one). */
  exclude?: string;
  drafts: number;
}) {
  const m = getWriterModel(value);
  const credits = (m.creditsPerDraft * Math.max(1, drafts)).toFixed(2);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={m.id} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WRITER_MODELS.filter((x) => x.id !== exclude).map((x) => (
            <SelectItem key={x.id} value={x.id}>
              <span className="flex items-center gap-2">
                {x.name}
                <span className="text-xs text-muted-foreground">· {x.tagline}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="rounded-lg border bg-background px-3 py-2 text-xs">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Good for:</span> {m.bestFor}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CostDots level={m.costLevel} /> {COST_WORDS[m.costLevel]}
          </span>
          <span aria-hidden="true">·</span>
          <span>{m.speed}</span>
          <span aria-hidden="true">·</span>
          <span>
            ≈ {credits} credits for {Math.max(1, drafts)} draft{drafts === 1 ? "" : "s"}
          </span>
        </p>
      </div>
    </div>
  );
}
