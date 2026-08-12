import { describe, expect, it } from "vitest";
import { summarizeAlphaEvents, type AnalyticsEventRow } from "./db";

const now = new Date("2026-08-12T00:00:00.000Z").getTime();

function event(partial: Partial<AnalyticsEventRow> & { event: string; minutesAgo?: number }): AnalyticsEventRow {
  const { minutesAgo = 0, ...rest } = partial;
  return {
    userId: null,
    bookId: null,
    visitorId: null,
    metadata: null,
    createdAt: new Date(now - minutesAgo * 60 * 1000),
    ...rest,
  } as AnalyticsEventRow;
}

describe("alpha decision metrics", () => {
  it("reports median and p95 AI answer latency from operation telemetry", () => {
    const summary = summarizeAlphaEvents(
      [100, 200, 300, 400, 5000].map(durationMs =>
        event({ event: "operation:llm_reading_buddy", userId: 1, bookId: 7, metadata: { success: true, durationMs } }),
      ),
      now,
    );
    expect(summary.economics.aiAnswerCount).toBe(5);
    expect(summary.economics.aiAnswerMedianMs).toBe(300);
    expect(summary.economics.aiAnswerP95Ms).toBe(5000);
  });

  it("computes failure rate across all recorded operations", () => {
    const summary = summarizeAlphaEvents(
      [
        event({ event: "operation:llm_reading_buddy", metadata: { success: true, durationMs: 900 } }),
        event({ event: "operation:embedding", metadata: { success: false, durationMs: 40 } }),
        event({ event: "operation:book_brain_pipeline", metadata: { success: true, durationMs: 60000 } }),
        event({ event: "operation:embedding", metadata: { success: true, durationMs: 30 } }),
      ],
      now,
    );
    expect(summary.economics.operationCount).toBe(4);
    expect(summary.economics.failureRatePercent).toBe(25);
    expect(summary.alpha.operationFailures).toBe(1);
    expect(summary.economics.bookBrainMedianMs).toBe(60000);
  });

  it("derives cost per book, per AI answer, and per reader from estimated cost metadata", () => {
    const summary = summarizeAlphaEvents(
      [
        event({ event: "operation:llm_reading_buddy", userId: 1, bookId: 7, metadata: { success: true, durationMs: 1000, estimatedCostUsd: 0.002 } }),
        event({ event: "operation:llm_reading_buddy", userId: 1, bookId: 7, metadata: { success: true, durationMs: 1200, estimatedCostUsd: 0.004 } }),
        event({ event: "operation:book_brain_pipeline", userId: 1, bookId: 7, metadata: { success: true, durationMs: 90000, estimatedCostUsd: 0.09 } }),
      ],
      now,
    );
    expect(summary.economics.costPerAiInteractionUsd).toBeCloseTo(0.003, 6);
    expect(summary.economics.costPerBookUsd).toBeCloseTo(0.096, 6);
    expect(summary.economics.costPerReaderUsd).toBeCloseTo(0.096, 6);
    expect(summary.economics.totalEstimatedCostUsd).toBeCloseTo(0.096, 6);
  });

  it("measures time to first useful moment per reader and counts same-book returns once", () => {
    const summary = summarizeAlphaEvents(
      [
        event({ event: "pdf_selected", userId: 5, minutesAgo: 30 }),
        event({ event: "ai_answer_received", userId: 5, bookId: 3, minutesAgo: 26 }),
        event({ event: "return_to_book", userId: 5, bookId: 3, minutesAgo: 10 }),
        event({ event: "return_to_book", userId: 5, bookId: 3, minutesAgo: 5 }),
      ],
      now,
    );
    expect(summary.alpha.timeToFirstUsefulMomentMs).toBe(4 * 60 * 1000);
    expect(summary.alpha.retentionSameBookReturns).toBe(1);
    expect(summary.alpha.activationUsedAi).toBe(1);
  });

  it("reports the negative answer rate used as the trust signal", () => {
    const summary = summarizeAlphaEvents(
      [
        event({ event: "ai_answer_received", userId: 2 }),
        event({ event: "ai_answer_received", userId: 2 }),
        event({ event: "ai_answer_received", userId: 2 }),
        event({ event: "ai_answer_received", userId: 2 }),
        event({ event: "answer_negative", userId: 2 }),
        event({ event: "answer_positive", userId: 2 }),
      ],
      now,
    );
    expect(summary.alpha.trust.answers).toBe(4);
    expect(summary.alpha.trust.negativeRatePercent).toBe(25);
  });

  it("returns null metrics rather than fake numbers when nothing has been measured", () => {
    const summary = summarizeAlphaEvents([], now);
    expect(summary.economics.aiAnswerMedianMs).toBeNull();
    expect(summary.economics.failureRatePercent).toBeNull();
    expect(summary.economics.costPerBookUsd).toBeNull();
    expect(summary.alpha.timeToFirstUsefulMomentMs).toBeNull();
    expect(summary.alpha.trust.negativeRatePercent).toBeNull();
  });
});
