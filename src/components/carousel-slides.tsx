import type { CarouselSlide } from "@/lib/content-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function CarouselSlides({ slides, id, onChange, onSave }: {
  slides: CarouselSlide[];
  id: string;
  onChange: (slides: CarouselSlide[]) => void;
  onSave: () => void;
}) {
  function edit(index: number, patch: Partial<CarouselSlide>) {
    onChange(slides.map((slide, i) => i === index ? { ...slide, ...patch } : slide));
  }
  return (
    <section aria-label="Carousel slides" className="space-y-3">
      <h4 className="font-sans text-base font-semibold">Carousel slides <span className="text-sm font-normal text-muted-foreground">{slides.length}</span></h4>
      <ol className="grid gap-3 sm:grid-cols-2">
        {slides.map((slide, i) => (
          <li key={i} className="min-w-0 space-y-3 rounded-lg border border-input bg-background p-4">
            <p className="text-xs font-semibold text-primary">Slide {i + 1} · {i === 0 ? "Cover" : i === slides.length - 1 ? "Call to action" : "Point"}</p>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-slide-${i}-headline`} className="text-xs">Slide {i + 1} headline</Label>
              <Input id={`${id}-slide-${i}-headline`} value={slide.headline} onChange={(e) => edit(i, { headline: e.target.value })} onBlur={onSave} className="font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-slide-${i}-line`} className="text-xs">Slide {i + 1} supporting line</Label>
              <Textarea id={`${id}-slide-${i}-line`} rows={2} value={slide.supporting_line ?? ""} onChange={(e) => edit(i, { supporting_line: e.target.value || null })} onBlur={onSave} className="text-sm leading-relaxed" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}