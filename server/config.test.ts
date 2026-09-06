import { describe, expect, it } from "vitest";
import { configurationIssues, emailAuthenticationEnabled } from "./config";

const valid = {
  DATABASE_URL: "mysql://example",
  JWT_SECRET: "a".repeat(32),
  ZHIYA_SESSION_SECRET: "b".repeat(32),
  BUILT_IN_FORGE_API_URL: "https://api.example.com",
  BUILT_IN_FORGE_API_KEY: "key",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRO_PRICE_ID: "price_example",
  APP_ORIGIN: "https://zhiya.example",
} as NodeJS.ProcessEnv;

describe("launch configuration", () => {
  it("accepts a complete production configuration", () => {
    expect(configurationIssues(valid)).toEqual([]);
  });

  it("reports exact missing and unsafe values", () => {
    expect(configurationIssues({ ...valid, ZHIYA_SESSION_SECRET: "short", APP_ORIGIN: "http://zhiya.example" })).toEqual(
      expect.arrayContaining(["ZHIYA_SESSION_SECRET (minimum 32 characters)", "APP_ORIGIN (must use HTTPS)"]),
    );
  });

  it("enables email authentication only after an explicit verified-sender gate", () => {
    expect(emailAuthenticationEnabled({ EMAIL_AUTH_ENABLED: "true", RESEND_API_KEY: "re_key", EMAIL_FROM: "ZhiyaAI <login@example.com>" })).toBe(true);
    expect(emailAuthenticationEnabled({ RESEND_API_KEY: "re_key", EMAIL_FROM: "login@example.com" })).toBe(false);
    expect(emailAuthenticationEnabled({ EMAIL_AUTH_ENABLED: "true", RESEND_API_KEY: "re_key", EMAIL_FROM: "login@resend.dev" })).toBe(false);
  });
});
