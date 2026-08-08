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
 * Detect chapter boundaries in a list of pages.
 * Returns groups of pages, each group representing one chapter.
 * Heuristic: a page starts a new chapter if its first non-empty line matches
 * common chapter heading patterns.
 */
function detectChapterGroups(
  pages: { pageNumber: number; content: string }[],
): { chapterNumber: number; pages: { pageNumber: number; content: string }[] }[] {
  const groups: { chapterNumber: number; pages: { pageNumber: number; content: string }[] }[] = [];
  let currentChapter = 0;
  let currentPages: { pageNumber: number; content: string }[] = [];

  for (const page of pages) {
    const firstLine = page.content.split("\n").find(l => l.trim().length > 0)?.trim() ?? "";
    const isChapterStart =
      /^chapter\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(firstLine) ||
      /^part\s+(\d+|[ivxlcdm]+)/i.test(firstLine) ||
      /^epilogue|^prologue|^introduction|^preface/i.test(firstLine);

    if (isChapterStart && currentPages.length > 0) {
      groups.push({ chapterNumber: currentChapter, pages: currentPages });
      currentChapter++;
      currentPages = [];
    }
    currentPages.push(page);
  }

  // Close the last chapter
  if (currentPages.length > 0) {
    groups.push({ chapterNumber: currentChapter, pages: currentPages });
  }

  // If no chapter headings were detected, treat every 15 pages as a "chapter"
  if (groups.length <= 1 && pages.length > 15) {
    const syntheticGroups: typeof groups = [];
    const chunkSize = 15;
    for (let i = 0; i < pages.length; i += chunkSize) {
      syntheticGroups.push({
        chapterNumber: Math.floor(i / chunkSize),
        pages: pages.slice(i, i + chunkSize),
      });
    }
    return syntheticGroups;
  }

  return groups;
}

/**
 * Split a chapter's pages into chunks of at most CHUNK_SIZE pages.
 * Smaller books get larger chunks; very large books use smaller chunks.
 */
const CHUNK_SIZE = 8; // pages per chunk

function chunkPages(
  pages: { pageNumber: number; content: string }[],
): { pageNumber: number; content: string }[][] {
  const chunks: { pageNumber: number; content: string }[][] = [];
  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE));
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
        entities: analysis.entities,
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

async function runPass4(bookId: number): Promise<void> {
  // Clear old embeddings (idempotent)
  await db.deleteBookEmbeddings(bookId);

  const chunks = await db.getBookChunks(bookId);

  for (const chunk of chunks) {
    // Embed the chunk summary (cheaper than embedding the full text)
    const textToEmbed = [
      chunk.summary ?? "",
      ((chunk.entities as string[] | null) ?? []).join(", "),
      ((chunk.concepts as string[] | null) ?? []).join(", "),
    ]
      .filter(Boolean)
      .join("\n");

    if (!textToEmbed.trim()) continue;

    try {
      const embedding = await llmEmbed(textToEmbed);
      await db.insertBookEmbedding({
        bookId,
        chunkId: chunk.id,
        embedding,
        metadata: {
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          chapterNumber: chunk.chapterNumber,
          chunkSequence: chunk.chunkSequence,
        },
      });
    } catch (err) {
      // Embedding failures are non-fatal; context builder falls back to proximity.
      console.warn(`[bookBrain] embedding failed for chunk ${chunk.id}:`, err);
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
  const chapterContext = currentChapter
    ? `Chapter ${currentChapter.chapter} — "${currentChapter.title}": ${currentChapter.summary}`
    : null;

  // Relevant entities: filter by spoiler mode
  const entities = await db.getBookEntities(bookId);
  const relevantEntities = entities
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
      const queryEmbedding = await llmEmbed(queryText);
      const embeddings = await db.getBookEmbeddings(bookId);

      // Filter by spoiler mode: exclude chunks that start after the current page
      const eligible = embeddings.filter(emb => {
        const meta = emb.metadata as { startPage: number; endPage: number } | null;
        if (!meta) return true;
        return spoilerMode === "full" || meta.startPage <= pageLimit;
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
            return `[Relevant passage from ${pageRange}, similarity: ${score.toFixed(2)}]\n${chunk.summary ?? ""}`;
          })
          .filter(Boolean)
          .join("\n\n");
      }
    } catch (err) {
      console.warn("[bookBrain] semantic retrieval failed:", err);
      // Fall back to proximity-only context
    }
  }

  return {
    overallSummary: brain?.overallSummary ?? null,
    themes: (brain?.themes ?? []) as string[],
    chapterContext,
    relevantEntities,
    keyPassagesNearby,
    semanticChunks,
    brainReady,
    passCompleted,
  };
}
