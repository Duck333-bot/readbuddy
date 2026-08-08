/**
 * DeepSeek adapter.
 * Uses the DEEPSEEK_API_KEY environment variable.
 * DeepSeek's API is OpenAI-compatible, so the request/response shape is the same.
 */
import type { LLMProvider, LLMRequest, LLMResponse } from "./provider";

const DEEPSEEK_URL = "https://api.deepseek.com/v1";

async function deepseekPost(path: string, body: unknown): Promise<unknown> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const res = await fetch(`${DEEPSEEK_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const deepseekProvider: LLMProvider = {
  name: "deepseek",

  async call(req: LLMRequest): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: req.model ?? "deepseek-chat",
      messages: req.messages,
      temperature: req.temperature ?? 0.5,
    };
    if (req.max_tokens) body.max_tokens = req.max_tokens;

    const data = (await deepseekPost("/chat/completions", body)) as {
      model: string;
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? "",
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  },

  // DeepSeek does not have an embeddings endpoint yet; fall back to OpenAI.
  async embed(_text: string): Promise<number[]> {
    throw new Error("DeepSeek does not support embeddings — use openaiProvider.embed()");
  },
};
