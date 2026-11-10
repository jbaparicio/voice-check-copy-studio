import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/logo";
import { BasicsFields, AdjectivePicker } from "@/components/brand-kit/voice-tab";
import { GuidelineUploader } from "@/components/brand-kit/guidelines-tab";
import { GoalForm, PersonaForm } from "@/components/brand-kit/people-tabs";
import { ToneSliders, TonePreview } from "@/components/tone-sliders";
import { DEFAULT_SLIDERS, type SliderValues } from "@/lib/sliders";
import { useActiveBrand } from "@/lib/use-brand";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your brand — Brand Voice Studio" },
      {
        name: "description",
        content: "A friendly five-minute setup for your brand's voice, tone and audience.",
      },
      { property: "og:title", content: "Set up your brand — Brand Voice Studio" },
      {
        property: "og:description",
        content: "A friendly five-minute setup for your brand's voice, tone and audience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Brand basics", "Tone of voice", "Guidelines", "Audience & goal"];

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { brands, profile } = useActiveBrand();
  const [step, setStep] = useState(0); // 0 = welcome, 1..4 = steps, 5 = done
  const [brandId, setBrandId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [basics, setBasics] = useState({
    name: "",
    description: "",
    website: "",
    industry: "",
    language: "English",
    spelling_variant: "en-GB",
    number_format: "25,000",
  });
  const [sliders, setSliders] = useState<SliderValues>(DEFAULT_SLIDERS);
  const [adjectives, setAdjectives] = useState<string[]>([]);
  const [savedPersona, setSavedPersona] = useState<string | null>(null);
  const [savedGoal, setSavedGoal] = useState<string | null>(null);

  async function finishOnboarding(activeBrand?: string) {
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({ onboarding_done: true, ...(activeBrand ? { active_brand_id: activeBrand } : {}) })
      .eq("id", profile.id);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function start() {
    setBusy(true);
    let workspaceId = brands[0]?.workspace_id;
    if (!workspaceId) {
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .limit(1)
        .single();
      workspaceId = data?.workspace_id;
    }
    if (!workspaceId) {
      setBusy(false);
      return void toast.error("We couldn't find your team. Please refresh and try again.");
    }
    const { data, error } = await supabase
      .from("brands")
      .insert({ workspace_id: workspaceId, name: "My brand" })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return void toast.error("We couldn't start your brand. Please try again.");
    setBrandId(data.id);
    await finishOnboarding(data.id);
    qc.invalidateQueries({ queryKey: ["brands"] });
    setStep(1);
  }

  async function exploreSample() {
    await finishOnboarding();
    navigate({ to: "/create" });
  }

  async function saveStep() {
    if (!brandId) return;
    if (step === 1) {
      await supabase
        .from("brands")
        .update({ ...basics, name: basics.name.trim() || "My brand" })
        .eq("id", brandId);
      qc.invalidateQueries({ queryKey: ["brands"] });
    }
    if (step === 2) {
      await supabase
        .from("brands")
        .update({ default_sliders: sliders as unknown as Json, voice_adjectives: adjectives })
        .eq("id", brandId);
    }
    qc.invalidateQueries({ queryKey: ["kit", brandId] });
  }

  async function next(skip = false) {
    if (!skip) await saveStep();
    setStep((s) => s + 1);
  }

  if (step === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-20">
        <Logo />
        <h1 className="mt-10 text-4xl font-medium md:text-5xl">
          Let's get your brand sounding like itself.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Set up your Brand Kit once — your tone, rules and audience — and anyone on your team can
          write on-brand posts, emails and articles in three simple steps.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <button
            onClick={start}
            disabled={busy}
            className="group rounded-2xl border-2 border-primary bg-primary-soft p-6 text-left transition hover:shadow-md focus-visible:outline-2"
          >
            <Sparkles className="size-6 text-primary" aria-hidden="true" />
            <h2 className="mt-4 font-sans text-lg font-semibold">Set up my brand</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              About five minutes. You can skip any step and come back later.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              {busy ? "Getting ready…" : "Start setup"} <ArrowRight className="size-4" />
            </span>
          </button>
          <button
            onClick={exploreSample}
            className="rounded-2xl border bg-card p-6 text-left transition hover:shadow-md"
          >
            <PenLine className="size-6 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-sans text-lg font-semibold">Try the sample brand first</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore with{" "}
              <strong className="font-medium text-foreground">Northlight Studio</strong>, a made-up
              events agency that's already fully set up.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
              Explore <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-4xl font-medium">You're all set</h1>
        <p className="mt-3 text-muted-foreground">
          Your Brand Kit is ready. You can add rules, facts and examples any time to make it even
          sharper.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link to="/create">
              <PenLine className="size-4" /> Create your first post
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/brand-kit" search={{ tab: "voice" }}>
              Review Brand Kit
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {step} of {STEPS.length}: {STEPS[step - 1]}
          </span>
          <span className="text-muted-foreground">About {Math.max(1, 5 - step)} min left</span>
        </div>
        <Progress
          value={(step / STEPS.length) * 100}
          aria-label={`Setup progress: step ${step} of ${STEPS.length}`}
        />
      </div>

      {step === 1 && (
        <StepFrame
          title="Brand basics"
          description="The essentials. Only the name really matters right now."
        >
          <BasicsFields value={basics} onChange={(p) => setBasics({ ...basics, ...p })} />
        </StepFrame>
      )}

      {step === 2 && (
        <StepFrame
          title="How do you sound?"
          description="Set your usual tone. Anyone creating content can still adjust it per post."
        >
          <div className="space-y-8">
            <ToneSliders value={sliders} onChange={setSliders} idPrefix="onb" />
            <TonePreview value={sliders} adjectives={adjectives} />
            <div>
              <h3 className="mb-3 font-sans text-base font-semibold">
                Pick 3–5 words that describe your voice
              </h3>
              <AdjectivePicker value={adjectives} onChange={setAdjectives} />
            </div>
          </div>
        </StepFrame>
      )}

      {step === 3 && brandId && (
        <StepFrame
          title="Got brand guidelines?"
          description="Optional. Upload your brand book or tone of voice guide and we'll keep it with your Brand Kit."
        >
          <GuidelineUploader brandId={brandId} compact />
        </StepFrame>
      )}

      {step === 4 && brandId && (
        <StepFrame
          title="Who are you talking to, and why?"
          description="Add one persona and one business goal. You can add more later."
        >
          <div className="space-y-10">
            <div>
              <h3 className="mb-4 font-sans text-base font-semibold">Your first persona</h3>
              {savedPersona ? (
                <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
                  <Check className="mr-1 inline size-4" /> Saved "{savedPersona}"
                </p>
              ) : (
                <PersonaForm
                  submitLabel="Save persona"
                  onSave={async (row) => {
                    const { error } = await supabase
                      .from("personas")
                      .insert({ ...row, brand_id: brandId });
                    if (error) return void toast.error("That didn't save.");
                    setSavedPersona(row.name);
                  }}
                />
              )}
            </div>
            <div>
              <h3 className="mb-4 font-sans text-base font-semibold">Your first business goal</h3>
              {savedGoal ? (
                <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
                  <Check className="mr-1 inline size-4" /> Saved "{savedGoal}"
                </p>
              ) : (
                <GoalForm
                  submitLabel="Save goal"
                  onSave={async (row) => {
                    const { error } = await supabase
                      .from("goals")
                      .insert({ ...row, brand_id: brandId });
                    if (error) return void toast.error("That didn't save.");
                    setSavedGoal(row.name);
                  }}
                />
              )}
            </div>
          </div>
        </StepFrame>
      )}

      <div className="mt-10 flex items-center justify-between gap-3 border-t pt-6">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => next(true)}>
            Skip for now
          </Button>
          <Button onClick={() => next(false)}>
            {step === STEPS.length ? "Finish" : "Continue"} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby="step-title">
      <h1 id="step-title" className="text-3xl font-medium">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
