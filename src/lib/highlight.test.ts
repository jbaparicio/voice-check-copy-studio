import { describe, expect, it } from "vitest";
import { markSpans } from "./highlight";
import { slideRange, normaliseSlideCount } from "./carousel-count";

describe("markSpans", () => {
  it("marks every exact occurrence and keeps the text intact", () => {
    const p = markSpans("Big room. Big room again.", [{ id: "a", span: "Big room" }]);
    expect(p.filter((x) => x.flagId === "a")).toHaveLength(2);
    expect(p.map((x) => x.text).join("")).toBe("Big room. Big room again.");
  });
  it("leaves text without matches untouched", () => {
    expect(markSpans("Hello", [{ id: "a", span: "zzz" }])).toEqual([{ text: "Hello", flagId: null }]);
  });
});

describe("carousel slide count", () => {
  it("Auto keeps 4 to 7", () => expect(slideRange(null)).toEqual([4, 7]));
  it("a chosen number means exactly that many", () => expect(slideRange(9)).toEqual([9, 9]));
  it("only 3 to 10 can be chosen", () => {
    expect(normaliseSlideCount(2)).toBeNull();
    expect(normaliseSlideCount(11)).toBeNull();
    expect(normaliseSlideCount(3)).toBe(3);
  });
});
