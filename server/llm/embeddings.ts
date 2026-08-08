/**
 * Embeddings provider with automatic fallback chain.
 *
 * Priority:
 * 1. Direct OpenAI API (OPENAI_API_KEY env var) — real 1536-dim vectors
 * 2. Manus Forge /embeddings endpoint — if it becomes available
 * 3. TF-IDF keyword hash vectors (512-dim) — always works, no API key needed
 *
 * Every embedding is stored with metadata so we can detect stale vectors
 * and regenerate them when the provider or model changes.
 */

export type EmbeddingResult = {
  embedding: number[];
  provider: "openai" | "forge" | "tfidf";
  model: string;
  dimensions: number;
};

/* -------------------------------------------------------------------------- */
/*  TF-IDF keyword hash fallback (always available)                          */
/* -------------------------------------------------------------------------- */

function tfidfVector(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const vec = new Array(512).fill(0);
  for (const word of words) {
    if (word.length < 3) continue;
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) & 0x1ff; // mod 512
    }
    vec[hash] = (vec[hash] ?? 0) + 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map(v => v / norm);
}

/* -------------------------------------------------------------------------- */
/*  OpenAI direct API (OPENAI_API_KEY)                                       */
/* -------------------------------------------------------------------------- */

async function openaiEmbed(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Manus Forge /embeddings (may or may not be available)                    */
/* -------------------------------------------------------------------------- */

async function forgeEmbed(text: string): Promise<number[] | null> {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/$/, "") ?? "https://forge.manus.im";
  if (!apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Main embed function — tries providers in priority order                  */
/* -------------------------------------------------------------------------- */

export async function embed(text: string): Promise<EmbeddingResult> {
  // 1. Try direct OpenAI API
  const openaiVec = await openaiEmbed(text);
  if (openaiVec && openaiVec.length > 0) {
    return {
      embedding: openaiVec,
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: openaiVec.length,
    };
  }

  // 2. Try Forge
  const forgeVec = await forgeEmbed(text);
  if (forgeVec && forgeVec.length > 0) {
    return {
      embedding: forgeVec,
      provider: "forge",
      model: "text-embedding-3-small",
      dimensions: forgeVec.length,
    };
  }

  // 3. TF-IDF fallback
  const tfidf = tfidfVector(text);
  return {
    embedding: tfidf,
    provider: "tfidf",
    model: "tfidf-hash-512",
    dimensions: 512,
  };
}

/**
 * Get the current embedding provider name (for logging/debugging).
 */
export function getEmbeddingProviderName(): string {
  if (process.env.OPENAI_API_KEY) return "openai";
  return "tfidf-fallback";
}
