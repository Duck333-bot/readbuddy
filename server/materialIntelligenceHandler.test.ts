import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./materialIntelligence", () => ({
  runMaterialIntelligencePipeline: vi.fn(),
}));

vi.mock("./telemetry", () => ({
  recordOperationTelemetry: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../drizzle/schema", () => ({
  materialIntelligence: {
    materialId: "materialId",
    pipelineStage: "pipelineStage",
    jobTaskUid: "jobTaskUid",
  },
}));

beforeEach(() => {
  authenticateRequest.mockReset();
});

describe("Material Intelligence scheduled callback", () => {
  it("returns a safe authentication failure for an invalid session", async () => {
    authenticateRequest.mockRejectedValueOnce(new Error("Invalid session cookie"));
    const { materialIntelligenceHandler } = await import("./handlers/materialIntelligenceHandler");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await materialIntelligenceHandler(
      { url: "/api/scheduled/materialIntelligence" } as never,
      { status, json } as never,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "authentication required" });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain("Invalid session cookie");
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain("stack");
  });
});

