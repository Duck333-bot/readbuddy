import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listMaterialsForUser: vi.fn(),
  getMaterialForUser: vi.fn(),
  getLessonStepForUser: vi.fn(),
  completeLessonStep: vi.fn(),
  getConceptsForMaterial: vi.fn(),
  getActiveLesson: vi.fn(),
  completeLesson: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./storage", () => ({ storagePut: vi.fn() }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), deleteHeartbeatJob: vi.fn() }));
vi.mock("./materials/parser", () => ({
  parseMaterial: vi.fn(),
  MaterialParseError: class MaterialParseError extends Error {},
  MAX_MATERIAL_BYTES: 40 * 1024 * 1024,
  inferMimeType: vi.fn(),
}));
vi.mock("./studyGeneration", () => ({ ensureGroundedStudySet: vi.fn() }));
vi.mock("./learnerIntelligence", () => ({ recordMasterySignal: vi.fn() }));
vi.mock("./adaptiveLesson", () => ({ ensureAdaptiveLesson: vi.fn() }));

const { appRouter } = await import("./routers");

function contextFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      email: `learner${userId}@example.com`,
      name: `Learner ${userId}`,
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

const anonymousContext = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => undefined },
} as unknown as TrpcContext;

describe("materials router ownership", () => {
  beforeEach(() => {
    dbMocks.listMaterialsForUser.mockReset();
    dbMocks.getMaterialForUser.mockReset();
    dbMocks.getLessonStepForUser.mockReset();
    dbMocks.completeLessonStep.mockReset();
    dbMocks.getConceptsForMaterial.mockReset();
    dbMocks.getActiveLesson.mockReset();
    dbMocks.completeLesson.mockReset();
  });

  it("rejects an anonymous material list request", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.materials.list()).rejects.toThrow();
  });

  it("lists only the caller’s own materials", async () => {
    dbMocks.listMaterialsForUser.mockResolvedValue([{ id: 22, userId: 1, title: "Own notes" }]);
    const caller = appRouter.createCaller(contextFor(1));
    await expect(caller.materials.list()).resolves.toEqual([{ id: 22, userId: 1, title: "Own notes" }]);
    expect(dbMocks.listMaterialsForUser).toHaveBeenCalledWith(1);
  });

  it("does not reveal a material owned by another user", async () => {
    dbMocks.getMaterialForUser.mockResolvedValue(null);
    const caller = appRouter.createCaller(contextFor(2));
    await expect(caller.materials.get({ materialId: 22 })).rejects.toThrow(/not found/i);
    expect(dbMocks.getMaterialForUser).toHaveBeenCalledWith(22, 2);
  });

  it("grades a persisted lesson MCQ server-side and returns its source-backed feedback", async () => {
    const lesson = { id: 41, materialId: 22, userId: 1 };
    const step = { id: 99, stepType: "mcq", expectedAnswer: "Correct definition", conceptId: 7, metadata: { mcq: { explanation: "Source-backed explanation" } } };
    dbMocks.getLessonStepForUser.mockResolvedValue({ lesson, step });
    dbMocks.completeLessonStep.mockResolvedValue({ lesson, step });
    dbMocks.getConceptsForMaterial.mockResolvedValue([{ id: 7, normalizedKey: "concept-seven" }]);
    dbMocks.getActiveLesson.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextFor(1));

    await expect(caller.materials.answerLessonMcq({ stepId: 99, selectedAnswer: "Correct definition" })).resolves.toEqual({
      isCorrect: true,
      explanation: "Source-backed explanation",
      correctAnswer: null,
    });
    expect(dbMocks.completeLessonStep).toHaveBeenCalledWith(99, 1, { learnerAnswer: "Correct definition", isCorrect: 1 });
  });
});
