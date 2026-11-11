import { describe, expect, it } from "vitest";
import { groupTopics, canDeleteContent } from "./library-topics";

const piece = (id: string, request_id: string | null, created_at = "2026-11-11") => ({
  id, request_id, created_at, channel: "linkedin", status: "approved",
  content_requests: { brief: "  Launch planning\nMore detail" },
});
describe("Library topics", () => {
  it("groups multiple formats by request, with the trimmed first brief line", () => {
    const topics = groupTopics([piece("a", "r"), { ...piece("b", "r"), channel: "blog" }]);
    expect(topics).toHaveLength(1);
    expect(topics[0]?.pieces.map(p => p.channel)).toEqual(["linkedin", "blog"]);
    expect(topics[0]?.title).toBe("Launch planning");
  });
  it("keeps identical briefs from different requests separate and newest first", () => {
    expect(groupTopics([piece("a", "old", "2026-11-10"), piece("b", "new")]).map(t => t.id)).toEqual(["new", "old"]);
  });
  it("keeps single checks and legacy pieces as individual topics", () => {
    expect(groupTopics([piece("a", "r"), piece("b", null), piece("c", null)]).map(t => t.pieces.length)).toEqual([1, 1, 1]);
  });
});
describe("content deletion permissions", () => {
  it("allows admins and owners", () => {
    expect(canDeleteContent(["admin"])).toBe(true);
    expect(canDeleteContent([], true)).toBe(true);
  });
  it("does not grant deletion to approvers or editors", () => {
    expect(canDeleteContent(["approver", "editor"])).toBe(false);
    expect(canDeleteContent(undefined)).toBe(false);
  });
});