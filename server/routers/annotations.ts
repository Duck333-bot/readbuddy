import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

async function assertBookAccess(bookId: number, userId: number) {
  const book = await db.getBookForUser(bookId, userId);
  if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found in your library." });
  return book;
}

export const annotationsRouter = router({
  listForPage: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive(), pageNumber: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertBookAccess(input.bookId, ctx.user.id);
      return db.listAnnotationsForPage(ctx.user.id, input.bookId, input.pageNumber);
    }),

  listForUser: protectedProcedure.query(async ({ ctx }) => {
    return db.listAnnotationsForUser(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({
      bookId: z.number().int().positive(),
      pageNumber: z.number().int().positive(),
      selectedText: z.string().trim().min(1).max(5000),
      startOffset: z.number().int().nonnegative().optional(),
      endOffset: z.number().int().positive().optional(),
      color: z.enum(["yellow", "blue", "pink", "green"]).default("yellow"),
      note: z.string().trim().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertBookAccess(input.bookId, ctx.user.id);
      if (
        (input.startOffset === undefined) !== (input.endOffset === undefined) ||
        (input.startOffset !== undefined && input.endOffset !== undefined && input.endOffset <= input.startOffset)
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That highlight range is invalid. Please select the text again." });
      }
      const id = await db.createAnnotation({ ...input, userId: ctx.user.id, note: input.note ?? null });
      return { id };
    }),

  remove: protectedProcedure
    .input(z.object({ annotationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteAnnotationForUser(input.annotationId, ctx.user.id);
      return { success: true } as const;
    }),

  listBookmarks: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertBookAccess(input.bookId, ctx.user.id);
      return db.listBookmarksForBook(ctx.user.id, input.bookId);
    }),

  bookmark: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive(), pageNumber: z.number().int().positive(), label: z.string().trim().max(180).optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBookAccess(input.bookId, ctx.user.id);
      await db.createBookmark(ctx.user.id, input.bookId, input.pageNumber, input.label ?? null);
      return { success: true } as const;
    }),

  removeBookmark: protectedProcedure
    .input(z.object({ bookmarkId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteBookmarkForUser(input.bookmarkId, ctx.user.id);
      return { success: true } as const;
    }),
});
