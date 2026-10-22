import { describe, expect, it } from "vitest";
import { mulberry32, paginateLines, segmentGraphemes } from "./handwriting";

describe("handwriting helpers", () => {
  it("creates a deterministic random sequence", () => {
    const first = mulberry32(42);
    const second = mulberry32(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("splits lines into pages", () => {
    const lines = Array.from({ length: 25 }, (_, index) => index);
    expect(paginateLines(lines, 10)).toEqual([
      lines.slice(0, 10),
      lines.slice(10, 20),
      lines.slice(20),
    ]);
  });

  it("keeps a blank document on one empty page", () => {
    expect(paginateLines([], 10)).toEqual([[]]);
  });

  it("segments Chinese text without dropping characters", () => {
    const text = "消防安全，人人有责。";
    expect(segmentGraphemes(text).join("")).toBe(text);
  });
});
