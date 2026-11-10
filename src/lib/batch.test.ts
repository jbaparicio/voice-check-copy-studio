import { describe, expect, it } from "vitest";
import { matchChannel, splitBatch } from "./batch";

describe("splitBatch", () => {
  it("splits on lines of three hyphens and uses the batch channel", () => {
    const posts = splitBatch("First post.\n---\nSecond post.\n\nMore.", "linkedin");
    expect(posts).toEqual([
      { channel: "linkedin", text: "First post." },
      { channel: "linkedin", text: "Second post.\n\nMore." },
    ]);
  });
  it("reads an optional Channel line per post", () => {
    const posts = splitBatch("Channel: Instagram\nPortfolio shot.\n---\nArgument post.", "linkedin");
    expect(posts[0]).toEqual({ channel: "instagram", text: "Portfolio shot." });
    expect(posts[1].channel).toBe("linkedin");
  });
  it("does not split on hyphens inside text and skips empty posts", () => {
    const posts = splitBatch("An award-winning team - really.\n---\n\n---\n", "tiktok");
    expect(posts).toEqual([{ channel: "tiktok", text: "An award-winning team - really." }]);
  });
  it("matches channel names loosely", () => {
    expect(matchChannel("TikTok")).toBe("tiktok");
    expect(matchChannel("linkedin")).toBe("linkedin");
    expect(matchChannel("nonsense")).toBeNull();
  });
});
