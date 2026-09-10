import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./bookBrain", () => ({
  BOOK_BRAIN_VERSION: 5,
  runBookBrainPipeline: vi.fn(),
}));

vi.mock("./telemetry", () => ({
  recordOperationTelemetry: vi.fn(),
}));

beforeEach(() => {
  authenticateRequest.mockReset();
});

describe("Book Brain scheduled callback", () => {
  it("does not expose internal errors to an unauthenticated caller", async () => {
    authenticateRequest.mockRejectedValueOnce(new Error("Invalid session cookie"));
    const { bookBrainHandler } = await import("./handlers/bookBrainHandler");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await bookBrainHandler({ url: "/api/scheduled/bookBrain" } as never, { status, json } as never);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "scheduled processing failed" });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain("Invalid session cookie");
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain("stack");
  });
});
