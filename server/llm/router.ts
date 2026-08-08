/**
 * LLM Router — task-based provider selection.
 *
 * Routes each task type to the most appropriate provider/model combination:
 * - Chunk analysis (bulk, cheap): DeepSeek if available, else OpenAI gpt-4o-mini
 * - Chapter synthesis: DeepSeek if available, else OpenAI gpt-4o-mini
 * - Book synthesis: OpenAI gpt-4o (stronger model for the final synthesis)
 * - Embeddings: OpenAI text-embedding-3-small (DeepSeek has no embeddings)
 * - Reading buddy (live): DeepSeek if available, else OpenAI gpt-4o-mini
 * - Reading buddy hard: OpenAI gpt-4o (fallback for complex questions)
 */
import { deepseekProvider } from "./deepseek";
import { openaiProvider } from "./openai";
import type { LLMProvider, LLMRequest, LLMResponse, LLMTask } from "./provider";

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
      // Whole-book synthesis benefits from a stronger model.
      return { provider: openaiProvider, model: "gpt-4o-mini" };

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
  return config.provider.call({ ...req, model: config.model });
}

/**
 * Generate an embedding for a text. Always uses OpenAI (DeepSeek has no embeddings).
 */
export async function llmEmbed(text: string): Promise<number[]> {
  return openaiProvider.embed(text);
}

/**
 * Get the provider name for a task (useful for logging).
 */
export function getProviderName(task: LLMTask): string {
  return getConfig(task).provider.name;
}

