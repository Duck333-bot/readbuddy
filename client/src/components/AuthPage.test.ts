import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const authPage = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/AuthPage.tsx"), "utf8");

describe("ZhiyaAI authentication page", () => {
  it("keeps the live Google sign-in action in both login and account-creation views", () => {
    expect(authPage).toContain("/api/auth/google/start");
    expect(authPage).toContain("Continue with Google");
    expect(authPage).toContain('create ? "Create your account" : "Log in"');
  });

  it("does not imply unavailable authentication methods or recovery flows", () => {
    expect(authPage).not.toContain("Continue with Apple");
    expect(authPage).not.toContain('type="password"');
    expect(authPage).not.toContain("Forgot password");
    expect(authPage).toContain("ZhiyaAI does not use a password");
  });
});
