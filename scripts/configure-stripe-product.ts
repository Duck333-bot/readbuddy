import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY is not configured.");
  process.exit(1);
}

const stripe = new Stripe(secret, { maxNetworkRetries: 2, timeout: 15_000 });
const lookupKey = "zhiya_pro_monthly";
const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });

if (existing.data[0]) {
  console.log(existing.data[0].id);
  process.exit(0);
}

const product = await stripe.products.create({
  name: "ZhiyaAI Pro",
  description: "Higher monthly allowances for private uploads, AI reading explanations, and background Book Brain processing.",
  metadata: { product: "zhiyaai", plan: "pro" },
});

const price = await stripe.prices.create({
  product: product.id,
  currency: "usd",
  unit_amount: 999,
  recurring: { interval: "month" },
  lookup_key: lookupKey,
  metadata: { product: "zhiyaai", plan: "pro" },
});

console.log(price.id);
