import { describe, expect, it } from "vitest";
import { titleFromFilename } from "./pdf";

describe("titleFromFilename", () => {
  it("strips the extension and normalises separators", () => {
    expect(titleFromFilename("the_wealth_of_nations.pdf")).toBe("The Wealth of Nations");
  });

  it("preserves existing capitalisation", () => {
    expect(titleFromFilename("Sapiens A Brief History.PDF")).toBe(
      "Sapiens A Brief History",
    );
  });

  it("falls back when the name has no usable characters", () => {
    expect(titleFromFilename(".pdf")).toBe("Untitled book");
    expect(titleFromFilename("---.pdf")).toBe("Untitled book");
  });

  it("caps very long names", () => {
    const long = `${"a".repeat(900)}.pdf`;
    expect(titleFromFilename(long).length).toBeLessThanOrEqual(500);
  });
});
