import { describe, expect, it } from "vitest";
import { DEFAULT_WRITER_MODEL, getWriterModel, isWriterModel, WRITER_MODELS } from "./models";

describe("writer models", () => {
  it("offers Claude, Gemini and GPT in the curated list", () => {
    const makers = new Set(WRITER_MODELS.map((m) => m.maker));
    expect(makers).toEqual(new Set(["Google", "Anthropic", "OpenAI"]));
  });

  it("only accepts models from the curated list", () => {
    expect(isWriterModel("anthropic/claude-sonnet-5")).toBe(true);
    expect(isWriterModel("someone/else")).toBe(false);
  });

  it("falls back to the house writer for unknown models", () => {
    expect(getWriterModel("someone/else").id).toBe(DEFAULT_WRITER_MODEL);
  });

  it("lists models from cheapest to priciest", () => {
    const levels = WRITER_MODELS.map((m) => m.costLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
});
