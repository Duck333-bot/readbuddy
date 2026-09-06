import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredPriceId, entitledPlan, usagePeriod } from "./usage";

afterEach(() => vi.unstubAllEnvs());

describe("plan entitlements", () => {
  it("uses UTC calendar months consistently", () => {
    expect(usagePeriod(new Date("2026-09-30T23:59:59Z"))).toBe("2026-09");
    expect(usagePeriod(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10");
  });

  it("grants Pro only for the configured active subscription within its paid period", () => {
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro");
    const paidUntil = new Date("2026-10-01T00:00:00Z");
    expect(entitledPlan({ status: "active", priceId: "price_pro", paidUntil }, new Date("2026-09-01T00:00:00Z"))).toBe("pro");
    expect(entitledPlan({ status: "past_due", priceId: "price_pro", paidUntil }, new Date("2026-09-01T00:00:00Z"))).toBe("free");
    expect(entitledPlan({ status: "active", priceId: "price_other", paidUntil }, new Date("2026-09-01T00:00:00Z"))).toBe("free");
    expect(entitledPlan({ status: "active", priceId: "price_pro", paidUntil }, new Date("2026-11-01T00:00:00Z"))).toBe("free");
  });

  it("accepts the compatibility Stripe price environment name", () => {
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "");
    vi.stubEnv("STRIPE_PRICE_ID", "price_compat");
    expect(configuredPriceId()).toBe("price_compat");
  });
});
