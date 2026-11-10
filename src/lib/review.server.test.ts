import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandKit } from "./brand-kit";
import { emptyFields, splitPastedPost } from "./content-types";
import { runAiReview } from "./review.server";
import { normaliseSliders } from "./sliders";

const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("./ai-gateway.server", () => ({ writeStructured: write }));

const POST = `Most launch events get planned after the campaign is already locked.

By then the film is shot and the key visual is printed, so the event is asked to repeat both in a room. Guests notice.

The launches that work start from one idea that can live on a screen and in a room. That conversation has to happen in week one, not week twelve.

When does your live team first see the campaign brief?`;

// Only fields used by review; no database, account or brand data is changed.
const kit = { brand: { name: "Battle Royal Studios (BRS)", voice_adjectives: [], sound_like: [], spelling_variant: "en-GB", emoji_policy: "none", exclamation_channels: { linkedin: false } }, rules: [], facts: [], names: [], personas: [], goals: [], examples: [] } as unknown as BrandKit;
const input = { brief: "Existing post", keyFacts: [], link: null, personaId: null, goalId: null, exampleIds: [], sliders: normaliseSliders(null), hashtags: {} };
const FESTIVAL_POST = `Big room. Bright lights. One night nobody forgets.

Three days of load-in for a single evening at the festival, and every minute of it showed on the night.

Comment and we'll send you the full project.

#EventProduction #FestivalDesign

Client: Nordhaven Festival`;
beforeEach(() => write.mockResolvedValue({ data: { score: 0, summary: "", checks: [] } }));

describe("BRS review integration and guardrails", () => {
  it.each([
    [FESTIVAL_POST, "Big room. Bright lights. One night nobody forgets.", "three-day load-in"],
    ["Great coffee. Three logos. One confused customer.\n\nThe competing logos made the customer's choice harder.", "Great coffee. Three logos. One confused customer.", "competing logos"],
  ])("sends back a model-identified stacked hook as the main problem: %s", async (body, span, substance) => {
    const message = `Replace "${span}" with one full sentence that leads on the ${substance}.`;
    write.mockResolvedValue({ data: { score: 100, summary: "", checks: [{ category: "rules", status: "fail", label: "Stacked opening fragments", explanation: message, span, badge: null, suggested_fix: "The load-in shaped the festival evening.", impact: "send_back" }] } });
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), ...splitPastedPost(body) } });
    expect(review.verdict).toBe("Send back");
    expect(review.score).toBe(80);
    expect(review.main_problem).toBe(message);
    expect(review.checks[0]).toMatchObject({ span, impact: "send_back", badge: null });
  });
  it.each([
    "Guests notice.",
    "Guests notice. Good launches start early.",
    "Guests notice. Good launches start early. The live team shapes the idea.",
  ])("preserves a clean semantic review of complete punchy sentences: %s", async (body) => {
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), body } });
    expect(review).toMatchObject({ verdict: "Approve", score: 100, checks: [] });
  });
  it("keeps the exact opinion post at Approve / 100 with no confirmation flags", async () => {
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), ...splitPastedPost(POST) } });
    expect(review.verdict).toBe("Approve");
    expect(review.score).toBe(100);
    expect(review.checks).toEqual([]);
  });
  it("empty hook, CTA, tags and alt text cannot lower a clean opinion score", async () => {
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), body: POST } });
    expect(review.verdict).toBe("Approve");
    expect(review.score).toBe(100);
  });
  it.each(["Halvard Motors", "@HalvardMotors", "#HalvardMotors"])("never downgrades NDA mention %s even when AI misses it", async (name) => {
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), body: `${POST}\n\n${name}` } });
    expect(review.verdict).toBe("Kill");
    expect(review.score).toBe(0);
    expect(review.checks[0]?.suggestion).toBeNull();
    expect(review.checks[0]?.fix).toBeUndefined();
  });
  it("NDA tags and described images also recommend Kill", async () => {
    for (const extras of [{ hashtags: ["HalvardMotors"] }, { alt_text: "Halvard Motors launch" }]) {
      const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), body: POST, ...extras } });
      expect(review.verdict).toBe("Kill");
    }
  });
  it("preserves no-dash failures despite a clean AI response", async () => {
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), body: `${POST}\n\nIdeas — not repetition.` } });
    expect(review.verdict).toBe("Send back");
    expect(review.score).toBe(80);
  });
  it("filters optional suggestions regardless of the model's low score", async () => {
    write.mockResolvedValue({ data: { score: 20, summary: "Add extras", checks: [ { category: "rules", status: "warn", label: "Add hashtags", explanation: "Optional", span: null, badge: null, suggested_fix: null, impact: "suggestion" } ] } });
    const review = await runAiReview({ kit, channel: "linkedin", input, fields: { ...emptyFields(), body: POST } });
    expect(review).toMatchObject({ verdict: "Approve", score: 100, checks: [] });
  });
});