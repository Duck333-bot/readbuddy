import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { extractPdf, MAX_PAGES, titleFromFilename } from "../pdf";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { createHeartbeatJob } from "../_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";

/** 40 MB — comfortably fits most books while staying inside the body limit. */
const MAX_PDF_BYTES = 40 * 1024 * 1024;

async function ownBookOrThrow(bookId: number, userId: number) {
  const book = await db.getBookForUser(bookId, userId);
  if (!book) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Book not found in your library." });
  }
  return book;
}

export const booksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listBooksForUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return ownBookOrThrow(input.bookId, ctx.user.id);
    }),

  page: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        pageNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const book = await ownBookOrThrow(input.bookId, ctx.user.id);
      const clamped = Math.min(Math.max(input.pageNumber, 1), Math.max(book.pageCount, 1));
      const page = await db.getBookPage(book.id, clamped);
      return {
        pageNumber: clamped,
        pageCount: book.pageCount,
        content: page?.content ?? "",
      };
    }),

  /**
   * Receives a base64-encoded PDF, stores the file and its cover in S3, then
   * extracts per-page text. The client renders the cover thumbnail because
   * rasterising a PDF page needs a canvas, which the server does not have.
   */
  upload: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(400),
        fileBase64: z.string().min(1),
        coverBase64: z.string().optional(),
        title: z.string().max(400).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.fileBase64, "base64");
      if (bytes.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That file appears to be empty." });
      }
      if (bytes.length > MAX_PDF_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "PDFs must be 40 MB or smaller.",
        });
      }
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That file is not a valid PDF.",
        });
      }

      let extracted;
      try {
        extracted = await extractPdf(new Uint8Array(bytes));
      } catch (error) {
        console.error("[books.upload] PDF extraction failed:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This PDF could not be read. It may be corrupted or password-protected.",
        });
      }

      const readableChars = extracted.pages.join("").replace(/\s/g, "").length;
      if (readableChars < 40) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No selectable text was found in this PDF. It is probably a scanned book, which ReadBuddy cannot read yet.",
        });
      }

      const safeName = input.filename.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const { key: fileKey, url: fileUrl } = await storagePut(
        `books/${ctx.user.id}/${safeName}`,
        bytes,
        "application/pdf",
      );

      let coverKey: string | null = null;
      let coverUrl: string | null = null;
      if (input.coverBase64) {
        try {
          const coverBytes = Buffer.from(
            input.coverBase64.replace(/^data:image\/\w+;base64,/, ""),
            "base64",
          );
          if (coverBytes.length > 0 && coverBytes.length < 4 * 1024 * 1024) {
            const stored = await storagePut(
              `covers/${ctx.user.id}/${safeName}.jpg`,
              coverBytes,
              "image/jpeg",
            );
            coverKey = stored.key;
            coverUrl = stored.url;
          }
        } catch (error) {
          // A missing cover is cosmetic; never fail the upload for it.
          console.warn("[books.upload] cover upload failed:", error);
        }
      }

      const title =
        input.title?.trim() || extracted.title || titleFromFilename(input.filename);

      const bookId = await db.createBook({
        userId: ctx.user.id,
        title: title.slice(0, 500),
        author: extracted.author,
        fileKey,
        fileUrl,
        coverKey,
        coverUrl,
        pageCount: extracted.pageCount,
        // Open on real text, not a cover or blank front-matter page.
        lastPage: extracted.firstReadablePage,
        firstReadablePage: extracted.firstReadablePage,
        pdfOutline: extracted.outline,
        fileSize: bytes.length,
      });

      await db.insertBookPages(
        extracted.pages.map((content, index) => ({
          bookId,
          pageNumber: index + 1,
          content,
        })),
      );

      // Kick off the Book Brain background pipeline via a Heartbeat job.
      try {
        const sessionToken =
          parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const job = await createHeartbeatJob(
          {
            name: `book-brain-${bookId}`,
            cron: "0 * * * * *",
            path: "/api/scheduled/bookBrain",
            payload: { bookId },
            description: `Book Brain pipeline for book ${bookId}`,
          },
          sessionToken,
        );
        await db.upsertBookBrain(bookId, {
          passCompleted: 1,
          brainJobTaskUid: job.taskUid,
        });
      } catch (brainErr) {
        console.warn("[books.upload] could not create Book Brain job:", brainErr);
        await db.upsertBookBrain(bookId, { passCompleted: 1 }).catch(() => {});
      }

      return {
        bookId,
        title,
        pageCount: extracted.pageCount,
        firstReadablePage: extracted.firstReadablePage,
        truncated: extracted.pageCount >= MAX_PAGES,
      };
    }),

  getBrain: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await ownBookOrThrow(input.bookId, ctx.user.id);
      const brain = await db.getBookBrain(input.bookId);
      const entities = await db.getBookEntities(input.bookId, brain?.analysisVersion ?? 1);
      const structureSource = brain?.structureSource ?? null;
      const structureConfidence = brain?.structureConfidence ?? 0;
      return {
        passCompleted: brain?.passCompleted ?? 0,
        pipelineStage: brain?.pipelineStage ?? "idle",
        pipelineError: brain?.pipelineError ?? null,
        pipelineRetryAfter: brain?.pipelineRetryAfter ?? null,
        overallSummary: brain?.overallSummary ?? null,
        themes: (brain?.themes ?? []) as string[],
        structureSource,
        structureConfidence,
        /** False when the "chapters" are our own grouping, so the UI must say Sections. */
        chaptersAreAuthorDefined: structureSource !== null && structureSource !== "synthetic" && structureConfidence >= 50,
        chapterSummaries: (brain?.chapterSummaries ?? []) as {
          chapter: number;
          title: string;
          summary: string;
          startPage: number;
          endPage?: number;
          authorDefined?: boolean;
        }[],
        entities: entities.map(e => ({ name: e.name, type: e.type, pages: e.pages })),
      };
    }),

  getSpoilerMode: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await ownBookOrThrow(input.bookId, ctx.user.id);
      const settings = await db.getReaderSettings(ctx.user.id, input.bookId);
      return { spoilerMode: settings?.spoilerMode ?? "safe" };
    }),

  setSpoilerMode: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        spoilerMode: z.enum(["safe", "full"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ownBookOrThrow(input.bookId, ctx.user.id);
      await db.upsertReaderSettings(ctx.user.id, input.bookId, {
        spoilerMode: input.spoilerMode,
      });
      return { spoilerMode: input.spoilerMode };
    }),

  updateProgress: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        lastPage: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const book = await ownBookOrThrow(input.bookId, ctx.user.id);
      const clamped = Math.min(input.lastPage, Math.max(book.pageCount, 1));
      await db.updateBookProgress(book.id, ctx.user.id, clamped);
      return { lastPage: clamped };
    }),

  rename: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        title: z.string().trim().min(1).max(400),
        author: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ownBookOrThrow(input.bookId, ctx.user.id);
      await db.updateBookMeta(input.bookId, ctx.user.id, {
        title: input.title,
        ...(input.author !== undefined ? { author: input.author } : {}),
      });
      return { success: true } as const;
    }),

  remove: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db.deleteBookForUser(input.bookId, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found in your library." });
      }
      return { success: true } as const;
    }),

  search: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        term: z.string().trim().min(2).max(120),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ownBookOrThrow(input.bookId, ctx.user.id);
      const rows = await db.searchBookText(input.bookId, input.term);
      return rows.map(row => {
        const idx = row.content.toLowerCase().indexOf(input.term.toLowerCase());
        const start = Math.max(0, idx - 70);
        return {
          pageNumber: row.pageNumber,
          snippet: row.content.slice(start, start + 220).trim(),
        };
      });
    }),
});
