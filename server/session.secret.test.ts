import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("ZhiyaAI session secret", () => {
  it("creates and verifies a signed session with the injected production override", async () => {
    expect(process.env.ZHIYA_SESSION_SECRET).toBeTruthy();
    expect(ENV.cookieSecret).toBe(process.env.ZHIYA_SESSION_SECRET);
    expect(ENV.cookieSecret.length).toBeGreaterThanOrEqual(32);
    const token = await sdk.createSessionToken("launch-secret-check", { name: "Launch Check", expiresInMs: 60_000 });
    await expect(sdk.verifySession(token)).resolves.toEqual(expect.objectContaining({ openId: "launch-secret-check", name: "Launch Check" }));
  });
});
