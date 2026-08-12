import { describe, expect, it } from "vitest";
import { collectHeadingCandidates, rejectRunningHeaders, resolveBookStructure } from "./bookStructure";

describe("honest book structure", () => {
  it("prefers a real outline with the author's titles", async () => {
    const pages = [{ pageNumber: 1, content: "Opening text" }, { pageNumber: 8, content: "More text" }, { pageNumber: 15, content: "Closing text" }];
    const structure = await resolveBookStructure(pages, {
      outline: [{ title: "Beginning", page: 1, level: 0 }, { title: "Middle", page: 8, level: 0 }, { title: "End", page: 15, level: 0 }],
    });
    expect(structure.source).toBe("outline");
    expect(structure.sections.map(section => section.title)).toEqual(["Beginning", "Middle", "End"]);
    expect(structure.sections.every(section => section.authorDefined)).toBe(true);
  });

  it("rejects repeated running headers rather than turning them into chapters", () => {
    const pages = [1, 2, 3, 4].map(pageNumber => ({ pageNumber, content: `THE BOOK TITLE\nA short body paragraph.` }));
    const candidates = collectHeadingCandidates(pages);
    expect(rejectRunningHeaders(candidates, { bookTitle: "The Book Title" })).toEqual([]);
  });

  it("falls back to explicitly synthetic sections when evidence is weak", async () => {
    const pages = [{ pageNumber: 1, content: "A normal sentence." }, { pageNumber: 2, content: "Another normal sentence." }];
    const structure = await resolveBookStructure(pages);
    expect(structure.source).toBe("synthetic");
    expect(structure.sections.every(section => !section.authorDefined)).toBe(true);
  });
});
