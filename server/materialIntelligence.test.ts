import { describe, expect, it } from "vitest";
import { buildMaterialChunks, cleanLearningText, evidenceForRelevantUnit, parseMaterialAnalysis, selectEvidenceExcerpt } from "./materialIntelligence";

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
  it("accepts description aliases and provider evidence labels", () => {
    const analysis = parseMaterialAnalysis({
      overview: "A short source-grounded overview.",
      learningObjectives: ["Explain the role of a cell membrane."],
      keyIdeas: ["Membranes regulate what enters a cell."],
      concepts: [{ name: "Cell membrane", description: "A boundary that regulates passage.", evidenceChunk: "source chunk 1" }],
    });

    expect(analysis.concepts[0]).toMatchObject({ definition: "A boundary that regulates passage.", evidenceChunk: 1 });
  });

  it("uses the first supplied source chunk when a provider omits a numeric position", () => {
    const analysis = parseMaterialAnalysis({
      overview: "A short source-grounded overview.",
      learningObjectives: ["Explain the role of a cell membrane."],
      keyIdeas: ["Membranes regulate what enters a cell."],
      concepts: [{ name: "Membrane transport", description: "Movement across a membrane.", evidenceChunk: "the supplied source" }],
    });

    expect(analysis.concepts[0].evidenceChunk).toBe(1);
  });

  it("strips research-paper boilerplate and retains the first meaningful abstract claim", () => {
    const cleaned = cleanLearningText(`Provided proper attribution is provided, Google hereby grants permission to reproduce tables.\nAttention Is All You Need\nAuthor One author@example.com\nAbstract\nThe Transformer uses attention mechanisms instead of recurrence and can train in parallel.`);

    expect(cleaned).not.toMatch(/attribution|author@example|Attention Is All You Need/i);
    expect(cleaned).toContain("Transformer uses attention mechanisms");
  });

  it("drops a low-information presentation agenda when substantive slides are available", () => {
    const chunks = buildMaterialChunks([
      { id: 1, materialId: 77, unitIndex: 1, unitType: "slide", title: "Agenda", content: "What will we cover today? 1. Agenda 2. Market 3. Financials", headings: ["Agenda"], sourceRef: { unitType: "slide", unitIndex: 1, slide: 1 }, createdAt: new Date() },
      { id: 2, materialId: 77, unitIndex: 2, unitType: "slide", title: "Series A evidence", content: "At Series A, investors look for consistent revenue growth, a growing user base, and evidence of product-market fit.", headings: ["Series A evidence"], sourceRef: { unitType: "slide", unitIndex: 2, slide: 2 }, createdAt: new Date() },
    ] as never);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).not.toContain("What will we cover today");
    expect(chunks[0].text).toContain("product-market fit");
  });

  it("removes inline presentation title, agenda, and confidentiality boilerplate before teaching analysis", () => {
    const cleaned = cleanLearningText("Navy Private Capital Investor Presentations June 26th, 2024 What Will We Cover Today? 1. Market 2. Metrics 3. Risks ©2024 Proprietary and Confidential. All Rights Reserved. Investor decks are critical to providing a concise understanding of your business idea.");

    expect(cleaned).not.toMatch(/Navy Private Capital|What Will We Cover|Proprietary|All Rights Reserved/i);
    expect(cleaned).toContain("Investor decks are critical");
  });

  it("keeps learning-objective terms out of evidence selection when explanatory prose is available", () => {
    const excerpt = selectEvidenceExcerpt("* Compare and contrast passive transport with active transport.\nPassive transport moves substances down a concentration gradient without cellular energy.", "Passive Transport");

    expect(excerpt).not.toMatch(/Compare and contrast/i);
    expect(excerpt).toContain("moves substances down a concentration gradient");
  });

  it("selects evidence around a named concept instead of an arbitrary chunk opening", () => {
    const excerpt = selectEvidenceExcerpt("Title and author metadata. The model uses self-attention to connect every position in a sequence. Positional encodings provide order information.", "Positional Encoding");
    expect(excerpt).toContain("Positional encodings provide order information");
  });

  it("localizes a concept to its supporting source unit instead of the first unit in a broad chunk", () => {
    const first = { content: "A cell membrane separates the cell from its exterior environment.", sourceRef: { unitType: "section" as const, unitIndex: 1, section: 1 } };
    const second = { content: "Exocytosis occurs when a vesicle fuses with the cell membrane to release contents outside the cell.", sourceRef: { unitType: "section" as const, unitIndex: 2, section: 2 } };
    const evidence = evidenceForRelevantUnit([first, second], { sourceRefs: [first.sourceRef, second.sourceRef], text: `${first.content}\n\n${second.content}` }, "Exocytosis", "A vesicle fuses with the membrane to release contents outside.");

    expect(evidence[0]?.source.unitIndex).toBe(2);
    expect(evidence[0]?.excerpt).toContain("Exocytosis occurs");
  });

  it("ignores an incomplete optional lesson plan instead of rejecting valid source analysis", () => {
    const analysis = parseMaterialAnalysis({
      overview: "A short source-grounded overview.",
      learningObjectives: ["Explain the role of a cell membrane."],
      keyIdeas: ["Membranes regulate what enters a cell."],
      concepts: [{ name: "Cell membrane", description: "A boundary that regulates passage.", evidenceChunk: 1 }],
      lessonPlan: { centralQuestion: "Incomplete" },
    });

    expect(analysis.lessonPlan).toBeUndefined();
  });
});
