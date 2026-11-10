import { describe, expect, it } from "vitest";
import { PLATFORMS, canPublish, linkedInComposerUrl, planPublishing } from "./publish";

describe("publishing", () => {
  it("only approved pieces can be sent to LinkedIn", () => {
    expect(canPublish("approved")).toBe(true);
    expect(canPublish("in_review")).toBe(false);
    expect(canPublish("draft")).toBe(false);
    expect(canPublish("changes_requested")).toBe(false);
  });

  it("opens LinkedIn's post box with the text filled in, keeping line breaks and hashtags", () => {
    const url = linkedInComposerUrl("Hello & welcome\n\n#LiveEvents");
    expect(url).toBe(
      "https://www.linkedin.com/feed/?shareActive=true&text=Hello%20%26%20welcome%0A%0A%23LiveEvents",
    );
  });
});

describe("publishing to several platforms", () => {
  const items = [
    { id: "a", channel: "linkedin", status: "approved" },
    { id: "b", channel: "blog", status: "approved" },
    { id: "c", channel: "linkedin", status: "in_review" },
    { id: "d", channel: "tiktok", status: "approved" },
  ];

  it("sends each approved piece only to platforms that fit its channel", () => {
    const { rows } = planPublishing(items, ["linkedin", "substack", "medium"]);
    expect(rows.map((r) => `${r.item.id}->${r.platform.id}`)).toEqual([
      "a->linkedin",
      "b->substack",
      "b->medium",
    ]);
  });

  it("skips pieces that aren't approved or have no matching platform", () => {
    const { skipped } = planPublishing(items, ["linkedin", "substack", "medium"]);
    expect(skipped.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("only LinkedIn is actually connected for now", () => {
    expect(PLATFORMS.filter((p) => p.live).map((p) => p.id)).toEqual(["linkedin"]);
  });
});
