import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CheckCircle2, PenLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { TryDemoButton } from "@/components/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brand Voice Studio — on-brand content for every channel" },
      {
        name: "description",
        content:
          "Set up your Brand Kit once, then write on-brand LinkedIn posts, captions, emails and articles in three simple steps.",
      },
      { property: "og:title", content: "Brand Voice Studio — on-brand content for every channel" },
      {
        property: "og:description",
        content:
          "Set up your Brand Kit once, then write on-brand posts, emails and articles in three simple steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { n: 1, title: "What", text: "Say what you want to share, in your own words." },
  { n: 2, title: "Who & why", text: "Pick who it's for, your goal and the channels." },
  { n: 3, title: "How it should feel", text: "Nudge the tone with simple sliders." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <Button variant="ghost" asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 md:pt-24">
          <p className="text-sm font-medium text-primary">For marketing teams</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1.05] md:text-7xl">
            Every post sounds like you. Every time.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Set up your Brand Kit once — tone, rules, facts and audiences. Then anyone on your team
            can write on-brand content for nine channels, checked before a person approves it.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link to="/auth">
                Get started free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <TryDemoButton size="lg" variant="outline" className="h-12 px-6 text-base">
              Try the demo, no sign-up
            </TryDemoButton>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            The demo opens a sample brand with drafts, reviews and approved posts ready to explore.
          </p>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="grid size-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary">
                  {s.n}
                </span>
                <h2 className="mt-4 text-2xl font-medium">{s.title}</h2>
                <p className="mt-2 text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-3">
          <Feature icon={<BookOpen className="size-5" />} title="One Brand Kit">
            Voice, banned words, preferred terms, approved facts, personas and goals — in one calm
            place.
          </Feature>
          <Feature icon={<PenLine className="size-5" />} title="Drafts for each channel">
            LinkedIn, Instagram, TikTok, X, Facebook, blog, newsletter, case study and email — each
            written the way that channel works.
          </Feature>
          <Feature icon={<ShieldCheck className="size-5" />} title="Checked, never invented">
            Every draft gets a brand score. Missing facts become clear placeholders, never guesses.
            Nothing is published automatically.
          </Feature>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> Brand Voice Studio
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-sans text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}
