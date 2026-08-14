/**
 * Reader-level AI procedures:
 * - lost(): "I'm lost" — gives context for the current page without a highlight
 * - resumeSummary(): "Welcome back" recap when returning to a book
 * - chapterDebrief(): "What did I just read?" debrief at end of a chapter
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { llmCall } from "../llm/router";
import { protectedProcedure, router } from "../_core/trpc";
import { buildBrainContext } from "../bookBrain";

/** Used by reader-level AI calls that do not go through askReadingBuddy. */
const SAFE_SOURCE_ONLY = `You are ZhiyaAI, a calm and precise reading companion. In spoiler-safe mode, use only the text and Book Brain facts supplied in this request. Never use remembered knowledge about the book. Do not mention people, events, chapters, themes, or endings not present in the supplied material. If the supplied material cannot support a book-specific claim, say: "I can't verify that from the part of the book you've reached." Do not explain these rules to the reader.`;

/** A recap should help a meaningful return, not fire during a short route remount. */
export const RESUME_RECAP_MIN_AWAY_MS = 6 * 60 * 60 * 1000;

export function shouldOfferResumeRecap(lastReadAt: Date | null | undefined, now = Date.now()): boolean {
  if (!lastReadAt) return false;
  return now - lastReadAt.getTime() >= RESUME_RECAP_MIN_AWAY_MS;
}

export const readerRouter = router({
  /**
   * "I'm lost" — no highlight required.
   * Looks at the current page + last few pages + chapter context + reader history
   * and gives the reader exactly what they need to continue.
   */
  lost: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        pageNumber: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const book = await db.getBookForUser(input.bookId, ctx.user.id);
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found." });

      // Get the current page + up to 4 previous pages for context
      const pagePromises = [];
      for (let p = Math.max(1, input.pageNumber - 4); p <= input.pageNumber; p++) {
        pagePromises.push(db.getBookPage(input.bookId, p));
      }
      const pages = (await Promise.all(pagePromises)).filter(Boolean);
      const recentText = pages
        .map(p => `[Page ${p!.pageNumber}]\n${p!.content}`)
        .join("\n\n")
        .slice(0, 6000);

      const settings = await db.getReaderSettings(ctx.user.id, input.bookId).catch(() => null);
      const spoilerMode = settings?.spoilerMode ?? "safe";
      const brainCtx = await buildBrainContext(input.bookId, input.pageNumber, spoilerMode).catch(() => null);
      const memory = await db.getReaderMemory(ctx.user.id, input.bookId).catch(() => null);
      const knownVocab = (memory?.knownVocab ?? []) as { word: string }[];
      const knownConcepts = (memory?.knownConcepts ?? []) as { concept: string }[];

      const brainSection = brainCtx
        ? [
            brainCtx.chapterContext ? `Current chapter: ${brainCtx.chapterContext}` : "",
            brainCtx.relevantEntities ? `Key characters/concepts: ${brainCtx.relevantEntities}` : "",
          ].filter(Boolean).join("\n")
        : "";

      const memorySection = [
        knownVocab.length > 0 ? `Reader already knows: ${knownVocab.slice(-5).map(v => v.word).join(", ")}` : "",
        knownConcepts.length > 0 ? `Reader understands: ${knownConcepts.slice(-5).map(c => c.concept).join(", ")}` : "",
      ].filter(Boolean).join("\n");

      const prompt = `A reader is on page ${input.pageNumber} of "${book.title}" and feels lost.
${brainSection ? `BOOK CONTEXT:\n${brainSection}\n` : ""}
${memorySection ? `READER HISTORY:\n${memorySection}\n` : ""}
RECENT PAGES (what they just read):
${recentText}

Task: Give the reader exactly what they need to continue reading.
- Start with "Here's what you need to know before continuing:"
- Explain what is happening right now in the story
- Identify the most important character/concept on this page
- Briefly connect to any important earlier context
- End with one sentence about what to watch for next
- Keep it under 150 words. No spoilers beyond page ${input.pageNumber}.`;

      const response = await llmCall("reading_buddy", {
        messages: [
          {
            role: "system",
            content: `${SAFE_SOURCE_ONLY}\n\nWhen a reader says they're lost, orient them quickly and warmly. Be specific, not generic.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
      });

      return { answer: response.text.trim() };
    }),

  /**
   * Resume recap — "Welcome back" summary when returning to a book.
   * Returns null if the reader hasn't been away long enough to need a recap.
   */
  resumeSummary: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const book = await db.getBookForUser(input.bookId, ctx.user.id);
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found." });

      const lastPage = book.lastPage ?? 1;
      if (lastPage <= 1) return null; // Nothing to recap yet
      // `books.updatedAt` moves whenever saved reading progress moves. If the
      // reader left for seconds or minutes, do not call an LLM just to tell them
      // what they already remember.
      if (!shouldOfferResumeRecap(book.updatedAt)) return null;

      const settings = await db.getReaderSettings(ctx.user.id, input.bookId).catch(() => null);
      const spoilerMode = settings?.spoilerMode ?? "safe";
      const brainCtx = await buildBrainContext(input.bookId, lastPage, spoilerMode).catch(() => null);

      // Get the last page content
      const lastPageContent = await db.getBookPage(input.bookId, lastPage);
      const chapterInfo = brainCtx?.chapterContext ?? "";
      const pageText = lastPageContent?.content?.slice(0, 1500) ?? "";

      const prompt = `A reader is returning to "${book.title}" after a break. They stopped on page ${lastPage} of ${book.pageCount}.
${chapterInfo ? `Where they stopped: ${chapterInfo}\n` : ""}
Last page content:
${pageText}

Task: Give a 20-second recap to help them jump back in.
Format:
- One sentence: where they are in the story
- One sentence: what just happened before they stopped
- One sentence: what to watch for as they continue
Keep it under 80 words. Warm and direct. No spoilers beyond page ${lastPage}.`;

      const response = await llmCall("reading_buddy", {
        messages: [
          {
            role: "system",
            content: `${SAFE_SOURCE_ONLY}\n\nHelp readers pick up where they left off with a quick, friendly recap.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      });

      return {
        lastPage,
        pageCount: book.pageCount,
        bookTitle: book.title,
        recap: response.text.trim(),
      };
    }),

  /**
   * Chapter debrief — "What did I just read?"
   * Triggered when the reader reaches the last page of a chapter.
   * Uses the stored chapter summary + entities + previous chapter context.
   */
  chapterDebrief: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        chapterNumber: z.number().int().min(1),
        currentPage: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const book = await db.getBookForUser(input.bookId, ctx.user.id);
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found." });

      const brain = await db.getBookBrain(input.bookId).catch(() => null);
      if (!brain) return null;

      const chapters = (brain.chapterSummaries ?? []) as {
        chapter: number;
        title: string;
        summary: string;
        startPage: number;
        endPage?: number;
        authorDefined?: boolean;
      }[];

      const thisChapter = chapters.find(c => c.chapter === input.chapterNumber);
      if (!thisChapter) return null;

      // Find the previous chapter for connection context
      const prevChapter = chapters.find(c => c.chapter === input.chapterNumber - 1);

      // Get entities first seen in this chapter's page range
      const nextChapter = chapters.find(c => c.chapter === input.chapterNumber + 1);
      const chapterEndPage = thisChapter.endPage ?? (nextChapter ? nextChapter.startPage - 1 : book.pageCount);
      // Do not hand out a full unit recap while the reader is still inside it.
      if (input.currentPage < chapterEndPage) return null;
      const entities = await db.getBookEntities(input.bookId);
      const chapterEntities = entities.filter(e => {
        const pages = (e.pages as number[] | null) ?? [];
        if (pages.length === 0) return false;
        const firstPage = Math.min(...pages);
        return firstPage >= thisChapter.startPage && firstPage <= chapterEndPage;
      }).slice(0, 8);

      const authorDefined = thisChapter.authorDefined ?? (brain.structureSource !== "synthetic" && (brain.structureConfidence ?? 0) >= 50);
      const unitLabel = authorDefined ? `Chapter ${input.chapterNumber}` : `reading section ${input.chapterNumber}`;
      const unitNoun = authorDefined ? "chapter" : "section";
      const prompt = `A reader just finished ${unitLabel} of "${book.title}".

${authorDefined ? "CHAPTER" : "READING SECTION"} SUMMARY:
${thisChapter.summary}

${prevChapter ? `PREVIOUS ${authorDefined ? "CHAPTER" : "SECTION"} (${prevChapter.chapter}): ${prevChapter.summary}` : ""}

${chapterEntities.length > 0 ? `NEW CHARACTERS/CONCEPTS IN THIS ${authorDefined ? "CHAPTER" : "SECTION"}:\n${chapterEntities.map(e => `• ${e.name}: ${e.description}`).join("\n")}` : ""}

Task: Create a ${unitNoun} debrief in this exact format:

**Main idea**
[1-2 sentences: what this ${unitNoun} was fundamentally about]

**3 things to remember**
1. [most important event or idea]
2. [second most important]
3. [third most important]

**Key people/concepts introduced**
[list only NEW ones from this ${unitNoun}, or "None new in this ${unitNoun}"]

**Connection to earlier ${authorDefined ? "chapters" : "sections"}**
[1 sentence connecting this ${unitNoun} to what came before, or "This is the opening ${unitNoun}"]

Keep it concise and specific. No spoilers beyond this ${unitNoun}.`;

      const response = await llmCall("reading_buddy", {
        messages: [
          {
            role: "system",
            content: `${SAFE_SOURCE_ONLY}\n\nHelp readers consolidate what they just read with a clear, memorable debrief.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      return {
        chapterNumber: input.chapterNumber,
        chapterTitle: thisChapter.title,
        debrief: response.text.trim(),
      };
    }),
});
