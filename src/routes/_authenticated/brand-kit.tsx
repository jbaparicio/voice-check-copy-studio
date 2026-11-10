import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceTab } from "@/components/brand-kit/voice-tab";
import { RulesTab } from "@/components/brand-kit/rules-tab";
import { FactsTab } from "@/components/brand-kit/facts-tab";
import { NamesTab } from "@/components/brand-kit/names-tab";
import { GuidelinesTab } from "@/components/brand-kit/guidelines-tab";
import { ExamplesTab } from "@/components/brand-kit/examples-tab";
import { GoalsTab, PersonasTab } from "@/components/brand-kit/people-tabs";
import { useActiveBrand, useBrandKit } from "@/lib/use-brand";

const TABS = [
  { id: "voice", label: "Voice & tone" },
  { id: "rules", label: "Rules" },
  { id: "facts", label: "Facts & claims" },
  { id: "names", label: "Names & clearance" },
  { id: "guidelines", label: "Guidelines" },
  { id: "examples", label: "Examples" },
  { id: "personas", label: "Personas" },
  { id: "goals", label: "Business goals" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/_authenticated/brand-kit")({
  validateSearch: (s: Record<string, unknown>): { tab: TabId } => ({
    tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as TabId) : "voice",
  }),
  head: () => ({
    meta: [
      { title: "Brand Kit — Brand Voice Studio" },
      {
        name: "description",
        content:
          "Your brand's voice, rules, facts, names, examples, personas and goals in one place.",
      },
      { property: "og:title", content: "Brand Kit — Brand Voice Studio" },
      {
        property: "og:description",
        content:
          "Your brand's voice, rules, facts, names, examples, personas and goals in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandKitPage,
});

function BrandKitPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/brand-kit" });
  const { brand } = useActiveBrand();
  const kit = useBrandKit(brand?.id);

  return (
    <div className="brand-kit-screen">
      <PageHeader
        title="Brand Kit"
        description={
          <>
            Everything that makes{" "}
            <strong className="font-semibold text-foreground">{brand?.name ?? "your brand"}</strong>{" "}
            sound like itself. Set it up once and every piece of content follows it.
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as TabId }, replace: true })}
        className="px-5 py-6 md:px-10"
      >
        <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
          <TabsList className="h-auto w-max gap-1 bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="rounded-md border border-transparent px-4 py-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-card"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="mt-8 max-w-5xl">
          {!kit.data ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <TabsContent value="voice">
                <VoiceTab kit={kit.data} />
              </TabsContent>
              <TabsContent value="rules">
                <RulesTab kit={kit.data} />
              </TabsContent>
              <TabsContent value="facts">
                <FactsTab kit={kit.data} />
              </TabsContent>
              <TabsContent value="names">
                <NamesTab kit={kit.data} />
              </TabsContent>
              <TabsContent value="guidelines">
                <GuidelinesTab brandId={kit.data.brand.id} />
              </TabsContent>
              <TabsContent value="examples">
                <ExamplesTab kit={kit.data} />
              </TabsContent>
              <TabsContent value="personas">
                <PersonasTab kit={kit.data} />
              </TabsContent>
              <TabsContent value="goals">
                <GoalsTab kit={kit.data} />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
