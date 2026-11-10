import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <span
        aria-hidden="true"
        className="relative grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 15c2-4 4-6 8-6s6 2 8 6" />
          <path d="M8 19c1-2 2-3 4-3s3 1 4 3" />
          <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-lg font-medium tracking-tight">Brand Voice Studio</span>
      )}
    </span>
  );
}
