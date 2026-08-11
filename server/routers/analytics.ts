import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
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
]);

/** Product signals only. No selected passage, question, or AI answer is collected. */
export const analyticsRouter = router({
  track: protectedProcedure
    .input(
      z.object({
        event: eventName,
        bookId: z.number().int().positive().optional(),
        pageNumber: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.recordAnalyticsEvent({
        userId: ctx.user.id,
        bookId: input.bookId,
        event: input.event,
        pageNumber: input.pageNumber,
        metadata: input.metadata,
      });
      return { success: true } as const;
    }),
});
