import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * `auth.devLogin` mints a session for the project owner so `scripts/ui-check.mjs`
 * can drive the signed-in app without the interactive OAuth portal. It must be
 * unreachable anywhere except local development.
 */
function createContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

describe("auth.devLogin", () => {
  it("is not found in production", async () => {
    process.env.NODE_ENV = "production";
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.devLogin()).rejects.toThrow(/NOT_FOUND|not found/i);
  });

  it("is not found in test/staging environments", async () => {
    process.env.NODE_ENV = "staging";
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.devLogin()).rejects.toThrow(/NOT_FOUND|not found/i);
  });
});
