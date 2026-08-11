import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { askReadingBuddy, BUDDY_MODES, updateReaderMemoryFromAnswer } from "../readingBuddy";
import { protectedProcedure, router } from "../_core/trpc";
import { buildBrainContext } from "../bookBrain";

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

      // Fetch settings and reader memory first, then build brain context
      // with the correct spoiler mode and the highlight text for semantic retrieval.
      const [settings, memory] = await Promise.all([
        db.getReaderSettings(ctx.user.id, input.bookId).catch(() => null),
        db.getReaderMemory(ctx.user.id, input.bookId).catch(() => null),
      ]);

      const spoilerMode = settings?.spoilerMode ?? "safe";

      // Build brain context with spoiler mode + highlight for semantic retrieval.
      const finalBrainCtx = await buildBrainContext(
        input.bookId,
        input.pageNumber,
        spoilerMode,
        input.highlight,
      ).catch(() => null);

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
          brainContext: finalBrainCtx,
          readerMemory: memory
            ? {
                knownVocab: (memory.knownVocab ?? []) as {
                  word: string;
                  definition: string;
                  pageFirstAsked: number;
                }[],
                knownConcepts: (memory.knownConcepts ?? []) as {
                  concept: string;
                  explanation: string;
                  pageFirstAsked: number;
                }[],
                preferredLevel: memory.preferredLevel,
              }
            : null,
          spoilerMode,
        });

        // Update reader memory asynchronously — never block the response.
        updateReaderMemoryFromAnswer(
          ctx.user.id,
          input.bookId,
          input.mode,
          input.highlight,
          answer,
          input.pageNumber,
        ).catch(e => console.warn("[buddy.ask] memory update failed:", e));

        return {
          answer,
          mode: input.mode,
          brainReady: finalBrainCtx?.brainReady ?? false,
          passCompleted: finalBrainCtx?.passCompleted ?? 0,
        };
      } catch (error) {
        console.error("[buddy.ask] failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The reading buddy could not answer just now. Please try again.",
        });
      }
    }),

  /** Ask about the book without selecting a passage. Retrieval remains page-bounded in safe mode. */
  askBook: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        currentPage: z.number().int().positive(),
        question: z.string().trim().min(3).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const book = await db.getBookForUser(input.bookId, ctx.user.id);
      if (!book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found in your library." });
      }

      const [settings, memory, page] = await Promise.all([
        db.getReaderSettings(ctx.user.id, input.bookId).catch(() => null),
        db.getReaderMemory(ctx.user.id, input.bookId).catch(() => null),
        db.getBookPage(input.bookId, Math.min(input.currentPage, book.pageCount)),
      ]);
      const spoilerMode = settings?.spoilerMode ?? "safe";
      const brainContext = await buildBrainContext(
        input.bookId,
        Math.min(input.currentPage, book.pageCount),
        spoilerMode,
        input.question,
      ).catch(() => null);

      try {
        const answer = await askReadingBuddy({
          mode: "ask",
          // The question itself drives semantic retrieval. The prompt clearly labels it as a whole-book question.
          highlight: `Whole-book question: ${input.question}`,
          question: input.question,
          bookTitle: book.title,
          bookAuthor: book.author,
          pageNumber: Math.min(input.currentPage, book.pageCount),
          pageCount: book.pageCount,
          pageContext: page?.content ?? "",
          brainContext,
          readerMemory: memory
            ? {
                knownVocab: (memory.knownVocab ?? []) as { word: string; definition: string; pageFirstAsked: number }[],
                knownConcepts: (memory.knownConcepts ?? []) as { concept: string; explanation: string; pageFirstAsked: number }[],
                preferredLevel: memory.preferredLevel,
              }
            : null,
          spoilerMode,
        });
        return {
          answer,
          brainReady: brainContext?.brainReady ?? false,
          passCompleted: brainContext?.passCompleted ?? 0,
        };
      } catch (error) {
        console.error("[buddy.askBook] failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ReadBuddy could not answer that question just now. Please try again.",
        });
      }
    }),

  /** Get the reader's memory for a book (vocab, concepts, preferred level). */
  getMemory: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const memory = await db.getReaderMemory(ctx.user.id, input.bookId);
      return {
        knownVocab: (memory?.knownVocab ?? []) as {
          word: string;
          definition: string;
          pageFirstAsked: number;
        }[],
        knownConcepts: (memory?.knownConcepts ?? []) as {
          concept: string;
          explanation: string;
          pageFirstAsked: number;
        }[],
        preferredLevel: memory?.preferredLevel ?? "standard",
        questionCount: memory?.questionCount ?? 0,
      };
    }),
});
