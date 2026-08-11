import { describe, expect, it } from "vitest";
import { parseEvidenceCitations, extractCitedPages } from "./evidenceParser";

describe("parseEvidenceCitations", () => {
  it("returns a single text segment when no citations present", () => {
    const result = parseEvidenceCitations("This is a plain answer.");
    expect(result).toEqual([{ type: "text", content: "This is a plain answer." }]);
  });

  it("parses a single citation correctly", () => {
    const result = parseEvidenceCitations("This connects to the locket [[p.47]].");
    expect(result).toEqual([
      { type: "text", content: "This connects to the locket " },
      { type: "citation", page: 47, label: "p.47" },
      { type: "text", content: "." },
    ]);
  });

  it("parses multiple citations in one answer", () => {
    const result = parseEvidenceCitations("See [[p.12]] and also [[p.200]] for more.");
    expect(result).toHaveLength(5);
    expect(result[1]).toEqual({ type: "citation", page: 12, label: "p.12" });
    expect(result[3]).toEqual({ type: "citation", page: 200, label: "p.200" });
  });

  it("handles citation at the very start", () => {
    const result = parseEvidenceCitations("[[p.5]] starts here.");
    expect(result[0]).toEqual({ type: "citation", page: 5, label: "p.5" });
  });

  it("handles citation at the very end", () => {
    const result = parseEvidenceCitations("Ends here [[p.99]]");
    expect(result[result.length - 1]).toEqual({ type: "citation", page: 99, label: "p.99" });
  });
});

describe("extractCitedPages", () => {
  it("returns empty array when no citations", () => {
    expect(extractCitedPages("no citations here")).toEqual([]);
  });

  it("returns unique page numbers", () => {
    const pages = extractCitedPages("See [[p.47]] and [[p.47]] again, then [[p.200]].");
    expect(pages).toContain(47);
    expect(pages).toContain(200);
    expect(pages.length).toBe(2);
  });
});

