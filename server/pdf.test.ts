import { describe, expect, it } from "vitest";
import { findFirstReadablePage, isMeaningfulReadingPage, titleFromFilename } from "./pdf";

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

describe("first readable page", () => {
  it("skips a dense Dune-style catalogue and opens on the first page of prose", () => {
    const catalogue = [
      "Books by Frank Herbert",
      "THE BOOK OF FRANK HERBERT",
      "DIRECT DESCENT",
      "THE DOSADI EXPERIMENT",
      "EYE",
      "THE EYES OF HEISENBERG",
      "THE GODMAKERS",
      "THE GREEN BRAIN",
    ].join("\n").repeat(8);
    const story = "In the beginning, the reader is given a real scene with people, conflict, and enough surrounding prose to begin reading naturally. The next sentences keep the scene moving and make it clear this is the start of meaningful book text rather than a list of titles.";
    expect(isMeaningfulReadingPage(catalogue)).toBe(false);
    expect(findFirstReadablePage(["", catalogue, story])).toBe(3);
  });
});
