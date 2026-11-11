import { describe, expect, it } from "vitest";
import { emptyFields, allText, countedText, type ContentFields } from "./content-types";
import { schemaForChannel } from "./prompt.server";
import { getChannel } from "./channels";
import { runBrandCheck, removeDashesFromFields } from "./brand-check";
import { applySpanFix, fingerprint, isReviewFresh } from "./review";
import { plainCopy, planPublishing } from "./publish";

const kit = { noDashes: true, bannedWords: ["synergy"], preferred: [], spellingVariant: "en-GB", emojiPolicy: "none" as const, exclamationAllowed: {}, neverNames: [] };
const fields: ContentFields = {
  ...emptyFields(), body: "A room takes shape through the work that goes into it. What detail do you notice?",
  hashtags: ["EventProduction", "FestivalDesign", "SpatialDesign"], alt_text: "A crew shaping a festival space.",
  carousel_slides: [
    { headline: "The room starts with the crew", supporting_line: null },
    { headline: "Build from the plan", supporting_line: "The layout shapes how people move." },
    { headline: "Make room for people", supporting_line: "Sightlines keep the stage in view." },
    { headline: "Tell us what you noticed", supporting_line: "Which detail stayed with you?" },
  ],
};
describe("Instagram carousel", () => {
  it("accepts 4 through 7 slides and rejects 3 or 8", () => {
    for (const count of [3, 4, 5, 6, 7, 8]) {
      const copy = { ...fields, carousel_slides: Array.from({ length: count }, () => ({ headline: "One point", supporting_line: "One short line." })) };
      expect(schemaForChannel("instagram_carousel").safeParse(copy).success).toBe(count >= 4 && count <= 7);
    }
  });
  it("a chosen slide count requires exactly that many slides", () => {
    for (const count of [8, 9, 10]) {
      const copy = { ...fields, carousel_slides: Array.from({ length: count }, () => ({ headline: "One point", supporting_line: "One short line." })) };
      expect(schemaForChannel("instagram_carousel", undefined, 9).safeParse(copy).success).toBe(count === 9);
    }
  });
  it("requires 3 through 8 generated hashtags and cover alt text", () => {
    for (const count of [2, 3, 8, 9]) expect(schemaForChannel("instagram_carousel").safeParse({ ...fields, hashtags: Array.from({ length: count }, (_, i) => `Tag${i}`) }).success).toBe(count >= 3 && count <= 8);
    expect(schemaForChannel("instagram_carousel").safeParse({ ...fields, alt_text: null }).success).toBe(false);
  });
  it("enforces phone-sized headline and supporting line limits", () => {
    expect(schemaForChannel("instagram_carousel").safeParse({ ...fields, carousel_slides: fields.carousel_slides?.map((s) => ({ ...s, headline: "x".repeat(81) })) }).success).toBe(false);
    expect(schemaForChannel("instagram_carousel").safeParse({ ...fields, carousel_slides: fields.carousel_slides?.map((s) => ({ ...s, supporting_line: "x".repeat(141) })) }).success).toBe(false);
  });
  it("leaves the existing caption channel and old draft fields valid", () => {
    expect(getChannel("instagram").label).toBe("Instagram caption");
    expect(schemaForChannel("instagram").safeParse(emptyFields()).success).toBe(true);
  });
  it("checks slide text but counts only the caption and hashtags for platform length", () => {
    expect(allText(fields)).toContain("Build from the plan");
    expect(countedText(fields)).not.toContain("Build from the plan");
    expect(runBrandCheck(fields, "instagram_carousel", kit).score).toBe(100);
    const bad = { ...fields, carousel_slides: fields.carousel_slides?.map((s) => ({ ...s, headline: "Real synergy — here" })) };
    const checks = runBrandCheck(bad, "instagram_carousel", kit).checks;
    expect(checks.find((c) => c.id === "banned")?.status).toBe("fail");
    expect(checks.find((c) => c.id === "dashes")?.status).toBe("fail");
    expect(allText(removeDashesFromFields(bad))).not.toContain("—");
  });
  it("marks an edited slide review stale and fixes only the matching words", () => {
    const fixed = applySpanFix(fields, "Build from the plan", "Build around the plan");
    expect(fixed.changed).toBe(true);
    expect(fixed.fields.body).toBe(fields.body);
    expect(fixed.fields.carousel_slides?.[1]?.headline).toBe("Build around the plan");
    expect(isReviewFresh({ score: 100, summary: "", checks: [], fingerprint: fingerprint(fields), reviewed_at: "" }, fixed.fields)).toBe(false);
  });
  it("copies slides in order with caption, hashtags and cover alt text", () => {
    const text = plainCopy(fields);
    expect(text.indexOf("Slide 1")).toBeLessThan(text.indexOf("Slide 4"));
    expect(text).toContain(fields.body);
    expect(text).toContain("#EventProduction");
    expect(text).toContain("Cover alt text: A crew shaping a festival space.");
  });
  it("plans only approved carousels for Instagram without enabling live posting", () => {
    const { rows, skipped } = planPublishing([{ id: "a", channel: "instagram_carousel", status: "approved" }, { id: "k", channel: "instagram_carousel", status: "killed" }], ["instagram"]);
    expect(rows.map((r) => r.item.id)).toEqual(["a"]);
    expect(rows[0]?.platform.live).toBe(false);
    expect(skipped.map((i) => i.id)).toEqual(["k"]);
  });
});