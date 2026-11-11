import { describe, expect, it } from "vitest";
import { availableActions, csvCell, toCsv } from "./workflow";
import { canPublish } from "./publish";

describe("approval rules", () => {
  it("only approvers get the Approve button", () => {
    expect(availableActions("in_review", false)).not.toContain("approve");
    expect(availableActions("in_review", true)).toContain("approve");
  });

  it("only approvers can request changes", () => {
    expect(availableActions("in_review", false)).not.toContain("request_changes");
    expect(availableActions("in_review", true)).toContain("request_changes");
  });

  it("anyone can send a draft or changes-requested piece for review", () => {
    expect(availableActions("draft", false)).toContain("submit");
    expect(availableActions("changes_requested", false)).toContain("submit");
    expect(availableActions("in_review", false)).not.toContain("submit");
  });

  it("approved content can't be approved again", () => {
    expect(availableActions("approved", true)).not.toContain("approve");
  });
});

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Say "hi", then\nleave')).toBe('"Say ""hi"", then\nleave"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-5 days")).toBe("'-5 days");
  });

  it("joins rows with Windows line endings for Excel", () => {
    expect(toCsv(["A", "B"], [["1", null]])).toBe("A,B\r\n1,");
  });
});

describe("kill verdict", () => {
  it("approvers can kill any live piece", () => {
    expect(availableActions("in_review", true)).toContain("kill");
    expect(availableActions("approved", true)).toContain("kill");
  });
  it("non-approvers cannot kill", () => {
    expect(availableActions("in_review", false)).not.toContain("kill");
  });
  it("killed is terminal and never publishable", () => {
    expect(availableActions("killed", true)).toEqual([]);
    expect(canPublish("killed")).toBe(false);
  });
});
