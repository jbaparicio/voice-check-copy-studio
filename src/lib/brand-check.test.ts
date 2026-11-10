import { describe, expect, it } from "vitest";
import { removeDashes, runBrandCheck } from "./brand-check";
import { emptyFields, type BrandKitForCheck } from "./content-types";
import { findSpellingIssues } from "./spelling";
import { getChannel, lengthStatus } from "./channels";
import { toPlainText } from "./plain-text";

const kit: BrandKitForCheck = {
  bannedWords: ["synergy", "game-changer"],
  preferred: [{ say: "guests", not: "attendees" }],
  spellingVariant: "en-GB",
  emojiPolicy: "sparing",
  exclamationAllowed: { linkedin: false },
  neverNames: ["Oakridge Motors"],
};

const body = (text: string, hashtags = ["LiveEvents", "BrandExperience", "EventProduction"]) => ({
  ...emptyFields(),
  body: text,
  hashtags,
});
const longText = "Four days, one riverside and a team who cared about every detail. ".repeat(12);

describe("brand check", () => {
  it("fails when a banned word is used", () => {
    const r = runBrandCheck(body(`${longText} Real synergy here.`), "linkedin", kit);
    expect(r.checks.find((c) => c.id === "banned")?.status).toBe("fail");
  });

  it("flags American spelling for a British English brand", () => {
    const r = runBrandCheck(body(`${longText} Our favorite color.`), "linkedin", kit);
    const s = r.checks.find((c) => c.id === "spelling");
    expect(s?.status).toBe("warn");
    expect(s?.message).toContain('"colour"');
  });

  it("flags a non-preferred term", () => {
    const r = runBrandCheck(body(`${longText} All attendees loved it.`), "linkedin", kit);
    expect(r.checks.find((c) => c.id === "preferred")?.status).toBe("warn");
  });

  it("flags exclamation marks on LinkedIn when the brand forbids them", () => {
    const r = runBrandCheck(body(`${longText} What a night!`), "linkedin", kit);
    expect(r.checks.find((c) => c.id === "exclamation")?.status).toBe("warn");
  });

  it("fails an X post over 280 characters", () => {
    const r = runBrandCheck(body("a".repeat(300), []), "x", kit);
    expect(r.checks.find((c) => c.id === "length")?.status).toBe("fail");
  });

  it("gives a clean post a score of 100", () => {
    const r = runBrandCheck(body(longText), "linkedin", kit);
    expect(r.score).toBe(100);
  });

  it("fails when a never-mention name appears", () => {
    const r = runBrandCheck(body(`${longText} Thanks Oakridge Motors.`), "linkedin", kit);
    expect(r.checks.find((c) => c.id === "names")?.status).toBe("fail");
  });
});

describe("spelling", () => {
  it("does not flag words inside brand names", () => {
    expect(findSpellingIssues("Harbourline Foods", "en-US")).toEqual([]);
  });
  it("flags British spelling for American English", () => {
    expect(findSpellingIssues("We organised it", "en-US")[0]?.suggestion).toBe("organized");
  });
});

describe("channel length", () => {
  it("LinkedIn is green between 600 and 1,300 characters", () => {
    expect(lengthStatus(getChannel("linkedin"), 900)).toBe("good");
    expect(lengthStatus(getChannel("linkedin"), 200)).toBe("off");
  });
});

describe("plain text copy", () => {
  it("removes markdown symbols", () => {
    expect(toPlainText("## Title\n**Bold** and *soft*")).toBe("Title\nBold and soft");
  });
});

describe("placeholders", () => {
  it("flags Needs confirmation and Needs clearance placeholders, including in alt text", () => {
    const f = {
      ...body(`${longText} With [NEEDS CLEARANCE: Halcyon Audio].`),
      alt_text: "Stage at night. [NEEDS CONFIRMATION: photo]",
    };
    const r = runBrandCheck(f, "linkedin", kit);
    expect(r.checks.find((c) => c.id === "placeholders")?.status).toBe("warn");
    expect(r.checks.find((c) => c.id === "clearance")?.status).toBe("warn");
    expect(r.score).toBeLessThan(100);
  });
});

describe("no-dash rule (BRS)", () => {
  const brs = { ...kit, noDashes: true };
  it("fails on an em dash", () => {
    const r = runBrandCheck(body(`${longText} We build — you feel.`), "linkedin", brs);
    expect(r.checks.find((c) => c.id === "dashes")?.status).toBe("fail");
  });
  it("fails on an en dash and a spaced hyphen", () => {
    expect(runBrandCheck(body(`${longText} Berlin – London.`), "linkedin", brs).checks.find((c) => c.id === "dashes")?.status).toBe("fail");
    expect(runBrandCheck(body(`${longText} Berlin - London.`), "linkedin", brs).checks.find((c) => c.id === "dashes")?.status).toBe("fail");
  });
  it("does not flag hyphens inside words", () => {
    const r = runBrandCheck(body(`${longText} An award-winning co-creation.`), "linkedin", brs);
    expect(r.checks.find((c) => c.id === "dashes")?.status).toBe("pass");
  });
  it("is off for brands without the rule", () => {
    const r = runBrandCheck(body(`${longText} We build — you feel.`), "linkedin", kit);
    expect(r.checks.find((c) => c.id === "dashes")).toBeUndefined();
  });
  it("fix swaps only the punctuation", () => {
    expect(removeDashes("We build — you feel.")).toBe("We build, you feel.");
    expect(removeDashes("We build – That is it.")).toBe("We build. That is it.");
    expect(removeDashes("Fast - and felt")).toBe("Fast, and felt");
    expect(removeDashes("An award-winning co-creation.")).toBe("An award-winning co-creation.");
  });
});
