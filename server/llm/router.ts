/**
 * LLM Router — task-based provider selection.
 *
 * Routes each task type to the most appropriate provider/model combination:
 * - Chunk analysis (bulk, cheap): DeepSeek if available, else OpenAI gpt-4o-mini
 * - Chapter synthesis: DeepSeek if available, else OpenAI gpt-4o-mini
 * - Book synthesis: DeepSeek when configured; Forge OpenAI-compatible fallback
 * - Embeddings: OpenAI text-embedding-3-small (DeepSeek has no embeddings)
 * - Reading buddy (live): DeepSeek if available, else OpenAI gpt-4o-mini
 * - Reading buddy hard: OpenAI gpt-4o (fallback for complex questions)
 */
import { deepseekProvider } from "./deepseek";
import { openaiProvider } from "./openai";
import type { LLMProvider, LLMRequest, LLMResponse, LLMTask } from "./provider";
import { recordOperationTelemetry } from "../telemetry";

const hasDeepSeek = () => Boolean(process.env.DEEPSEEK_API_KEY);

type TaskConfig = {
  provider: LLMProvider;
  model: string;
};

function getConfig(task: LLMTask): TaskConfig {
  switch (task) {
    case "chunk_analysis":
      return hasDeepSeek()
        ? { provider: deepseekProvider, model: "deepseek-chat" }
        : { provider: openaiProvider, model: "gpt-4o-mini" };

    case "chapter_synthesis":
      return hasDeepSeek()
        ? { provider: deepseekProvider, model: "deepseek-chat" }
        : { provider: openaiProvider, model: "gpt-4o-mini" };

    case "book_synthesis":
      // A finished book brain is more valuable than a stronger-model preference
      // that leaves a long book permanently paused. Use the configured bulk
      // provider, while retaining Forge as the no-credential fallback.
      return hasDeepSeek()
        ? { provider: deepseekProvider, model: "deepseek-chat" }
        : { provider: openaiProvider, model: "gpt-4o-mini" };

    case "material_analysis":
    case "lesson_planning":
    case "study_generation":
      return hasDeepSeek()
        ? { provider: deepseekProvider, model: "deepseek-chat" }
        : { provider: openaiProvider, model: "gpt-4o-mini" };

    case "embedding":
      // Only OpenAI has embeddings for now.
      return { provider: openaiProvider, model: "text-embedding-3-small" };

    case "reading_buddy":
      return hasDeepSeek()
        ? { provider: deepseekProvider, model: "deepseek-chat" }
        : { provider: openaiProvider, model: "gpt-4o-mini" };

    case "reading_buddy_hard":
      return { provider: openaiProvider, model: "gpt-4o-mini" };
  }
}

/**
 * Call an LLM for a specific task. Automatically selects the best provider.
 */
export async function llmCall(task: LLMTask, req: Omit<LLMRequest, "model">): Promise<LLMResponse> {
  const config = getConfig(task);
  const startedAt = Date.now();
  try {
    const response = await config.provider.call({ ...req, model: config.model });
    void recordOperationTelemetry({
      operation: `llm_${task}`,
      startedAt,
      success: true,
      provider: config.provider.name,
      model: response.model ?? config.model,
      usage: response.usage,
    });
    return response;
  } catch (error) {
    void recordOperationTelemetry({ operation: `llm_${task}`, startedAt, success: false, provider: config.provider.name, model: config.model, error });
    throw error;
  }
}

/**
 * Generate an embedding for a text. Always uses OpenAI (DeepSeek has no embeddings).
 */
export async function llmEmbed(text: string): Promise<number[]> {
  const startedAt = Date.now();
  try {
    const result = await openaiProvider.embed(text);
    void recordOperationTelemetry({ operation: "embedding", startedAt, success: true, provider: openaiProvider.name, model: "text-embedding-3-small", extra: { dimensions: result.length } });
    return result;
  } catch (error) {
    void recordOperationTelemetry({ operation: "embedding", startedAt, success: false, provider: openaiProvider.name, model: "text-embedding-3-small", error });
    throw error;
  }
}

/**
 * Get the provider name for a task (useful for logging).
 */
export function getProviderName(task: LLMTask): string {
  return getConfig(task).provider.name;
}
