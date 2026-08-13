import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { readerRouter } from "./routers/reader";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sendMagicLink } from "./authRoutes";
import { z } from "zod";

/**
 * Mints the same session cookie the OAuth callback issues, but for a known
 * openId. Development only — see `auth.devLogin`.
 */
async function issueDevSession(res: Response, req: Request, openId: string) {
  await db.upsertUser({
    openId,
    name: process.env.OWNER_NAME || "Owner",
    lastSignedIn: new Date(),
  });
  const sessionToken = await sdk.createSessionToken(openId, {
    name: process.env.OWNER_NAME || "Owner",
    expiresInMs: ONE_YEAR_MS,
  });
  res.cookie(COOKIE_NAME, sessionToken, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}
import { booksRouter } from "./routers/books";
import { buddyRouter } from "./routers/buddy";
import { notebookRouter } from "./routers/notebook";
import { analyticsRouter } from "./routers/analytics";
import { annotationsRouter } from "./routers/annotations";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  reader: readerRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    /**
     * Development-only helper: mints a session for the project owner so the
     * scripted UI check (`scripts/ui-check.mjs`) can drive the authenticated
     * app without going through the interactive OAuth portal. Disabled outside
     * development, so it cannot be reached in production.
     */
    devLogin: publicProcedure.mutation(async ({ ctx }) => {
      if (process.env.NODE_ENV !== "development") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const ownerOpenId = process.env.OWNER_OPEN_ID;
      if (!ownerOpenId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OWNER_OPEN_ID is not configured",
        });
      }
      await issueDevSession(ctx.res, ctx.req, ownerOpenId);
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    requestEmailLink: publicProcedure.input(z.object({ email: z.string().email(), origin: z.string().url() })).mutation(async ({ input }) => {
      await sendMagicLink(input.email.toLowerCase(), input.origin);
      return { success: true } as const;
    }),
  }),

  books: booksRouter,
  buddy: buddyRouter,
  notebook: notebookRouter,
  analytics: analyticsRouter,
  annotations: annotationsRouter,
});

export type AppRouter = typeof appRouter;
