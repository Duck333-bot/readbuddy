import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { BUDDY_MODES } from "../readingBuddy";
import { protectedProcedure, router } from "../_core/trpc";

export const notebookRouter = router({
  list: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.listNotebookEntries(ctx.user.id, input?.bookId);
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    return db.countNotebookEntries(ctx.user.id);
  }),

  save: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        pageNumber: z.number().int().positive(),
        mode: z.enum(BUDDY_MODES),
        highlight: z.string().trim().min(1).max(4000),
        question: z.string().trim().max(1000).nullable().optional(),
        answer: z.string().trim().min(1).max(20000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const book = await db.getBookForUser(input.bookId, ctx.user.id);
      if (!book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found in your library." });
      }
      const id = await db.createNotebookEntry({
        userId: ctx.user.id,
        bookId: input.bookId,
        pageNumber: input.pageNumber,
        mode: input.mode,
        highlight: input.highlight,
        question: input.question ?? null,
        answer: input.answer,
      });
      return { id };
    }),

  remove: protectedProcedure
    .input(z.object({ entryId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteNotebookEntry(input.entryId, ctx.user.id);
      return { success: true } as const;
    }),
});
