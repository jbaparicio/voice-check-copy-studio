import { describe, expect, it } from "vitest";
import { siblingDrafts, type DraftCandidate } from "./siblings";

const base: DraftCandidate = {
  id: "a",
  channel: "linkedin",
  variant_of: null,
  request_id: "r1",
  created_by: "u1",
  created_at: "2026-11-01T13:51:28Z",
  brief: "Post about the hackathon",
};

describe("siblingDrafts", () => {
  it("links two writers' drafts of the same brief and channel", () => {
    const other = { ...base, id: "b", request_id: "r2", created_at: "2026-11-01T13:51:41Z" };
    expect(siblingDrafts(base, [other]).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("ignores other channels, alternatives and other people's drafts", () => {
    const others = [
      { ...base, id: "c", channel: "instagram" },
      { ...base, id: "d", variant_of: "a" },
      { ...base, id: "e", created_by: "u2" },
    ];
    expect(siblingDrafts(base, others).map((d) => d.id)).toEqual(["a"]);
  });

  it("ignores the same brief written more than 30 minutes apart", () => {
    const late = { ...base, id: "f", request_id: "r3", created_at: "2026-11-01T14:30:00Z" };
    expect(siblingDrafts(base, [late]).map((d) => d.id)).toEqual(["a"]);
  });
});
