import { eq } from "drizzle-orm";
import { billingAccounts } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { billingConfigured, createCheckout, createPortal, publicPrice, syncCustomer } from "../stripe";
import { usageStatus } from "../usage";

function requestOrigin(req: { headers: { origin?: string | string[]; host?: string }; protocol?: string }) {
  const header = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  return header || `${req.protocol || "https"}://${req.headers.host || ""}`;
}

export const billingRouter = router({
  price: publicProcedure.query(async () => ({ enabled: billingConfigured(), price: await publicPrice() })),
  status: protectedProcedure.query(({ ctx }) => usageStatus(ctx.user.id)),
  checkout: protectedProcedure.mutation(({ ctx }) => createCheckout(ctx.user, requestOrigin(ctx.req))),
  portal: protectedProcedure.mutation(({ ctx }) => createPortal(ctx.user.id, requestOrigin(ctx.req))),
  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.userId, ctx.user.id));
    if (account?.customerId) await syncCustomer(account.customerId);
    return { ok: true } as const;
  }),
});
