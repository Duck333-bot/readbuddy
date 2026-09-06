import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secureRequests } from "./security";
import { trustedOrigin } from "./origin";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  userOwnsStorageKey: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ userOwnsStorageKey: mocks.userOwnsStorageKey }));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl }));
import { registerStorageProxy } from "./_core/storageProxy";

function response() {
  const res = { set: vi.fn(), status: vi.fn(), send: vi.fn(), json: vi.fn(), redirect: vi.fn() };
  Object.values(res).forEach(fn => fn.mockReturnValue(res));
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "https://app.example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("private file access", () => {
  async function download(key: string) {
    const handlers: Array<(req: unknown, res: unknown) => Promise<unknown>> = [];
    registerStorageProxy({ get: (_path: unknown, handler: (req: unknown, res: unknown) => Promise<unknown>) => handlers.push(handler) } as never);
    const res = response();
    await handlers[0]({ params: { 0: key } }, res);
    return res;
  }

  it("requires authentication before requesting a signed storage URL", async () => {
    mocks.authenticateRequest.mockRejectedValue(new Error("anonymous"));
    expect((await download("books/1/a.pdf")).status).toHaveBeenCalledWith(401);
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("does not reveal another reader's key or a deleted database record", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 2, openId: "google:user" });
    expect((await download("books/1/a.pdf")).status).toHaveBeenCalledWith(404);
    expect(mocks.userOwnsStorageKey).not.toHaveBeenCalled();
    mocks.authenticateRequest.mockResolvedValue({ id: 1, openId: "google:user" });
    mocks.userOwnsStorageKey.mockResolvedValue(false);
    expect((await download("books/1/a.pdf")).status).toHaveBeenCalledWith(404);
  });

  it("redirects only the authenticated database owner and prevents shared caching", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 1, openId: "google:user" });
    mocks.userOwnsStorageKey.mockResolvedValue(true);
    mocks.storageGetSignedUrl.mockResolvedValue("https://storage.example/private");
    const res = await download("books/1/a.pdf");
    expect(res.redirect).toHaveBeenCalledWith(307, "https://storage.example/private");
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ "Cache-Control": "private, no-store" }));
  });
});

describe("cookie-authenticated request origins", () => {
  it("accepts only the configured production origin", () => {
    expect(trustedOrigin("https://app.example.com")).toBe("https://app.example.com");
    for (const candidate of ["https://evil.example", "https://app.example.com.evil.example", "https://user@app.example.com", "https://app.example.com/path", "http://localhost:3000"]) {
      expect(() => trustedOrigin(candidate)).toThrow();
    }
  });

  it("blocks a cross-site mutation before its handler", () => {
    const req = { method: "POST", path: "/api/trpc/billing.checkout", get: (name: string) => name === "origin" ? "https://evil.example" : undefined };
    const res = response();
    const next = vi.fn();
    secureRequests(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
