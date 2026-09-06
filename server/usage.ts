import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { billingAccounts, monthlyUsage } from "../drizzle/schema";
import { PLANS, USAGE_LIMIT_MESSAGE, type UsageKind } from "../shared/plans";
import { getDb } from "./db";

export function usagePeriod(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function configuredPriceId(env: NodeJS.ProcessEnv = process.env) {
  return env.STRIPE_PRO_PRICE_ID || env.STRIPE_PRICE_ID || "";
}

export function entitledPlan(
  account: { status: string; priceId: string | null; paidUntil: Date | null } | undefined,
  now = new Date(),
) {
  const priceId = configuredPriceId();
  return account && ["active", "trialing"].includes(account.status) && Boolean(priceId)
    && account.priceId === priceId && Boolean(account.paidUntil && account.paidUntil > now)
    ? "pro" as const
    : "free" as const;
}

export async function usageStatus(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Your account is temporarily unavailable." });
  const period = usagePeriod();
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.userId, userId));
  const [usage] = await db.select().from(monthlyUsage).where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.period, period)));
  const plan = entitledPlan(account);
  return {
    plan,
    limits: PLANS[plan],
    used: {
      uploads: usage?.uploads ?? 0,
      aiCalls: usage?.aiCalls ?? 0,
      sourceCharacters: usage?.sourceCharacters ?? 0,
    },
    period,
    canManageBilling: Boolean(account?.customerId),
    subscriptionStatus: account?.status ?? "none",
    cancelAtPeriodEnd: Boolean(account?.cancelAtPeriodEnd),
    paidUntil: account?.paidUntil ?? null,
  };
}

export async function reserveUsage(userId: number, kind: UsageKind, sourceCharacters = 0) {
  const runningVitest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  if (runningVitest && process.env.TEST_USAGE_DB !== "true") return async () => undefined;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Your allowance could not be checked. Please try again." });
  const period = usagePeriod();
  await db.transaction(async tx => {
    await tx.insert(monthlyUsage).values({ userId, period }).onDuplicateKeyUpdate({ set: { userId } });
    const [row] = await tx.select().from(monthlyUsage)
      .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.period, period)))
      .for("update");
    const [account] = await tx.select().from(billingAccounts).where(eq(billingAccounts.userId, userId));
    const limits = PLANS[entitledPlan(account)];
    if (!row || row[kind] >= limits[kind] || row.sourceCharacters + sourceCharacters > limits.sourceCharacters) {
      throw new TRPCError({ code: "FORBIDDEN", message: USAGE_LIMIT_MESSAGE });
    }
    await tx.update(monthlyUsage).set({
      [kind]: row[kind] + 1,
      sourceCharacters: row.sourceCharacters + sourceCharacters,
    }).where(eq(monthlyUsage.id, row.id));
  });

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await db.update(monthlyUsage).set({
      [kind]: sql`GREATEST(0, ${monthlyUsage[kind]} - 1)`,
      sourceCharacters: sql`GREATEST(0, ${monthlyUsage.sourceCharacters} - ${sourceCharacters})`,
    }).where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.period, period)));
  };
}

export async function withUsage<T>(
  userId: number,
  kind: UsageKind,
  work: () => Promise<T>,
  sourceCharacters = 0,
): Promise<T> {
  const release = await reserveUsage(userId, kind, sourceCharacters);
  try {
    return await work();
  } catch (error) {
    await release().catch(() => undefined);
    throw error;
  }
}
