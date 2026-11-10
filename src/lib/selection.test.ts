import { describe, expect, it } from "vitest";
import { locateSelection, spliceText } from "./selection";

const text = "We build events people remember. Our team is small but mighty.";

describe("highlight and change", () => {
  it("replaces only the highlighted words and keeps the rest exactly", () => {
    const start = text.indexOf("small but mighty");
    const range = locateSelection(text, start, start + 16, "small but mighty")!;
    expect(spliceText(text, range, "compact and focused")).toBe(
      "We build events people remember. Our team is compact and focused.",
    );
  });

  it("finds the words again when the offsets are out of date", () => {
    expect(locateSelection(text, 0, 5, "people remember")).toEqual({ start: 16, end: 31 });
  });

  it("refuses to guess when the highlighted words appear twice", () => {
    expect(locateSelection("go go go", 50, 52, "go")).toBeNull();
  });

  it("removing words leaves no double space", () => {
    const range = locateSelection(text, 0, 0, "small but ")!;
    expect(spliceText(text, range, "")).toBe("We build events people remember. Our team is mighty.");
  });
});
