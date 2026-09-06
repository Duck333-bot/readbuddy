import { describe, expect, it, vi } from "vitest";
import { readinessResult } from "./health";

describe("launch readiness", () => {
  it("reports ready only after the database dependency responds", async () => {
    const execute = vi.fn().mockResolvedValue([{ "1": 1 }]);
    await expect(readinessResult({
      nodeEnv: "production",
      getConfigurationIssues: () => [],
      getDatabase: async () => ({ execute } as never),
    })).resolves.toEqual({ statusCode: 200, body: { status: "ready" } });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("fails closed when production configuration is incomplete", async () => {
    await expect(readinessResult({
      nodeEnv: "production",
      getConfigurationIssues: () => ["missing secret"],
      getDatabase: async () => { throw new Error("must not query"); },
    })).resolves.toEqual({ statusCode: 503, body: { status: "unavailable", reason: "configuration" } });
  });

  it("fails closed when the database is unavailable", async () => {
    await expect(readinessResult({
      nodeEnv: "production",
      getConfigurationIssues: () => [],
      getDatabase: async () => undefined,
    })).resolves.toEqual({ statusCode: 503, body: { status: "unavailable", reason: "database" } });
  });
});

