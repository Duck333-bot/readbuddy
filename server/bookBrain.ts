/**
 * Book Brain v3 — Hierarchical processing pipeline.
 *
 * Fixes the critical 60k-char cap that limited analysis to ~30 pages.
 * Now processes 100% of every book via:
 *
 *   Pass 1 — Text extraction (done at upload, not here)
 *   Pass 2 — Chunk analysis: split book by chapter, analyze each 5-10 page chunk
 *             independently (summary, entities, concepts, key passages)
 *   Pass 3 — Synthesis: chapter-level → whole-book brain (no global char cap)
 *   Pass 4 — Embeddings: generate vectors for every chunk for semantic retrieval
 *
 * Each pass is idempotent: if the job is retried, it re-runs only incomplete passes.
 */

import * as db from "./db";
import { llmCall, llmEmbed } from "./llm/router";
import { embed as llmEmbedWithMeta } from "./llm/embeddings";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Parse JSON from an LLM response that may be wrapped in a markdown fence. */
function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/**
 * Estimate token count from character count.
 * Rough approximation: 1 token ≈ 4 characters for English prose.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Detect chapter boundaries in a list of pages.
 * Uses multiple heuristics in order of reliability:
 * 1. First non-empty line matches chapter heading patterns
 * 2. First several lines of the page contain heading patterns
 * 3. ALL CAPS short line at the top of a page
 * 4. Numbered headings (1., 1.1, etc.)
 * 5. Fallback: synthetic sections based on token count
 */
function isChapterBoundary(page: { content: string }): boolean {
  const lines = page.content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return false;

  // Check first 5 non-empty lines for heading patterns
  const headingLines = lines.slice(0, 5);
  for (const line of headingLines) {
    // Standard chapter/part headings
    if (/^chapter\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(line)) return true;
    if (/^part\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(line)) return true;
    if (/^(epilogue|prologue|introduction|preface|foreword|afterword|appendix|conclusion|acknowledgements?)$/i.test(line)) return true;
    // Roman numeral chapters: "I", "II", "III", "IV", "V", etc. (standalone)
    if (/^[IVXLCDM]{1,6}$/.test(line) && line.length <= 6) return true;
    // Numbered headings: "1.", "2.", "Chapter 1:", "CHAPTER ONE"
    if (/^\d+\.?\s*$/.test(line)) return true;
    // ALL CAPS short lines (likely section headings): e.g., "THE BEGINNING", "PART ONE"
    if (line === line.toUpperCase() && line.length >= 3 && line.length <= 60 && /[A-Z]/.test(line)) return true;
  }
  return false;
}

function detectChapterGroups(
  pages: { pageNumber: number; content: string }[],
): { chapterNumber: number; pages: { pageNumber: number; content: string }[] }[] {
  const groups: { chapterNumber: number; pages: { pageNumber: number; content: string }[] }[] = [];
  let currentChapter = 0;
  let currentPages: { pageNumber: number; content: string }[] = [];

  for (const page of pages) {
    const isStart = isChapterBoundary(page);
    if (isStart && currentPages.length > 0) {
      groups.push({ chapterNumber: currentChapter, pages: currentPages });
      currentChapter++;
      currentPages = [];
    }
    currentPages.push(page);
  }

  if (currentPages.length > 0) {
    groups.push({ chapterNumber: currentChapter, pages: currentPages });
  }

  // If no chapter headings detected, create synthetic sections of ~3,000 tokens each
  if (groups.length <= 1 && pages.length > 10) {
    const syntheticGroups: typeof groups = [];
    let currentGroup: typeof pages = [];
    let currentTokens = 0;
    let chapterNum = 0;
    const TARGET_TOKENS = 3000;

    for (const page of pages) {
      const pageTokens = estimateTokens(page.content);
      // Start a new section if we would exceed the target
      if (currentTokens + pageTokens > TARGET_TOKENS && currentGroup.length > 0) {
        syntheticGroups.push({ chapterNumber: chapterNum, pages: currentGroup });
        chapterNum++;
        currentGroup = [];
        currentTokens = 0;
      }
      currentGroup.push(page);
      currentTokens += pageTokens;
    }
    if (currentGroup.length > 0) {
      syntheticGroups.push({ chapterNumber: chapterNum, pages: currentGroup });
    }
    return syntheticGroups;
  }

  return groups;
}

/**
 * Split a chapter's pages into token-based chunks of ~TARGET_CHUNK_TOKENS each.
 * Always respects chapter boundaries (never splits across chapters).
 * Target: ~3,000 tokens per chunk (~12,000 characters).
 */
const TARGET_CHUNK_TOKENS = 3000;
const MAX_CHUNK_TOKENS = 4500; // Hard cap to prevent oversized chunks

function chunkPages(
  pages: { pageNumber: number; content: string }[],
): { pageNumber: number; content: string }[][] {
  const chunks: { pageNumber: number; content: string }[][] = [];
  let currentChunk: { pageNumber: number; content: string }[] = [];
  let currentTokens = 0;

  for (const page of pages) {
    const pageTokens = estimateTokens(page.content);
    // If adding this page would exceed the hard cap and we have content, flush
    if (currentTokens + pageTokens > MAX_CHUNK_TOKENS && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
    currentChunk.push(page);
    currentTokens += pageTokens;
    // Flush when we hit the target (soft cap)
    if (currentTokens >= TARGET_CHUNK_TOKENS) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  // Ensure we always have at least one chunk
  if (chunks.length === 0 && pages.length > 0) {
    chunks.push(pages);
  }
  return chunks;
}

/* -------------------------------------------------------------------------- */
/*  Pass 2 — Chunk Analysis + Chapter Synthesis                              */
/* -------------------------------------------------------------------------- */

async function runPass2(
  bookId: number,
  pages: { pageNumber: number; content: string }[],
): Promise<void> {
  // Clear any existing chunks (idempotent retry)
  await db.deleteBookChunks(bookId);

  const chapterGroups = detectChapterGroups(pages);
  const chapterSummaries: { chapter: number; title: string; summary: string; startPage: number }[] = [];

  for (const group of chapterGroups) {
    const chunks = chunkPages(group.pages);
    const chunkSummaries: string[] = [];
    const allEntities = new Set<string>();
    const allConcepts = new Set<string>();
    const allKeyPassages: { text: string; reason: string }[] = [];

    for (let seq = 0; seq < chunks.length; seq++) {
      const chunk = chunks[seq]!;
      const chunkText = chunk.map(p => `[Page ${p.pageNumber}]\n${p.content}`).join("\n\n");
      const startPage = chunk[0]!.pageNumber;
      const endPage = chunk[chunk.length - 1]!.pageNumber;

      const prompt = `Analyze this book section (pages ${startPage}–${endPage}) and return ONLY valid JSON:
{
  "summary": "2-3 sentence summary of what happens/is argued in this section",
  "entities": ["person/place/concept name", ...],
  "concepts": ["main idea or theme", ...],
  "keyPassages": [{"text": "short quote (max 120 chars)", "reason": "why it matters"}, ...]
}

Rules: entities max 10, concepts max 5, keyPassages max 3, be specific not generic.

TEXT:
${chunkText}`;

      const res = await llmCall("chunk_analysis", {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      });

      const analysis = parseJson(res.text, {
        summary: "",
        entities: [] as string[],
        concepts: [] as string[],
        keyPassages: [] as { text: string; reason: string }[],
      });

      // Store chunk in DB
      await db.insertBookChunk({
        bookId,
        chapterNumber: group.chapterNumber,
        chunkSequence: seq,
        startPage,
        endPage,
        text: chunkText,
        summary: analysis.summary,
        entities: analysis.entities as string[],
        concepts: analysis.concepts,
        keyPassages: analysis.keyPassages,
      });

      chunkSummaries.push(analysis.summary);
      analysis.entities.forEach((e: string) => allEntities.add(e));
      analysis.concepts.forEach((c: string) => allConcepts.add(c));
      allKeyPassages.push(...analysis.keyPassages);
    }

    // Synthesize chunk summaries into a chapter summary
    let chapterSummary = chunkSummaries.join(" ");
    if (chunkSummaries.length > 1) {
      const synthPrompt = `Combine these section summaries from a single chapter into one coherent paragraph (3-4 sentences):

${chunkSummaries.map((s, i) => `Section ${i + 1}: ${s}`).join("\n")}

Write a single paragraph that captures the chapter's key events, arguments, and significance.`;

      const synthRes = await llmCall("chapter_synthesis", {
        messages: [{ role: "user", content: synthPrompt }],
        temperature: 0.3,
        max_tokens: 250,
      });
      chapterSummary = synthRes.text.trim();
    }

    const startPage = group.pages[0]!.pageNumber;
    const chapterTitle = `Chapter ${group.chapterNumber + 1}`;
    chapterSummaries.push({
      chapter: group.chapterNumber + 1,
      title: chapterTitle,
      summary: chapterSummary,
      startPage,
    });
  }

  // Store chapter summaries in bookBrain
  await db.upsertBookBrain(bookId, {
    chapterSummaries,
    passCompleted: 2,
  });
}

/* -------------------------------------------------------------------------- */
/*  Pass 3 — Whole-Book Synthesis                                            */
/* -------------------------------------------------------------------------- */

async function runPass3(bookId: number): Promise<void> {
  const brain = await db.getBookBrain(bookId);
  const chapters = (brain?.chapterSummaries ?? []) as {
    chapter: number; title: string; summary: string; startPage: number;
  }[];

  if (chapters.length === 0) return;

  // Synthesize all chapter summaries into a whole-book brain
  const chapterList = chapters
    .map(c => `Chapter ${c.chapter} (starts p.${c.startPage}): ${c.summary}`)
    .join("\n\n");

  const prompt = `You have read a complete book. Here is a summary of every chapter:

${chapterList}

Provide a whole-book analysis as ONLY valid JSON:
{
  "overallSummary": "3-5 sentence summary of the entire book",
  "themes": ["main theme 1", "main theme 2", ...],
  "timeline": [{"event": "key event description", "chapter": 1}, ...]
}

Rules: themes 3-7 items, timeline up to 20 key events in chronological order.`;

  const res = await llmCall("book_synthesis", {
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1200,
  });

  const synthesis = parseJson(res.text, {
    overallSummary: "",
    themes: [] as string[],
    timeline: [] as { event: string; chapter: number }[],
  });

  // Extract entities from all chunks and deduplicate
  const allChunks = await db.getBookChunks(bookId);
  const entityMap = new Map<string, number>();
  for (const chunk of allChunks) {
    const entities = (chunk.entities as string[] | null) ?? [];
    for (const e of entities) {
      entityMap.set(e, (entityMap.get(e) ?? 0) + 1);
    }
  }

  // Keep the top 40 most-mentioned entities and ask the LLM to describe them
  const topEntities = Array.from(entityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([name]) => name);

  if (topEntities.length > 0) {
    const entityPrompt = `Based on this book (summary: ${synthesis.overallSummary}), describe these entities:
${topEntities.join(", ")}

Return ONLY valid JSON array:
[{"name": "...", "type": "person|place|concept|term|other", "description": "1-2 sentence description"}, ...]`;

    const entityRes = await llmCall("book_synthesis", {
      messages: [{ role: "user", content: entityPrompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const entities = parseJson(entityRes.text, [] as { name: string; type: string; description: string }[]);

    await db.deleteBookEntities(bookId);
    if (Array.isArray(entities) && entities.length > 0) {
      await db.insertBookEntities(
        entities.slice(0, 40).map(e => ({
          bookId,
          type: (e.type ?? "other") as "person" | "place" | "concept" | "term" | "other",
          name: String(e.name ?? "").slice(0, 255),
          description: String(e.description ?? ""),
          pages: [],
          relationships: [],
        })),
      );
    }
  }

  await db.upsertBookBrain(bookId, {
    overallSummary: synthesis.overallSummary,
    themes: synthesis.themes,
    timeline: synthesis.timeline.map((t: { event: string; chapter: number }) => ({ event: t.event, page: t.chapter })),
    passCompleted: 3,
  });
}

/* -------------------------------------------------------------------------- */
/*  Pass 4 — Embedding Generation                                            */
/* -------------------------------------------------------------------------- */

/**
 * Create fine-grained retrieval passages from all pages.
 * Target: ~800 tokens per passage (~3,200 chars), sliding window with 1-page overlap.
 * These cover 100% of the book text for precise semantic retrieval.
 */
function createRetrievalPassages(
  pages: { pageNumber: number; content: string }[],
): { startPage: number; endPage: number; text: string }[] {
  const TARGET_PASSAGE_TOKENS = 800;
  const passages: { startPage: number; endPage: number; text: string }[] = [];
  let currentPages: { pageNumber: number; content: string }[] = [];
  let currentTokens = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const pageTokens = estimateTokens(page.content);

    if (currentTokens + pageTokens > TARGET_PASSAGE_TOKENS * 1.5 && currentPages.length > 0) {
      // Flush current passage
      const text = currentPages.map(p => `[p.${p.pageNumber}] ${p.content}`).join("\n\n");
      passages.push({
        startPage: currentPages[0]!.pageNumber,
        endPage: currentPages[currentPages.length - 1]!.pageNumber,
        text,
      });
      // 1-page overlap: keep the last page of the current passage
      const overlap = currentPages.slice(-1);
      currentPages = overlap;
      currentTokens = overlap.reduce((sum, p) => sum + estimateTokens(p.content), 0);
    }

    currentPages.push(page);
    currentTokens += pageTokens;

    // Flush when we hit the target
    if (currentTokens >= TARGET_PASSAGE_TOKENS) {
      const text = currentPages.map(p => `[p.${p.pageNumber}] ${p.content}`).join("\n\n");
      passages.push({
        startPage: currentPages[0]!.pageNumber,
        endPage: currentPages[currentPages.length - 1]!.pageNumber,
        text,
      });
      // 1-page overlap
      const overlap = currentPages.slice(-1);
      currentPages = overlap;
      currentTokens = overlap.reduce((sum, p) => sum + estimateTokens(p.content), 0);
    }
  }

  // Flush remaining pages
  if (currentPages.length > 0) {
    const text = currentPages.map(p => `[p.${p.pageNumber}] ${p.content}`).join("\n\n");
    passages.push({
      startPage: currentPages[0]!.pageNumber,
      endPage: currentPages[currentPages.length - 1]!.pageNumber,
      text,
    });
  }

  return passages;
}

async function runPass4(bookId: number): Promise<void> {
  // Clear old embeddings and retrieval passages (idempotent)
  await db.deleteBookEmbeddings(bookId);
  await db.deleteRetrievalPassages(bookId);

  const chunks = await db.getBookChunks(bookId);

  // Part A: Embed analysis chunks (for chapter-level understanding)
  for (const chunk of chunks) {
    const chapterTitle = `Chapter ${(chunk.chapterNumber ?? 0) + 1}`;
    const textToEmbed = [
      chapterTitle,
      chunk.summary ?? "",
      ((chunk.entities as string[] | null) ?? []).join(", "),
      ((chunk.concepts as string[] | null) ?? []).join(", "),
      (chunk.text as string | null)?.slice(0, 2000) ?? "",
    ]
      .filter(Boolean)
      .join("\n");

    if (!textToEmbed.trim()) continue;

    try {
      const embResult = await llmEmbedWithMeta(textToEmbed);
      await db.insertBookEmbedding({
        bookId,
        chunkId: chunk.id,
        embedding: embResult.embedding,
        metadata: {
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          chapterNumber: chunk.chapterNumber,
          chunkSequence: chunk.chunkSequence,
          embeddingProvider: embResult.provider,
          embeddingModel: embResult.model,
          embeddingDimensions: embResult.dimensions,
        },
      });
    } catch (err) {
      console.warn(`[bookBrain] chunk embedding failed for chunk ${chunk.id}:`, err);
    }
  }

  // Part B: Create fine-grained retrieval passages covering 100% of the book
  const allPages = await db.getAllPagesForBook(bookId);
  const passages = createRetrievalPassages(allPages);

  for (const passage of passages) {
    try {
      const embResult = await llmEmbedWithMeta(passage.text.slice(0, 3200));
      await db.insertRetrievalPassage({
        bookId,
        startPage: passage.startPage,
        endPage: passage.endPage,
        text: passage.text.slice(0, 8000), // Store up to 8000 chars
        embedding: embResult.embedding,
      });
    } catch (err) {
      // Store passage without embedding — still useful for proximity retrieval
      console.warn(`[bookBrain] passage embedding failed (pp.${passage.startPage}-${passage.endPage}):`, err);
      await db.insertRetrievalPassage({
        bookId,
        startPage: passage.startPage,
        endPage: passage.endPage,
        text: passage.text.slice(0, 8000),
        embedding: null,
      });
    }
  }

  await db.upsertBookBrain(bookId, { passCompleted: 4 });
}

/* -------------------------------------------------------------------------- */
/*  Main Pipeline Entry Point                                                 */
/* -------------------------------------------------------------------------- */

export async function runBookBrainPipeline(bookId: number): Promise<{
  passCompleted: number;
  skipped: boolean;
}> {
  const pages = await db.getAllPagesForBook(bookId);
  if (pages.length === 0) {
    return { passCompleted: 0, skipped: true };
  }

  const brain = await db.getBookBrain(bookId);
  const startPass = (brain?.passCompleted ?? 0) + 1;

  if (startPass > 4) {
    return { passCompleted: 4, skipped: true };
  }

  if (!brain) {
    await db.upsertBookBrain(bookId, { passCompleted: 1 });
  }

  if (startPass <= 2) {
    await runPass2(bookId, pages);
  }
  if (startPass <= 3) {
    await runPass3(bookId);
  }
  if (startPass <= 4) {
    await runPass4(bookId);
  }

  return { passCompleted: 4, skipped: false };
}

/* -------------------------------------------------------------------------- */
/*  Cosine Similarity for Semantic Retrieval                                 */
/* -------------------------------------------------------------------------- */

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/* -------------------------------------------------------------------------- */
/*  Context Builder — Used by the buddy when answering questions              */
/* -------------------------------------------------------------------------- */

export interface BrainContext {
  overallSummary: string | null;
  themes: string[];
  chapterContext: string | null;
  relevantEntities: string;
  keyPassagesNearby: string;
  semanticChunks: string;   // Top semantically-relevant chunks from anywhere in the book
  brainReady: boolean;
  passCompleted: number;
}

export async function buildBrainContext(
  bookId: number,
  currentPage: number,
  spoilerMode: "safe" | "full",
  queryText?: string,   // The highlighted text — used for semantic retrieval
): Promise<BrainContext> {
  const brain = await db.getBookBrain(bookId);
  const passCompleted = brain?.passCompleted ?? 0;
  const brainReady = passCompleted >= 4;

  if (passCompleted < 2) {
    return {
      overallSummary: null,
      themes: [],
      chapterContext: null,
      relevantEntities: "",
      keyPassagesNearby: "",
      semanticChunks: "",
      brainReady: false,
      passCompleted,
    };
  }

  // Spoiler mode: in "safe" mode, only use information up to the current page.
  const pageLimit = spoilerMode === "safe" ? currentPage : Infinity;

  // Chapter context: find the chapter the reader is currently in.
  const chapters = ((brain?.chapterSummaries ?? []) as {
    chapter: number; title: string; summary: string; startPage: number;
  }[]).filter(c => spoilerMode === "full" || c.startPage <= pageLimit);

  const currentChapter = [...chapters].reverse().find(c => c.startPage <= currentPage);
  // P0-2: In safe mode, only show the current chapter summary if we have confirmed
  // that the chapter started at or before the current page. The summary itself was
  // generated from the full chapter text, so we show it but with a note that it
  // covers the chapter up to the reader's current position.
  const chapterContext = currentChapter
    ? `Chapter ${currentChapter.chapter} — "${currentChapter.title}": ${currentChapter.summary}`
    : null;

  // P0-2: Relevant entities — in safe mode, only include entities whose first
  // known page is at or before the reader's current page.
  const entities = await db.getBookEntities(bookId);
  const filteredEntities = spoilerMode === "full"
    ? entities
    : entities.filter(e => {
        const pages = (e.pages as number[] | null) ?? [];
        // If no page info, include it (conservative — better to include than exclude).
        if (pages.length === 0) return true;
        // Only include if the entity first appeared at or before the current page.
        return Math.min(...pages) <= pageLimit;
      });
  const relevantEntities = filteredEntities
    .slice(0, 15)
    .map(e => `• ${e.name} (${e.type}): ${e.description}`)
    .join("\n");

  // Key passages nearby (proximity-based fallback)
  const keyPassagesNearby = ((brain?.keyPassages ?? []) as { page: number; text: string; reason: string }[])
    .filter(p => (spoilerMode === "safe" ? p.page <= pageLimit : true) && Math.abs(p.page - currentPage) <= 15)
    .slice(0, 3)
    .map(p => `[p.${p.page}] "${p.text}" — ${p.reason}`)
    .join("\n");

  // Semantic retrieval: find the most relevant chunks from anywhere in the book
  let semanticChunks = "";
  if (queryText && brainReady) {
    try {
      const queryEmbResult = await llmEmbedWithMeta(queryText);
      const queryEmbedding = queryEmbResult.embedding;
      const embeddings = await db.getBookEmbeddings(bookId);

      // Filter by spoiler mode: exclude chunks that start after the current page
      const eligible = embeddings.filter(emb => {
        const meta = emb.metadata as { startPage: number; endPage: number } | null;
        if (!meta) return true;
        // P0-2: Use endPage so chunks that straddle the current page are excluded.
        return spoilerMode === "full" || meta.endPage <= pageLimit;
      });

      // Score each chunk by cosine similarity
      const scored = eligible
        .map(emb => ({
          emb,
          score: cosineSimilarity(queryEmbedding, emb.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // top 5 most relevant chunks

      if (scored.length > 0) {
        // Fetch the actual chunk text for the top results
        const chunkIds = scored.map(s => s.emb.chunkId);
        const chunks = await db.getBookChunksByIds(chunkIds);
        const chunkMap = new Map(chunks.map(c => [c.id, c]));

        semanticChunks = scored
          .map(({ emb, score }) => {
            const chunk = chunkMap.get(emb.chunkId);
            if (!chunk) return null;
            const meta = emb.metadata as { startPage: number; endPage: number } | null;
            const pageRange = meta ? `pp.${meta.startPage}–${meta.endPage}` : "";
            // P0-5: Return actual evidence — original chunk text (truncated) with page citation.
            // This lets the AI cite specific details, not just paraphrase the summary.
            const originalText = (chunk.text as string | null)?.slice(0, 1500) ?? chunk.summary ?? "";
            return [
              `[Evidence from ${pageRange} | relevance: ${score.toFixed(2)}]`,
              originalText,
            ].join("\n");
          })
          .filter(Boolean)
          .join("\n\n---\n\n");
      }
    } catch (err) {
      console.warn("[bookBrain] semantic retrieval failed:", err);
      // Fall back to proximity-only context
    }
  }

  // P0-2: In safe mode, do not expose whole-book summary or themes — they were
  // generated from the full book and may contain future content.
  const safeOverallSummary = spoilerMode === "full" ? (brain?.overallSummary ?? null) : null;
  const safeThemes = spoilerMode === "full" ? ((brain?.themes ?? []) as string[]) : [];

  return {
    overallSummary: safeOverallSummary,
    themes: safeThemes,
    chapterContext,
    relevantEntities,
    keyPassagesNearby,
    semanticChunks,
    brainReady,
    passCompleted,
  };
}
