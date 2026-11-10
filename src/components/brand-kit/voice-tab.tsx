import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ChipInput, Section, ToggleChip } from "@/components/common";
import { ToneSliders, TonePreview } from "@/components/tone-sliders";
import { soundLikePairs, type BrandKit, type SoundLikePair } from "@/lib/brand-kit";
import { useKitMutations } from "@/lib/kit-mutations";
import { capEmoji, normaliseSliders, type EmojiPolicy } from "@/lib/sliders";
import { NUMBER_FORMATS, SPELLING_VARIANTS } from "@/lib/spelling";
import type { Json } from "@/integrations/supabase/types";

export const ADJECTIVE_SUGGESTIONS = [
  "confident",
  "warm",
  "witty",
  "clear",
  "thoughtful",
  "bold",
  "friendly",
  "expert",
  "calm",
  "playful",
  "honest",
  "crafted",
];

export function BasicsFields({
  value,
  onChange,
}: {
  value: {
    name: string;
    description: string;
    website: string;
    industry: string;
    language: string;
    spelling_variant: string;
    number_format: string;
  };
  onChange: (patch: Partial<typeof value>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="b-name">Brand name</Label>
        <Input
          id="b-name"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Northlight Studio"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="b-desc">What you do, in one line</Label>
        <Input
          id="b-desc"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="e.g. We design live brand experiences people remember."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-web">Website</Label>
        <Input
          id="b-web"
          type="url"
          value={value.website}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://yourbrand.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-ind">Industry</Label>
        <Input
          id="b-ind"
          value={value.industry}
          onChange={(e) => onChange({ industry: e.target.value })}
          placeholder="e.g. Events, Software, Retail"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-spell">Language and spelling</Label>
        <Select
          value={value.spelling_variant}
          onValueChange={(v) =>
            onChange({
              spelling_variant: v,
              language:
                SPELLING_VARIANTS.find((s) => s.value === v)
                  ?.label.split(" ")
                  .pop() ?? "English",
            })
          }
        >
          <SelectTrigger id="b-spell">
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
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-num">How you write big numbers</Label>
        <Select value={value.number_format} onValueChange={(v) => onChange({ number_format: v })}>
          <SelectTrigger id="b-num">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NUMBER_FORMATS.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function AdjectivePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested voice words">
        {ADJECTIVE_SUGGESTIONS.map((a) => {
          const on = value.includes(a);
          return (
            <ToggleChip
              key={a}
              pressed={on}
              onClick={() =>
                onChange(
                  on ? value.filter((x) => x !== a) : value.length >= 5 ? value : [...value, a],
                )
              }
            >
              {a}
            </ToggleChip>
          );
        })}
      </div>
      <ChipInput
        id="adjectives"
        label="Add your own voice word"
        value={value}
        onChange={(v) => onChange(v.slice(0, 5))}
        placeholder="Or type your own and press Enter"
        max={5}
      />
      <p className="text-xs text-muted-foreground">
        {value.length} of 5 chosen. Three to five works best.
      </p>
    </div>
  );
}

export function VoiceTab({ kit }: { kit: BrandKit }) {
  const { brand } = kit;
  const m = useKitMutations(brand.id);
  const [basics, setBasics] = useState(() => pickBasics(brand));
  const [sliders, setSliders] = useState(() => normaliseSliders(brand.default_sliders));
  const [adjectives, setAdjectives] = useState<string[]>(brand.voice_adjectives);
  const [pairs, setPairs] = useState<SoundLikePair[]>(() => soundLikePairs(brand));
  const [story, setStory] = useState(brand.brand_story);

  useEffect(() => {
    setBasics(pickBasics(brand));
    setSliders(normaliseSliders(brand.default_sliders));
    setAdjectives(brand.voice_adjectives);
    setPairs(soundLikePairs(brand));
    setStory(brand.brand_story);
  }, [brand]);

  const emojiCap = capEmoji(5, brand.emoji_policy as EmojiPolicy);

  function save() {
    m.updateBrand.mutate(
      {
        ...basics,
        default_sliders: sliders as unknown as Json,
        voice_adjectives: adjectives,
        sound_like: pairs.filter((p) => p.we || p.never) as unknown as Json,
        brand_story: story,
      },
      { onSuccess: () => toast.success("Voice & tone saved.") },
    );
  }

  return (
    <div className="space-y-12">
      <Section
        title="Brand basics"
        description="The essentials everyone writing for you should know."
      >
        <BasicsFields value={basics} onChange={(p) => setBasics({ ...basics, ...p })} />
      </Section>

      <Section
        title="Default tone"
        description="Where the sliders start every time someone creates content. They can still adjust them per post."
        help="These are your brand's usual settings. Think of them as 'how we normally sound'."
      >
        <div className="max-w-xl space-y-5">
          <ToneSliders
            value={sliders}
            onChange={setSliders}
            emojiCap={emojiCap}
            idPrefix="default"
          />
          <TonePreview value={sliders} adjectives={adjectives} />
        </div>
      </Section>

      <Section title="Voice words" description="Three to five words that describe how you sound.">
        <AdjectivePicker value={adjectives} onChange={setAdjectives} />
      </Section>

      <Section
        title="We sound like… / We never sound like…"
        description="Pairs that make the difference easy to feel."
        help="For example: 'A calm expert' vs 'A pushy salesperson'."
      >
        <div className="space-y-3">
          {pairs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No pairs yet. Add one to show the contrast.
            </p>
          )}
          {pairs.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                aria-label={`We sound like, pair ${i + 1}`}
                value={p.we}
                onChange={(e) =>
                  setPairs(pairs.map((x, j) => (j === i ? { ...x, we: e.target.value } : x)))
                }
                placeholder="We sound like… a calm expert"
              />
              <Input
                aria-label={`We never sound like, pair ${i + 1}`}
                value={p.never}
                onChange={(e) =>
                  setPairs(pairs.map((x, j) => (j === i ? { ...x, never: e.target.value } : x)))
                }
                placeholder="We never sound like… a pushy salesperson"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove pair ${i + 1}`}
                onClick={() => setPairs(pairs.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPairs([...pairs, { we: "", never: "" }])}
          >
            <Plus className="size-4" /> Add a pair
          </Button>
        </div>
      </Section>

      <Section
        title="Brand story"
        description="A short paragraph about where you came from and why you do what you do."
      >
        <Textarea
          aria-label="Brand story"
          rows={5}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="We started in 2015 because…"
        />
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} disabled={m.updateBrand.isPending} className="shadow-lg">
          {m.updateBrand.isPending ? "Saving…" : "Save voice & tone"}
        </Button>
      </div>
    </div>
  );
}

function pickBasics(b: BrandKit["brand"]) {
  return {
    name: b.name,
    description: b.description,
    website: b.website,
    industry: b.industry,
    language: b.language,
    spelling_variant: b.spelling_variant,
    number_format: b.number_format,
  };
}
