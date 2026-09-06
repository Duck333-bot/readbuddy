import express, { type Express } from "express";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { billingAccounts, type User } from "../drizzle/schema";
import { getDb } from "./db";
import { trustedOrigin } from "./origin";
import { configuredPriceId } from "./usage";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Subscriptions are not configured yet." });
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000 });
}

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && configuredPriceId());
}

export function constructStripeEvent(payload: Buffer, signature: string, secret: string) {
  return new Stripe("sk_test_signature_verification_only").webhooks.constructEvent(payload, signature, secret);
}

function paidUntil(subscription: Stripe.Subscription) {
  const itemEnds = subscription.items.data
    .map(item => (item as Stripe.SubscriptionItem & { current_period_end?: number }).current_period_end ?? 0)
    .filter(Boolean);
  const legacyEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end ?? 0;
  const seconds = Math.max(legacyEnd, ...itemEnds, 0);
  return seconds > 0 ? new Date(seconds * 1000) : null;
}

export function subscriptionSnapshot(subscriptions: Stripe.Subscription[], priceId: string, now = Date.now()) {
  const matching = subscriptions.filter(subscription => {
    const items = subscription.items.data.filter(item => item.price.id === priceId);
    return items.length === 1 && (items[0].quantity ?? 1) === 1;
  });
  const entitled = matching.filter(subscription => ["active", "trialing"].includes(subscription.status) && (paidUntil(subscription)?.getTime() ?? 0) > now);
  const selected = (entitled.length ? entitled : matching).sort((a, b) => b.created - a.created)[0];
  return {
    subscriptionId: selected?.id ?? null,
    status: selected?.status ?? "none",
    priceId: selected ? priceId : null,
    paidUntil: selected ? paidUntil(selected) : null,
    cancelAtPeriodEnd: selected?.cancel_at_period_end ? 1 : 0,
  };
}

async function subscriptionsFor(customerId: string) {
  const result = await stripeClient().subscriptions.list({ customer: customerId, price: configuredPriceId(), status: "all", limit: 100 });
  if (result.has_more) throw new Error("Subscription reconciliation requires pagination");
  return result.data;
}

export async function syncCustomer(customerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.customerId, customerId));
  if (!account) return;
  const snapshot = subscriptionSnapshot(await subscriptionsFor(customerId), configuredPriceId());
  await db.update(billingAccounts).set(snapshot).where(eq(billingAccounts.userId, account.userId));
}

export async function publicPrice() {
  if (!billingConfigured()) return null;
  const price = await stripeClient().prices.retrieve(configuredPriceId());
  if (!price.active || price.type !== "recurring" || price.recurring?.interval !== "month" || price.currency !== "usd" || !price.unit_amount) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The monthly Pro plan is not configured correctly." });
  }
  return { amount: price.unit_amount, currency: price.currency, interval: "month" as const };
}

export async function createCheckout(user: User, origin: string) {
  const priceId = configuredPriceId();
  if (!billingConfigured() || !priceId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Subscriptions are not available yet." });
  await publicPrice();
  const safeOrigin = trustedOrigin(origin);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(billingAccounts).values({ userId: user.id }).onDuplicateKeyUpdate({ set: { userId: user.id } });
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.userId, user.id));
  let customerId = account?.customerId;
  const stripe = stripeClient();
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { zhiya_user_id: String(user.id) },
    }, { idempotencyKey: `zhiya-customer-${user.id}` });
    customerId = customer.id;
    await db.update(billingAccounts).set({ customerId }).where(eq(billingAccounts.userId, user.id));
  }
  const subscriptions = await subscriptionsFor(customerId);
  if (subscriptions.some(subscription => ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(subscription.status))) {
    throw new TRPCError({ code: "CONFLICT", message: "You already have a subscription. Use Manage billing to update it." });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: String(user.id),
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: {
      user_id: String(user.id),
      customer_email: user.email ?? "",
      customer_name: user.name ?? "",
    },
    subscription_data: { metadata: { user_id: String(user.id) } },
    success_url: `${safeOrigin}/plans?checkout=success`,
    cancel_url: `${safeOrigin}/plans?checkout=cancelled`,
  }, { idempotencyKey: `zhiya-checkout-${user.id}-${Math.floor(Date.now() / 1_800_000)}` });
  if (!session.url) throw new TRPCError({ code: "BAD_GATEWAY", message: "Stripe did not return a checkout link." });
  return { url: session.url };
}

export async function createPortal(userId: number, origin: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.userId, userId));
  if (!account?.customerId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "There is no billing account to manage yet." });
  const session = await stripeClient().billingPortal.sessions.create({ customer: account.customerId, return_url: `${trustedOrigin(origin)}/plans` });
  return { url: session.url };
}

async function linkCheckoutSession(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
  if (!customerId || !Number.isSafeInteger(userId) || userId <= 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(billingAccounts).values({ userId, customerId }).onDuplicateKeyUpdate({ set: { customerId } });
  await syncCustomer(customerId);
}

export function registerBillingWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Billing is not configured" });
    let event: Stripe.Event;
    try {
      event = constructStripeEvent(req.body, req.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ error: "Invalid signature" });
    }
    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }
    try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        await linkCheckoutSession(event.data.object as Stripe.Checkout.Session);
      } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"].includes(event.type)) {
        const object = event.data.object as { customer?: string | { id?: string } | null };
        const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
        if (customerId) await syncCustomer(customerId);
      }
      console.info("[Stripe webhook]", event.type, event.id, new Date(event.created * 1000).toISOString());
      return res.json({ received: true });
    } catch {
      return res.status(503).json({ error: "Please retry this event" });
    }
  });
}
