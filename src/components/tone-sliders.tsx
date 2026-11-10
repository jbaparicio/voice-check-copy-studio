import { SLIDERS, describeSliders, type SliderKey, type SliderValues } from "@/lib/sliders";
import { RotateCcw } from "lucide-react";
import { HelpTip } from "@/components/common";
import { cn } from "@/lib/utils";

/** Five-step sliders with a plain-language label at each end. */
export function ToneSliders({
  value,
  onChange,
  adjectives = [],
  emojiCap,
  idPrefix = "tone",
}: {
  value: SliderValues;
  onChange: (v: SliderValues) => void;
  adjectives?: string[];
  emojiCap?: number;
  idPrefix?: string;
}) {
  function set(key: SliderKey, n: number) {
    onChange({ ...value, [key]: n });
  }
  return (
    <div className="space-y-5">
      {SLIDERS.map((s) => {
        const id = `${idPrefix}-${s.key}`;
        const max = s.key === "emoji" && emojiCap ? emojiCap : 5;
        const current = Math.min(value[s.key], max);
        return (
          <div key={s.key}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <label htmlFor={id} className="font-medium">
                {s.left}
              </label>
              <span className="flex items-center gap-1 font-medium">
                {s.right}
                <HelpTip label={`About ${s.left} to ${s.right}`}>{s.help}</HelpTip>
              </span>
            </div>
            <input
              id={id}
              type="range"
              min={1}
              max={5}
              step={1}
              value={current}
              onChange={(e) => set(s.key, Math.min(Number(e.target.value), max))}
              aria-valuetext={`${current} of 5, from ${s.left} to ${s.right}`}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between px-0.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "size-1.5 rounded-full",
                    n <= max ? "bg-border" : "bg-transparent",
                    n === current && "bg-primary",
                  )}
                />
              ))}
            </div>
            {s.key === "emoji" && emojiCap && emojiCap < 5 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {emojiCap === 1
                  ? "Your brand doesn't use emoji."
                  : "Your brand uses emoji sparingly, so this is capped."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TonePreview({
  value,
  adjectives = [],
}: {
  value: SliderValues;
  adjectives?: string[];
}) {
  return (
    <p
      aria-live="polite"
      className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-accent-foreground"
    >
      <span className="font-semibold">Sounds like: </span>
      {describeSliders(value, adjectives)}
    </p>
  );
}

const SHORT: Record<string, string> = { "Short & punchy": "Punchy", "Plenty of emoji": "Lots of emoji" };
const shortLabel = (s: string) => SHORT[s] ?? s.replace(/\s*\(.*\)\s*/, "");

/**
 * One ~32px row per slider: left label, track with snap ticks, right label.
 * Sliders moved away from the brand default get a dot and their own reset button.
 */
export function CompactToneSliders({
  value,
  defaults,
  onChange,
  emojiCap,
  idPrefix = "ctone",
}: {
  value: SliderValues;
  defaults: SliderValues;
  onChange: (v: SliderValues) => void;
  emojiCap?: number;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-1">
      {SLIDERS.map((s) => {
        const id = `${idPrefix}-${s.key}`;
        const max = s.key === "emoji" && emojiCap ? emojiCap : 5;
        const current = Math.min(value[s.key], max);
        const base = Math.min(defaults[s.key], max);
        const changed = current !== base;
        return (
          <div key={s.key}>
            <div className="flex h-8 items-center gap-2" title={s.help}>
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  changed ? "bg-primary" : "bg-transparent",
                )}
              />
              <label
                htmlFor={id}
                className="w-[68px] shrink-0 truncate text-[11px] leading-tight text-muted-foreground"
              >
                {shortLabel(s.left)}
              </label>
              <div className="relative flex-1">
                <input
                  id={id}
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={current}
                  onChange={(e) =>
                    onChange({ ...value, [s.key]: Math.min(Number(e.target.value), max) })
                  }
                  aria-valuetext={`${current} of 5, from ${s.left} to ${s.right}${changed ? ", changed from brand default" : ""}`}
                  className="relative z-10 block w-full accent-primary"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[7px] -bottom-1 flex justify-between"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={cn(
                        "h-1.5 w-px",
                        n <= max ? "bg-muted-foreground/40" : "bg-transparent",
                      )}
                    />
                  ))}
                </div>
              </div>
              <span className="w-[68px] shrink-0 truncate text-right text-[11px] leading-tight text-muted-foreground">
                {shortLabel(s.right)}
              </span>
              {changed ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...value, [s.key]: base })}
                  aria-label={`Reset ${s.left} to ${s.right} to brand default`}
                  title="Reset to brand default"
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                </button>
              ) : (
                <span className="size-6 shrink-0" aria-hidden="true" />
              )}
            </div>
            {s.key === "emoji" && emojiCap && emojiCap < 5 && (
              <p className="-mt-0.5 mb-1 pl-[84px] text-[11px] text-muted-foreground">
                {emojiCap === 1
                  ? "Your brand doesn't use emoji."
                  : "Your brand uses emoji sparingly, so this is capped."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
