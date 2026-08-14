import { describe, expect, it } from "vitest";
import { buildMaterialChunks, parseMaterialAnalysis } from "./materialIntelligence";

describe("Material Intelligence chunk construction", () => {
  it("preserves ordered source references while forming reusable chunks", () => {
    const chunks = buildMaterialChunks([
      {
        id: 1,
        materialId: 42,
        unitIndex: 1,
        unitType: "section",
        title: "Elasticity",
        content: "Price elasticity measures how quantity demanded responds to price.",
        headings: ["Elasticity"],
        sourceRef: { unitType: "section", unitIndex: 1, section: 1, headingPath: ["Elasticity"] },
        createdAt: new Date(),
      },
      {
        id: 2,
        materialId: 42,
        unitIndex: 2,
        unitType: "section",
        title: "Example",
        content: "A substitute can make demand more elastic.",
        headings: ["Example"],
        sourceRef: { unitType: "section", unitIndex: 2, section: 2, headingPath: ["Example"] },
        createdAt: new Date(),
      },
    ] as never);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ materialId: 42, startUnitIndex: 1, endUnitIndex: 2 });
    expect(chunks[0].sourceRefs).toHaveLength(2);
    expect(chunks[0].text).toContain("Price elasticity");
  });
});

describe("Material Intelligence provider compatibility", () => {
  it("accepts description aliases and numeric-string evidence chunk references", () => {
    const analysis = parseMaterialAnalysis({
      overview: "A short source-grounded overview.",
      learningObjectives: ["Explain the role of a cell membrane."],
      keyIdeas: ["Membranes regulate what enters a cell."],
      concepts: [{ name: "Cell membrane", description: "A boundary that regulates passage.", evidenceChunk: "1" }],
    });

    expect(analysis.concepts[0]).toMatchObject({ description: "A boundary that regulates passage.", evidenceChunk: 1 });
  });
});
