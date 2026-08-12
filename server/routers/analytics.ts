import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

const eventName = z.enum([
  "highlight_action",
  "simpler_after_explain",
  "evidence_tap",
  "lost_open",
  "notebook_save",
  "chapter_debrief_open",
  "chapter_debrief_dismiss",
  "book_question_open",
  "book_question_submit",
  "reading_open",
  "landing_view",
  "landing_start_clicked",
  "auth_completed",
  "library_reached",
  "upload_opened",
  "pdf_selected",
  "upload_started",
  "ready_to_read",
  "start_reading_clicked",
  "reader_opened",
  "meaningful_reading_session",
  "ai_answer_received",
  "reading_continued",
  "return_to_book",
]);

const visitorEventName = z.enum(["landing_view", "landing_start_clicked"]);

/** Product signals only. No selected passage, question, or AI answer is collected. */
export const analyticsRouter = router({
  trackVisitor: publicProcedure
    .input(z.object({ event: visitorEventName, visitorId: z.string().min(12).max(64) }))
    .mutation(async ({ input }) => {
      await db.recordAnalyticsEvent({ visitorId: input.visitorId, event: input.event });
      return { success: true } as const;
    }),

  track: protectedProcedure
    .input(
      z.object({
        event: eventName,
        visitorId: z.string().min(12).max(64).optional(),
        bookId: z.number().int().positive().optional(),
        pageNumber: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.recordAnalyticsEvent({
        userId: ctx.user.id,
        visitorId: input.visitorId,
        bookId: input.bookId,
        event: input.event,
        pageNumber: input.pageNumber,
        metadata: input.metadata,
      });
      return { success: true } as const;
    }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.getPrivateAnalyticsSummary();
  }),
});
