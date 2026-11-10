import { describe, expect, it } from "vitest";
import { emptyFields } from "./content-types";
import {
  applySpanFix,
  combinedScore,
  fingerprint,
  guardSuggestion,
  isReviewFresh,
  placeholderBadges,
  scanNumbers,
  type AiReview,
} from "./review";

const fields = (body: string, hook = "") => ({ ...emptyFields(), body, hook, cta: "Talk to us." });

describe("AI brand check helpers", () => {
  it("Fix this replaces only the flagged words", () => {
    const f = fields("We hosted 5,000 guests by the river. Talk to us.", "We hosted 5,000 guests");
    const r = applySpanFix(f, "5,000 guests", "[NEEDS CONFIRMATION: guest number] guests");
    expect(r.changed).toBe(true);
    expect(r.fields.body).toBe(
      "We hosted [NEEDS CONFIRMATION: guest number] guests by the river. Talk to us.",
    );
    expect(r.fields.hook).toBe("We hosted [NEEDS CONFIRMATION: guest number] guests");
    expect(r.fields.cta).toBe("Talk to us.");
  });

  it("reports no change when the flagged words aren't in the draft", () => {
    expect(applySpanFix(fields("Hello there."), "missing words", "x").changed).toBe(false);
  });

  it("a suggested fix can't introduce a number that isn't in the facts or brief", () => {
    const sources = "We produced 120 events in 2025.";
    expect(guardSuggestion("over 300 events", "hundreds of events", sources, "Event count")).toBe(
      "[NEEDS CONFIRMATION: event count]",
    );
    expect(guardSuggestion("120 events", "hundreds of events", sources, "Event count")).toBe(
      "120 events",
    );
  });

  it("finds numbers that aren't in the approved facts or brief", () => {
    const scan = scanNumbers("120 events and 98% satisfaction", "We produced 120 events.");
    expect(scan).toEqual([
      { value: "120", supported: true },
      { value: "98%", supported: false },
    ]);
  });

  it("ignores numbers already inside a placeholder", () => {
    expect(scanNumbers("[NEEDS CONFIRMATION: 2026 date]", "")).toEqual([]);
  });

  it("counts Needs confirmation and Needs clearance placeholders", () => {
    expect(
      placeholderBadges(
        "[NEEDS CONFIRMATION: date] with [NEEDS CLEARANCE: Acme] and [needs confirmation: x]",
      ),
    ).toEqual({ confirm: 2, clear: 1 });
  });

  it("the card score is the stricter of the two checks, only while the review is current", () => {
    const f = fields("Some copy.");
    const review: AiReview = {
      score: 60,
      summary: "",
      checks: [],
      fingerprint: fingerprint(f),
      reviewed_at: "",
    };
    expect(combinedScore(92, review, isReviewFresh(review, f))).toBe(60);
    expect(combinedScore(40, review, true)).toBe(40);
    const edited = { ...f, body: "Different copy." };
    expect(isReviewFresh(review, edited)).toBe(false);
    expect(combinedScore(92, review, isReviewFresh(review, edited))).toBe(92);
  });
});
