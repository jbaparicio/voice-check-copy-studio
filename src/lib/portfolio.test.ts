import { describe, expect, it } from "vitest";
import { BRS_PORTFOLIO, buildChannelPrompt, contentSchema, schemaForChannel } from "./prompt.server";
import { buildBRSReviewContext } from "./review.server";
import { emptyFields } from "./content-types";
import { runBrandCheck } from "./brand-check";
import { kitForCheck } from "./brand-kit";
import type { BrandKit } from "./brand-kit";
import { normaliseSliders } from "./sliders";

const kit = { brand: { name: "Battle Royal Studios", sound_like: [], voice_adjectives: [], spelling_variant: "en-GB", emoji_policy: "none", exclamation_channels: {} }, rules: [], facts: [], names: [], personas: [], goals: [], examples: [] } as unknown as BrandKit;
const input = { brief: "Sample project", keyFacts: [], link: null, personaId: null, goalId: null, exampleIds: [], sliders: normaliseSliders(null), hashtags: {} };
describe("BRS-only portfolio format", () => {
  it("treats Markdown checklist and nested list markers as layout, but flags prose dashes", () => {
    const fields = { ...emptyFields(), portfolio_format: "brs" as const, body: "## What we delivered\n\n- [x] Design\n  - Integrated scope: spatial and technical." };
    expect(runBrandCheck(fields, "case_study", kitForCheck(kit)).checks.find(c => c.id === "dashes")?.status).toBe("pass");
    expect(runBrandCheck({ ...fields, body: fields.body + "\n\nDesign - with substance." }, "case_study", kitForCheck(kit)).checks.find(c => c.id === "dashes")?.status).toBe("fail");
  });
  it("requires no FAQ for BRS but retains the generic schema for other brands", () => {
    const fields = { ...emptyFields(), portfolio_format: "brs", h1: "Spatial design with TikTok at OMR", hook: "A space for conversation. It welcomed 500 people.", h2s: ["Culture", "Build", "Scope", "People", "Results", "Reflection", "Credits"], meta_description: "Discover our Hamburg brand experience." };
    expect(schemaForChannel("case_study", kit).safeParse(fields).success).toBe(true);
    expect(schemaForChannel("case_study", kit).safeParse({ ...fields, faq: [{ question: "Why?", answer: "Because." }] }).success).toBe(false);
    const other = { ...kit, brand: { ...kit.brand, name: "Northlight Studio" } };
    expect(schemaForChannel("case_study", other)).toBe(contentSchema);
    expect(schemaForChannel("blog", kit)).toBe(contentSchema);
  });
  it("requires the ordered heading set and search description limit", () => {
    const schema = schemaForChannel("case_study", kit);
    const fields = { ...emptyFields(), portfolio_format: "brs", h1: "Design with TikTok at OMR", hook: "A space for people. It held 500 guests.", h2s: Array.from({ length: 7 }, (_, i) => `Beat ${i}`), meta_description: "Discover our Hamburg experience." };
    expect(schema.safeParse({ ...fields, h2s: ["Context"] }).success).toBe(false);
    expect(schema.safeParse({ ...fields, meta_description: "x".repeat(156) }).success).toBe(false);
  });
  it("does not impose BRS project writing on generic case studies or other channels", () => {
    const brs = buildChannelPrompt(kit, "case_study", input);
    expect(brs).toContain(BRS_PORTFOLIO);
    expect(brs).not.toContain('"faq" (3 questions');
    const other = { ...kit, brand: { ...kit.brand, name: "Northlight Studio" } };
    expect(buildChannelPrompt(other, "case_study", input)).not.toContain(BRS_PORTFOLIO);
    expect(buildChannelPrompt(other, "case_study", input)).toContain('"faq" (3 questions');
    expect(buildChannelPrompt(kit, "linkedin", input)).not.toContain(BRS_PORTFOLIO);
  });
  it("provides project-specific reviewer exceptions without changing social review context", () => {
    expect(buildBRSReviewContext(kit, "case_study", input)).toContain("No FAQ is required or wanted");
    expect(buildBRSReviewContext(kit, "case_study", input)).toContain("Credits must use only brief-supplied names/companies");
    expect(buildBRSReviewContext(kit, "linkedin", input)).not.toContain("BRS PROJECT PAGE:");
  });
});