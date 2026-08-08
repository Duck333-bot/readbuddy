/**
 * OpenAI / Manus Forge adapter.
 * Uses the same Forge endpoint that the existing invokeLLM() uses,
 * but wrapped in the LLMProvider interface.
 */
import { ENV } from "../_core/env";
import type { LLMProvider, LLMRequest, LLMResponse } from "./provider";

const FORGE_URL = () =>
  ENV.forgeApiUrl?.trim()
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1`
    : "https://forge.manus.im/v1";

async function forgePost(path: string, body: unknown): Promise<unknown> {
  const url = `${FORGE_URL()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Forge API error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * TF-IDF keyword vector for semantic similarity when no embeddings API is available.
 * Produces a sparse vector over a fixed vocabulary derived from the input text.
 * Cosine similarity on these vectors gives reasonable keyword-overlap ranking.
 */
function tfidfVector(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  // Use a simple hash to map words to a 512-dim vector
  const vec = new Array(512).fill(0);
  for (const word of words) {
    if (word.length < 3) continue; // skip stop words
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) & 0x1ff; // mod 512
    }
    vec[hash] = (vec[hash] ?? 0) + 1;
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map(v => v / norm);
}

export const openaiProvider: LLMProvider = {
  name: "openai-forge",

  async call(req: LLMRequest): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: req.model ?? "gpt-4o-mini",
      messages: req.messages,
      temperature: req.temperature ?? 0.5,
    };
    if (req.max_tokens) body.max_tokens = req.max_tokens;

    const data = (await forgePost("/chat/completions", body)) as {
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

  async embed(text: string): Promise<number[]> {
    // Try the real embeddings API first; fall back to TF-IDF keyword vectors.
    try {
      const data = (await forgePost("/embeddings", {
        model: "text-embedding-3-small",
        input: text,
      })) as { data: { embedding: number[] }[] };
      const embedding = data.data[0]?.embedding;
      if (embedding && embedding.length > 0) return embedding;
    } catch {
      // Forge does not expose an embeddings endpoint — fall through to TF-IDF.
    }
    return tfidfVector(text);
  },
};
