import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listMaterialsForUser: vi.fn(),
  getMaterialForUser: vi.fn(),
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
});
