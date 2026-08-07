import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { askReadingBuddy, BUDDY_MODES } from "../readingBuddy";
import { protectedProcedure, router } from "../_core/trpc";

const modeSchema = z.enum(BUDDY_MODES);

export const buddyRouter = router({
  ask: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        pageNumber: z.number().int().positive(),
        highlight: z.string().trim().min(1).max(4000),
        mode: modeSchema,
        question: z.string().trim().max(1000).optional(),
        targetLanguage: z.string().trim().max(60).optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(6000),
            }),
          )
          .max(10)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const book = await db.getBookForUser(input.bookId, ctx.user.id);
      if (!book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found in your library." });
      }
      if (input.mode === "ask" && !input.question) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please type a question first." });
      }

      const page = await db.getBookPage(book.id, input.pageNumber);

      try {
        const answer = await askReadingBuddy({
          mode: input.mode,
          highlight: input.highlight,
          question: input.question ?? null,
          targetLanguage: input.targetLanguage ?? null,
          bookTitle: book.title,
          bookAuthor: book.author,
          pageNumber: input.pageNumber,
          pageCount: book.pageCount,
          pageContext: page?.content ?? "",
          history: input.history,
        });
        return { answer, mode: input.mode };
      } catch (error) {
        console.error("[buddy.ask] failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The reading buddy could not answer just now. Please try again.",
        });
      }
    }),
});
