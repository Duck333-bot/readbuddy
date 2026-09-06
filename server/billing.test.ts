import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { billingConfigured, constructStripeEvent, subscriptionSnapshot } from "./stripe";

afterEach(() => vi.unstubAllEnvs());

function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_current",
    object: "subscription",
    status: "active",
    created: 200,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_pro" }, quantity: 1, current_period_end: Math.floor(Date.now() / 1000) + 3600 }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("Stripe launch security", () => {
  it("verifies the exact raw payload and rejects a tampered body", () => {
    const secret = "whsec_test_launch";
    const payload = JSON.stringify({ id: "evt_123", object: "event", type: "customer.subscription.updated" });
    const stripe = new Stripe("sk_test_signature_generation_only");
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(constructStripeEvent(Buffer.from(payload), header, secret).id).toBe("evt_123");
    expect(() => constructStripeEvent(Buffer.from(`${payload} `), header, secret)).toThrow();
  });

  it("selects the current matching subscription and rejects wrong price or quantity", () => {
    const current = subscription();
    const older = subscription({ id: "sub_old", created: 100, status: "canceled" });
    expect(subscriptionSnapshot([older, current], "price_pro")).toMatchObject({ subscriptionId: "sub_current", status: "active", priceId: "price_pro" });
    expect(subscriptionSnapshot([current], "price_other").subscriptionId).toBeNull();
    expect(subscriptionSnapshot([subscription({ items: { data: [{ price: { id: "price_pro" }, quantity: 2 }] } as Stripe.ApiList<Stripe.SubscriptionItem> })], "price_pro").subscriptionId).toBeNull();
  });

  it("requires all server-side billing values before enabling checkout", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_example");
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "");
    expect(billingConfigured()).toBe(false);
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro");
    expect(billingConfigured()).toBe(true);
  });
});
