import { Section } from "@/components/common";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHANNELS } from "@/lib/channels";
import { exclamationMap, type BrandKit, type RuleType } from "@/lib/brand-kit";
import { useKitMutations } from "@/lib/kit-mutations";
import { SPELLING_VARIANTS } from "@/lib/spelling";
import { SimpleList } from "./simple-list";

export function RulesTab({ kit }: { kit: BrandKit }) {
  const m = useKitMutations(kit.brand.id);
  const items = (type: RuleType) =>
    kit.rules
      .filter((r) => r.type === type)
      .map((r) => ({ id: r.id, text: r.text, secondary: r.replaces }));
  const add = (type: RuleType) => (text: string, replaces?: string) =>
    m.add.mutate({ table: "brand_rules", row: { type, text, replaces: replaces ?? null } });
  const remove = (id: string) => m.remove.mutate({ table: "brand_rules", id });
  const excl = exclamationMap(kit.brand);

  return (
    <div className="space-y-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Do" description="Habits that make your writing feel like you.">
          <SimpleList
            id="do"
            items={items("do")}
            onAdd={add("do")}
            onRemove={remove}
            placeholder="e.g. Lead with the customer's outcome"
            empty="No 'do' rules yet."
          />
        </Section>
        <Section title="Don't" description="Things to steer clear of.">
          <SimpleList
            id="dont"
            items={items("dont")}
            onAdd={add("dont")}
            onRemove={remove}
            placeholder="e.g. Don't promise results we can't measure"
            empty="No 'don't' rules yet."
          />
        </Section>
      </div>

      <Section
        title="Banned words and phrases"
        description="These will never be used, and the brand check flags them if they slip in."
      >
        <SimpleList
          id="banned"
          items={items("banned")}
          onAdd={add("banned")}
          onRemove={remove}
          placeholder="e.g. synergy"
          empty="No banned words yet. Common ones: synergy, game-changer, world-class."
        />
      </Section>

      <Section
        title="Preferred terms"
        description="Say this, not that."
        help='For example: say "guests", not "attendees".'
      >
        <SimpleList
          id="preferred"
          items={items("preferred")}
          onAdd={add("preferred")}
          onRemove={remove}
          placeholder="Say… e.g. guests"
          secondPlaceholder="Not… e.g. attendees"
          empty="No preferred terms yet."
          render={(i) => (
            <>
              Say <strong className="font-semibold">{i.text}</strong>, not{" "}
              <span className="text-muted-foreground line-through">{i.secondary}</span>
            </>
          )}
        />
      </Section>

      <Section title="Formatting rules" description="Small details that keep things consistent.">
        <SimpleList
          id="formatting"
          items={items("formatting")}
          onAdd={add("formatting")}
          onRemove={remove}
          placeholder="e.g. Write m² not m2"
          empty="No formatting rules yet."
        />
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Emoji" description="How freely emoji can be used.">
          <RadioGroup
            value={kit.brand.emoji_policy}
            onValueChange={(v) => m.updateBrand.mutate({ emoji_policy: v })}
            className="space-y-2"
          >
            {[
              { v: "none", l: "None", d: "We never use emoji." },
              { v: "sparing", l: "Sparing", d: "Up to three, only when they add meaning." },
              { v: "free", l: "Free", d: "Use them wherever they fit." },
            ].map((o) => (
              <Label
                key={o.v}
                htmlFor={`emoji-${o.v}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal"
              >
                <RadioGroupItem id={`emoji-${o.v}`} value={o.v} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{o.l}</span>
                  <span className="block text-sm text-muted-foreground">{o.d}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </Section>

        <Section title="Spelling" description="Which spelling everything should follow.">
          <Select
            value={kit.brand.spelling_variant}
            onValueChange={(v) => m.updateBrand.mutate({ spelling_variant: v })}
          >
            <SelectTrigger aria-label="Spelling variant" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPELLING_VARIANTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>
      </div>

      <Section title="Exclamation marks" description="Choose where they're allowed.">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((c) => {
            const on = excl[c.id] ?? true;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <Label htmlFor={`excl-${c.id}`} className="font-normal">
                  {c.label}
                </Label>
                <Switch
                  id={`excl-${c.id}`}
                  checked={on}
                  onCheckedChange={(checked) =>
                    m.updateBrand.mutate({ exclamation_channels: { ...excl, [c.id]: checked } })
                  }
                />
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
