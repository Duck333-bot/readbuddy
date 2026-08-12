import * as db from "./db";
import type { LLMResponse } from "./llm/provider";

type OperationTelemetry = {
  operation: string;
  startedAt: number;
  success: boolean;
  userId?: number | null;
  bookId?: number | null;
  provider?: string;
  model?: string;
  usage?: LLMResponse["usage"];
  error?: unknown;
  extra?: Record<string, string | number | boolean | null>;
};

/**
 * Public reference pricing is deliberately represented as an estimate. It makes
 * early alpha economics comparable without ever persisting prompts, passages,
 * selected text, questions, answers, or API response bodies.
 */
const USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
};

export function estimateLlmCostUsd(model?: string, usage?: LLMResponse["usage"]) {
  if (!model || !usage) return null;
  const pricing = USD_PER_MILLION_TOKENS[model];
  if (!pricing) return null;
  return Number(((usage.promptTokens / 1_000_000) * pricing.input + (usage.completionTokens / 1_000_000) * pricing.output).toFixed(8));
}

export async function recordOperationTelemetry(input: OperationTelemetry) {
  const durationMs = Math.max(0, Date.now() - input.startedAt);
  const errorName = input.error instanceof Error ? input.error.name : input.error ? "UnknownError" : null;
  const estimatedCostUsd = estimateLlmCostUsd(input.model, input.usage);
  await db.recordAnalyticsEvent({
    userId: input.userId,
    bookId: input.bookId,
    event: `operation:${input.operation}`,
    metadata: {
      success: input.success,
      durationMs,
      provider: input.provider ?? null,
      model: input.model ?? null,
      promptTokens: input.usage?.promptTokens ?? null,
      completionTokens: input.usage?.completionTokens ?? null,
      totalTokens: input.usage?.totalTokens ?? null,
      estimatedCostUsd,
      errorType: errorName,
      ...input.extra,
    },
  });
}
