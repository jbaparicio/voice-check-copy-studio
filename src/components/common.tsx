import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HelpTip({
  children,
  label = "More information",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm leading-snug">{children}</TooltipContent>
    </Tooltip>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b px-5 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-medium md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  help,
}: {
  title: string;
  description?: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="font-sans text-base font-semibold">{title}</h2>
          {help && <HelpTip>{help}</HelpTip>}
        </div>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Chips that can be typed in (Enter or comma adds) and removed. */
export function ChipInput({
  id,
  value,
  onChange,
  placeholder,
  prefix = "",
  max,
  label,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  prefix?: string;
  max?: number;
  label: string;
}) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const v = raw.trim().replace(/^#/, "");
    if (!v || value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    if (max && value.length >= max) return;
    onChange([...value, v]);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((v) => (
        <Chip key={v} onRemove={() => onChange(value.filter((x) => x !== v))}>
          {prefix}
          {v}
        </Chip>
      ))}
      <input
        id={id}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => {
          if (draft) {
            add(draft);
            setDraft("");
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export function Chip({
  children,
  onRemove,
  className,
}: {
  children: ReactNode;
  onRemove?: (() => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm text-secondary-foreground",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === "string" ? children : "item"}`}
          className="-mr-1 rounded-full p-0.5 hover:bg-foreground/10"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Big toggle chip used for picking channels and adjectives. */
export function ToggleChip({
  pressed,
  onClick,
  children,
  description,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  description?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={description}
      className={cn(
        "rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors",
        pressed
          ? "border-primary bg-primary-soft text-accent-foreground"
          : "border-input bg-card hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}
