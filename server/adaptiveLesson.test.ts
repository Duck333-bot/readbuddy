import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getActiveLesson: vi.fn(),
  abandonLesson: vi.fn(),
  getMaterialForUser: vi.fn(),
  getConceptsForMaterial: vi.fn(),
  getLearnerMastery: vi.fn(),
  getMaterialIntelligence: vi.fn(),
  createLesson: vi.fn(),
}));
const studyMocks = vi.hoisted(() => ({ ensureGroundedStudySet: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./studyGeneration", () => studyMocks);

const { ensureAdaptiveLesson } = await import("./adaptiveLesson");

const evidence = (unitIndex: number, excerpt: string) => [{ source: { unitType: "section" as const, unitIndex, section: unitIndex }, excerpt }];
const concepts = [
  { id: 11, canonicalName: "Demand", normalizedKey: "demand", definition: "How much of a product buyers are willing to purchase at different prices.", evidence: evidence(1, "Demand changes when buyers are willing and able to buy."), examples: evidence(1, "Demand shifts when buyer income changes."), importance: 9 },
  { id: 12, canonicalName: "Supply", normalizedKey: "supply", definition: "How much of a product sellers are willing to offer at different prices.", evidence: evidence(2, "Supply changes when sellers can produce more."), examples: evidence(2, "A lower production cost can increase supply."), importance: 8 },
  { id: 13, canonicalName: "Equilibrium", normalizedKey: "equilibrium", definition: "The point where quantity supplied and quantity demanded match.", evidence: evidence(3, "The market clears where supply and demand meet."), examples: evidence(3, "At equilibrium, there is no persistent shortage."), importance: 7 },
] as never;

const plannedMaterialIntelligence = {
  structuredSummary: { lessonPlan: {
    centralQuestion: "How do demand and supply shape market equilibrium?",
    narrative: "Compare what buyers want with what sellers can offer before locating the market-clearing point.",
    conceptNames: ["Demand", "Supply", "Equilibrium"],
    visual: { kind: "comparison", title: "Demand and supply", conceptNames: ["Demand", "Supply"], evidenceChunk: 1 },
    checks: [
      { conceptName: "Demand", kind: "distinction", prompt: "Which statement describes buyers rather than sellers?", choices: ["Buyers are willing to purchase at different prices.", "Sellers are willing to offer at different prices."], answer: "Buyers are willing to purchase at different prices.", explanation: "Demand describes buyer willingness to purchase.", evidenceChunk: 1 },
      { conceptName: "Equilibrium", kind: "application", prompt: "When does the market clear in this material?", choices: ["When supply and demand meet.", "When costs fall."], answer: "When supply and demand meet.", explanation: "The source defines equilibrium as the point where quantity supplied and demanded match.", evidenceChunk: 3 },
    ],
    estimatedMinutes: 7,
  } },
};

describe("adaptive material micro-lessons", () => {
  beforeEach(() => {
    Object.values(dbMocks).forEach(mock => mock.mockReset());
    studyMocks.ensureGroundedStudySet.mockReset();
  });

  it("returns an active version-nine lesson without rebuilding it", async () => {
    const existing = { lesson: { id: 81, lessonVersion: 9 }, steps: [{ id: 1 }] };
    dbMocks.getActiveLesson.mockResolvedValue(existing);

    await expect(ensureAdaptiveLesson(4, 9)).resolves.toBe(existing);
    expect(dbMocks.getMaterialForUser).not.toHaveBeenCalled();
    expect(dbMocks.abandonLesson).not.toHaveBeenCalled();
  });

  it("replaces a legacy lesson with a planned adaptive sequence and source-grounded checks", async () => {
    dbMocks.getActiveLesson
      .mockResolvedValueOnce({ lesson: { id: 80, lessonVersion: 2 }, steps: [] })
      .mockResolvedValueOnce({ lesson: { id: 99, lessonVersion: 9 }, steps: [] });
    dbMocks.getMaterialForUser.mockResolvedValue({ id: 9, title: "Market basics" });
    dbMocks.getConceptsForMaterial.mockResolvedValue(concepts);
    dbMocks.getLearnerMastery.mockResolvedValue([]);
    dbMocks.getMaterialIntelligence.mockResolvedValue(plannedMaterialIntelligence);
    dbMocks.createLesson.mockResolvedValue(99);
    studyMocks.ensureGroundedStudySet.mockResolvedValue({
      flashcards: [{ id: 41, conceptId: 11, evidence: evidence(1, "Demand changes when buyers are willing and able to buy.") }, { id: 42, conceptId: 12, evidence: evidence(2, "Supply changes when sellers can produce more.") }],
      questions: [],
    });

    const lesson = await ensureAdaptiveLesson(4, 9);
    expect(lesson.lesson.id).toBe(99);
    expect(dbMocks.abandonLesson).toHaveBeenCalledWith(80, 4);
    const [lessonRecord, steps] = dbMocks.createLesson.mock.calls[0];
    expect(lessonRecord).toMatchObject({ userId: 4, materialId: 9, lessonVersion: 9, title: "7-minute revision: Market basics" });
    expect(steps.map((step: { stepType: string }) => step.stepType)).toEqual(["intro", "visual", "worked", "mcq", "mcq", "note", "flashcard", "recap", "continuation"]);
    expect(steps[1].metadata.visual).toMatchObject({ kind: "comparison", items: [{ label: "Demand" }, { label: "Supply" }] });
    expect(steps[3].metadata.mcq).toMatchObject({ choices: ["Buyers are willing to purchase at different prices.", "Sellers are willing to offer at different prices."] });
    expect(steps[6].metadata.flashcardIds).toEqual([41, 42]);
    expect(steps[7].metadata.recapPoints).toHaveLength(3);
    expect(steps.every((step: { evidence: unknown[] }) => Array.isArray(step.evidence) && step.evidence.length > 0)).toBe(true);
  });

  it("omits visual and MCQ cards when a source has no validated reason to use them", async () => {
    dbMocks.getActiveLesson
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ lesson: { id: 101, lessonVersion: 9 }, steps: [] });
    dbMocks.getMaterialForUser.mockResolvedValue({ id: 9, title: "Market basics" });
    dbMocks.getConceptsForMaterial.mockResolvedValue(concepts);
    dbMocks.getLearnerMastery.mockResolvedValue([]);
    dbMocks.getMaterialIntelligence.mockResolvedValue({ structuredSummary: { lessonPlan: { ...plannedMaterialIntelligence.structuredSummary.lessonPlan, visual: undefined, checks: [], estimatedMinutes: 4 } } });
    dbMocks.createLesson.mockResolvedValue(101);
    studyMocks.ensureGroundedStudySet.mockResolvedValue({ flashcards: [], questions: [] });

    await ensureAdaptiveLesson(4, 9);
    const [, steps] = dbMocks.createLesson.mock.calls[0];
    expect(steps.map((step: { stepType: string }) => step.stepType)).toEqual(["intro", "worked", "note", "recap", "continuation"]);
    expect(steps[0].metadata.estimatedMinutes).toBe(4);
  });
});
