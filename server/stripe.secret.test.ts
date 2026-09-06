import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { configuredPriceId } from "./usage";

describe.runIf(process.env.RUN_LIVE_TESTS === "true")("Stripe launch credentials", () => {
  it("can retrieve the configured active monthly ZhiyaAI Pro price", async () => {
    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId = configuredPriceId();
    expect(secret).toBeTruthy();
    expect(priceId).toMatch(/^price_/);
    const stripe = new Stripe(secret!, { maxNetworkRetries: 1, timeout: 10_000 });
    const price = await stripe.prices.retrieve(priceId);
    expect(price.active).toBe(true);
    expect(price.type).toBe("recurring");
    expect(price.recurring?.interval).toBe("month");
    expect(price.currency).toBe("usd");
  }, 15_000);
});
