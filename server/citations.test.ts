import { describe, expect, it } from "vitest";
import { collectAllowedPages, validateCitations } from "./citations";

describe("citation validation", () => {
  it("keeps citations grounded in supplied evidence", () => {
    const result = validateCitations("The answer is supported [[p.12]].", {
      allowedPages: new Set([12]),
      currentPage: 14,
      spoilerMode: "safe",
      pageCount: 100,
    });
    expect(result.validPages).toEqual([12]);
    expect(result.text).toContain("[[p.12]]");
  });

  it("strips future-page citations before a safe-mode answer reaches the reader", () => {
    const result = validateCitations("Later this changes [[p.19]].", {
      allowedPages: new Set([19]),
      currentPage: 14,
      spoilerMode: "safe",
      pageCount: 100,
    });
    expect(result.futurePages).toEqual([19]);
    expect(result.text).not.toContain("[[p.19]]");
  });

  it("strips invented pages even when they are behind the reader", () => {
    const result = validateCitations("This supposedly happened [[p.8]].", {
      allowedPages: new Set([7]),
      currentPage: 14,
      spoilerMode: "safe",
      pageCount: 100,
    });
    expect(result.unsupportedPages).toEqual([8]);
    expect(result.text).not.toContain("[[p.8]]");
  });

  it("recognises both evidence markers and page ranges", () => {
    expect(Array.from(collectAllowedPages(["[p.12] and pp.21–23"]))).toEqual([12, 21, 22, 23]);
  });
});
