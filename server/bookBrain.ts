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
import {
  canMakeChapterClaims,
  resolveBookStructure,
  type BookSection,
  type BookStructure,
  type HeadingCandidate,
} from "./bookStructure";

/**
 * Analysis pipeline version. Bump this whenever chapter, entity, or embedding
 * generation changes in a way that makes older derived data untrustworthy.
 * Books stored below this version are treated as stale and rebuilt in the
 * background; the PDF and extracted pages are never touched.
 */
export const BOOK_BRAIN_VERSION = 4;

/** An older completed analysis is stale even if all of its old passes finished. */
export function needsBookBrainRebuild(analysisVersion: number | null | undefined, passCompleted: number | null | undefined): boolean {
  return (passCompleted ?? 0) < 4 || (analysisVersion ?? 0) < BOOK_BRAIN_VERSION;
}

/** A staged v4 job must continue from its saved stage, never delete its own partial work. */
export function shouldInitialiseBookBrainStage(
  pipelineVersion: number | null | undefined,
  pipelineStage: string | null | undefined,
): boolean {
  return pipelineVersion !== BOOK_BRAIN_VERSION || pipelineStage === "idle" || !pipelineStage;
}

/** Provider limits are operational pauses, not failed book analysis. Keep staged evidence intact. */
export function isProviderAvailabilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /usage exhausted|rate limit|too many requests|api error 412|provider unavailable/i.test(message);
}

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
 * Ask a cheap model to classify ambiguous heading candidates. Only the candidate
 * lines and their page numbers are sent — never the book text.
 */
async function validateHeadingCandidates(candidates: HeadingCandidate[]): Promise<HeadingCandidate[]> {
  const listed = candidates
    .slice(0, 120)
    .map((candidate, index) => `${index}. p.${candidate.pageNumber}: ${candidate.line}`)
    .join("\n");

  const prompt = `These lines were taken from the top of pages in a book. Classify each one.

Valid labels: "chapter" (a real chapter or part boundary), "section" (a subheading inside a chapter), "running_header" (a repeated header or the book title), "front_matter" (contents, dedication, copyright), "uncertain".

Return ONLY a JSON array like [{"i":0,"label":"chapter"}, ...].

LINES:
${listed}`;

  const res = await llmCall("chunk_analysis", {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 1200,
  });

  const labels = parseJson(res.text, [] as { i: number; label: string }[]);
  if (!Array.isArray(labels) || labels.length === 0) return candidates;

  const keep = new Set(
    labels.filter(item => item.label === "chapter" || item.label === "front_matter").map(item => item.i),
  );
  const filtered = candidates.filter((_, index) => keep.has(index));
  return filtered.length >= 3 ? filtered : candidates;
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
  analysisVersion: number,
): Promise<{
  chapterSummaries: {
    chapter: number;
    title: string;
    summary: string;
    startPage: number;
    endPage: number;
    authorDefined: boolean;
  }[];
  structure: BookStructure;
}> {
  // Clear any existing chunks (idempotent retry)
  await db.deleteBookChunks(bookId, analysisVersion);

  const book = await db.getBookById(bookId);
  const structure: BookStructure = await resolveBookStructure(pages, {
    outline: (book?.pdfOutline as { title: string; page: number; level: number }[] | null) ?? undefined,
    bookTitle: book?.title ?? null,
    validate: validateHeadingCandidates,
  });

  const pageByNumber = new Map(pages.map(page => [page.pageNumber, page]));
  const chapterSummaries: {
    chapter: number;
    title: string;
    summary: string;
    startPage: number;
    endPage: number;
    authorDefined: boolean;
  }[] = [];
  const entityEvidence = new Map<
    string,
    { name: string; type: string; pages: Set<number>; relationships: { name: string; relation: string; page: number }[] }
  >();

  for (const section of structure.sections) {
    const sectionPages: { pageNumber: number; content: string }[] = [];
    for (let pageNumber = section.startPage; pageNumber <= section.endPage; pageNumber++) {
      const page = pageByNumber.get(pageNumber);
      if (page) sectionPages.push(page);
    }
    if (sectionPages.length === 0) continue;

    const chunks = chunkPages(sectionPages);
    const chunkSummaries: string[] = [];

    for (let seq = 0; seq < chunks.length; seq++) {
      const chunk = chunks[seq]!;
      const chunkText = chunk.map(p => `[Page ${p.pageNumber}]\n${p.content}`).join("\n\n");
      const startPage = chunk[0]!.pageNumber;
      const endPage = chunk[chunk.length - 1]!.pageNumber;

      const prompt = `Analyze this book section (pages ${startPage}–${endPage}) and return ONLY valid JSON:
{
  "summary": "2-3 sentence summary of what happens/is argued in this section",
  "entities": [
    {
      "name": "person/place/concept name",
      "type": "person|place|concept|term|other",
      "pages": [page numbers where it appears, taken from the [Page N] markers],
      "relationships": [{"name": "other entity", "relation": "short description", "page": page number}]
    }
  ],
  "concepts": ["main idea or theme", ...],
  "keyPassages": [{"text": "short quote (max 120 chars)", "reason": "why it matters"}, ...]
}

Rules: entities max 10, concepts max 5, keyPassages max 3, be specific not generic.
Every page number MUST come from the [Page N] markers in the text below. Never guess a page number.

TEXT:
${chunkText}`;

      const res = await llmCall("chunk_analysis", {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1100,
      });

      const analysis = parseJson(res.text, {
        summary: "",
        entities: [] as ChunkEntity[],
        concepts: [] as string[],
        keyPassages: [] as { text: string; reason: string }[],
      });

      const validPages = new Set(chunk.map(p => p.pageNumber));
      const chunkEntities = normalizeChunkEntities(analysis.entities, validPages);

      // Store chunk in DB
      await db.insertBookChunk({
        bookId,
        chapterNumber: section.index - 1,
        chunkSequence: seq,
        startPage,
        endPage,
        text: chunkText,
        summary: analysis.summary,
        entities: chunkEntities.map(entity => entity.name),
        concepts: analysis.concepts,
        keyPassages: analysis.keyPassages,
        analysisVersion,
      });

      chunkSummaries.push(analysis.summary);
      mergeEntityEvidence(entityEvidence, chunkEntities);
    }

    // Synthesize chunk summaries into a chapter summary
    let chapterSummary = chunkSummaries.join(" ");
    if (chunkSummaries.length > 1) {
      const unitWord = section.authorDefined ? "chapter" : "reading section";
      const synthPrompt = `Combine these part summaries from a single ${unitWord} into one coherent paragraph (3-4 sentences):

${chunkSummaries.map((s, i) => `Section ${i + 1}: ${s}`).join("\n")}

Write a single paragraph that captures the key events, arguments, and significance.`;

      const synthRes = await llmCall("chapter_synthesis", {
        messages: [{ role: "user", content: synthPrompt }],
        temperature: 0.3,
        max_tokens: 250,
      });
      chapterSummary = synthRes.text.trim();
    }

    chapterSummaries.push({
      chapter: section.index,
      title: section.title,
      summary: chapterSummary,
      startPage: section.startPage,
      endPage: section.endPage,
      authorDefined: section.authorDefined,
    });
  }

  // Persist entity page evidence now, while we still have per-chunk page markers.
  await db.deleteBookEntities(bookId, analysisVersion);
  const aggregated = Array.from(entityEvidence.values())
    .filter(entity => entity.name.length > 1)
    .sort((a, b) => b.pages.size - a.pages.size)
    .slice(0, 60);
  if (aggregated.length > 0) {
    await db.insertBookEntities(
      aggregated.map(entity => ({
        bookId,
        type: entity.type as "person" | "place" | "concept" | "term" | "other",
        name: entity.name.slice(0, 255),
        description: "",
        pages: Array.from(entity.pages).sort((a, b) => a - b),
        relationships: dedupeRelationships(entity.relationships),
        analysisVersion,
      })),
    );
  }

  return { chapterSummaries, structure };
}

type ChunkEntity = {
  name?: unknown;
  type?: unknown;
  pages?: unknown;
  relationships?: unknown;
};

const ENTITY_TYPES = new Set(["person", "place", "concept", "term", "other"]);

/** Normalize a name so aliases with different spacing/case merge safely. */
export function normalizeEntityKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase().replace(/^(the|a|an)\s+/, "");
}

/**
 * Accept only page numbers that actually exist in the analyzed chunk. This is
 * what stops the model from inventing a page and turning Who? into a fake fact.
 */
export function normalizeChunkEntities(
  raw: unknown,
  validPages: Set<number>,
): { name: string; type: string; pages: number[]; relationships: { name: string; relation: string; page: number }[] }[] {
  if (!Array.isArray(raw)) return [];
  const result: { name: string; type: string; pages: number[]; relationships: { name: string; relation: string; page: number }[] }[] = [];

  for (const rawItem of raw as unknown[]) {
    // Tolerate the older shape where entities were plain strings.
    if (typeof rawItem === "string") {
      const name = rawItem.replace(/\s+/g, " ").trim();
      if (name) result.push({ name, type: "other", pages: [], relationships: [] });
      continue;
    }
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as ChunkEntity;
    const name = typeof item.name === "string" ? item.name.replace(/\s+/g, " ").trim() : "";
    if (!name) continue;
    const type = typeof item.type === "string" && ENTITY_TYPES.has(item.type) ? item.type : "other";
    const pages = Array.isArray(item.pages)
      ? Array.from(
          new Set(
            item.pages
              .map(page => (typeof page === "number" ? page : Number(page)))
              .filter(page => Number.isInteger(page) && validPages.has(page)),
          ),
        ).sort((a, b) => a - b)
      : [];
    const relationships = Array.isArray(item.relationships)
      ? (item.relationships as { name?: unknown; relation?: unknown; page?: unknown }[])
          .map(rel => ({
            name: typeof rel?.name === "string" ? rel.name.replace(/\s+/g, " ").trim() : "",
            relation: typeof rel?.relation === "string" ? rel.relation.trim().slice(0, 160) : "",
            page: typeof rel?.page === "number" ? rel.page : Number(rel?.page),
          }))
          .filter(rel => rel.name && rel.relation && Number.isInteger(rel.page) && validPages.has(rel.page))
      : [];
    result.push({ name, type, pages, relationships });
  }
  return result;
}

function mergeEntityEvidence(
  store: Map<string, { name: string; type: string; pages: Set<number>; relationships: { name: string; relation: string; page: number }[] }>,
  entities: { name: string; type: string; pages: number[]; relationships: { name: string; relation: string; page: number }[] }[],
) {
  for (const entity of entities) {
    const key = normalizeEntityKey(entity.name);
    if (!key) continue;
    const existing = store.get(key);
    if (existing) {
      entity.pages.forEach(page => existing.pages.add(page));
      existing.relationships.push(...entity.relationships);
      // Prefer the longer surface form ("Elizabeth Bennet" over "Elizabeth").
      if (entity.name.length > existing.name.length) existing.name = entity.name;
      if (existing.type === "other" && entity.type !== "other") existing.type = entity.type;
    } else {
      store.set(key, {
        name: entity.name,
        type: entity.type,
        pages: new Set(entity.pages),
        relationships: [...entity.relationships],
      });
    }
  }
}

function dedupeRelationships(relationships: { name: string; relation: string; page: number }[]) {
  const seen = new Set<string>();
  const result: { name: string; relation: string; page: number }[] = [];
  for (const rel of relationships.sort((a, b) => a.page - b.page)) {
    const key = `${normalizeEntityKey(rel.name)}|${rel.relation.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(rel);
    if (result.length >= 12) break;
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Pass 3 — Whole-Book Synthesis                                            */
/* -------------------------------------------------------------------------- */

async function runPass3(
  bookId: number,
  chapters: { chapter: number; title: string; summary: string; startPage: number; endPage: number; authorDefined: boolean }[],
  analysisVersion: number,
): Promise<{ overallSummary: string; themes: string[]; timeline: { event: string; page: number }[] }> {

  if (chapters.length === 0) return { overallSummary: "", themes: [], timeline: [] };

  // Synthesize all chapter summaries into a whole-book brain
  const chapterList = chapters
    .map(c => `${c.authorDefined ? `Chapter ${c.chapter}` : `Reading section ${c.chapter}`} (starts p.${c.startPage}): ${c.summary}`)
    .join("\n\n");

  const prompt = `You have read a complete book. Here is a summary of every author-defined chapter or synthetic reading section:

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
  // Pass 2 already stored entities WITH page evidence. Pass 3 only adds a short
  // description; it must never overwrite or discard the page evidence.
  const storedEntities = await db.getBookEntities(bookId, analysisVersion);
  const describable = storedEntities.slice(0, 40);

  if (describable.length > 0) {
    const entityPrompt = `Based on this book (summary: ${synthesis.overallSummary}), describe these entities:
${describable.map(entity => entity.name).join(", ")}

Return ONLY valid JSON array:
[{"name": "...", "type": "person|place|concept|term|other", "description": "1-2 sentence description"}, ...]`;

    const entityRes = await llmCall("book_synthesis", {
      messages: [{ role: "user", content: entityPrompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const entities = parseJson(entityRes.text, [] as { name: string; type: string; description: string }[]);
    if (Array.isArray(entities) && entities.length > 0) {
      const describedByKey = new Map(
        entities
          .filter(entity => typeof entity?.name === "string")
          .map(entity => [normalizeEntityKey(String(entity.name)), entity]),
      );
      for (const stored of describable) {
        const described = describedByKey.get(normalizeEntityKey(stored.name));
        if (!described?.description) continue;
        await db.updateBookEntityDescription(stored.id, String(described.description).slice(0, 1000));
      }
    }
  }

  return {
    overallSummary: synthesis.overallSummary,
    themes: synthesis.themes,
    timeline: synthesis.timeline.map((t: { event: string; chapter: number }) => ({ event: t.event, page: t.chapter })),
  };
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

async function runPass4(bookId: number, analysisVersion: number): Promise<void> {
  // Clear old embeddings and retrieval passages (idempotent)
  await db.deleteBookEmbeddings(bookId, analysisVersion);
  await db.deleteRetrievalPassages(bookId, analysisVersion);

  const chunks = await db.getBookChunks(bookId, analysisVersion);

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
        analysisVersion,
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
        analysisVersion,
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
        analysisVersion,
      });
    }
  }

}

/* -------------------------------------------------------------------------- */
/*  Resumable Book Brain — bounded background work                            */
/* -------------------------------------------------------------------------- */

type StagedStructure = {
  source: "outline" | "detected" | "synthetic";
  confidence: number;
  sections: BookSection[];
  chapterSummaries?: { chapter: number; title: string; summary: string; startPage: number; endPage: number; authorDefined: boolean }[];
  synthesis?: { overallSummary: string; themes: string[]; timeline: { event: string; page: number }[] };
};

const CHUNKS_PER_BACKGROUND_RUN = 3;
const CHUNK_EMBEDDINGS_PER_BACKGROUND_RUN = 8;
const PASSAGE_EMBEDDINGS_PER_BACKGROUND_RUN = 16;

function makeChunkPrompt(chunkText: string, startPage: number, endPage: number) {
  return `Analyze this book section (pages ${startPage}–${endPage}) and return ONLY valid JSON:
{"summary":"2-3 sentence summary", "entities":[{"name":"name","type":"person|place|concept|term|other","pages":[page numbers from markers],"relationships":[{"name":"name","relation":"short relation","page":page number}]}],"concepts":["main idea"],"keyPassages":[{"text":"short quote","reason":"why it matters"}]}
Rules: max 10 entities, max 5 concepts, max 3 passages. Every page number MUST come from [Page N] markers. Never guess.
TEXT:
${chunkText}`;
}

async function initialiseStagedPipeline(bookId: number, pages: { pageNumber: number; content: string }[]) {
  const book = await db.getBookById(bookId);
  const structure = await resolveBookStructure(pages, {
    outline: (book?.pdfOutline as { title: string; page: number; level: number }[] | null) ?? undefined,
    bookTitle: book?.title ?? null,
    validate: validateHeadingCandidates,
  });
  const stagedChunks = createStagedChunks(bookId, pages, structure.sections);
  await db.deleteBookChunks(bookId, BOOK_BRAIN_VERSION);
  await db.deleteBookEntities(bookId, BOOK_BRAIN_VERSION);
  await db.deleteBookEmbeddings(bookId, BOOK_BRAIN_VERSION);
  await db.deleteRetrievalPassages(bookId, BOOK_BRAIN_VERSION);
  await db.insertBookChunks(stagedChunks);
  await db.updateBookBrain(bookId, {
    pipelineVersion: BOOK_BRAIN_VERSION,
    pipelineStage: "chunks",
    stagedStructure: { source: structure.source, confidence: structure.confidence, sections: structure.sections },
  });
}

export function createStagedChunks(
  bookId: number,
  pages: { pageNumber: number; content: string }[],
  sections: BookSection[],
) {
  const pageByNumber = new Map(pages.map(page => [page.pageNumber, page]));
  const stagedChunks: Parameters<typeof db.insertBookChunk>[0][] = [];
  for (const section of sections) {
    const sectionPages = Array.from({ length: section.endPage - section.startPage + 1 }, (_, i) => pageByNumber.get(section.startPage + i)).filter((page): page is { pageNumber: number; content: string } => Boolean(page));
    const sectionChunks = chunkPages(sectionPages);
    for (let chunkSequence = 0; chunkSequence < sectionChunks.length; chunkSequence++) {
      const chunk = sectionChunks[chunkSequence]!;
      if (!chunk.length) continue;
      stagedChunks.push({
        bookId, chapterNumber: section.index - 1, chunkSequence,
        startPage: chunk[0]!.pageNumber, endPage: chunk[chunk.length - 1]!.pageNumber,
        text: chunk.map(page => `[Page ${page.pageNumber}]\n${page.content}`).join("\n\n"),
        summary: null, entities: null, entityEvidence: null, concepts: null, keyPassages: null,
        analysisVersion: BOOK_BRAIN_VERSION,
      });
    }
  }
  return stagedChunks;
}

async function processChunkBatch(bookId: number) {
  const work = await db.getProcessableBookChunks(bookId, BOOK_BRAIN_VERSION, CHUNKS_PER_BACKGROUND_RUN);
  for (const chunk of work) {
    await db.updateBookChunkAnalysis(chunk.id, { status: "processing", incrementAttempts: true });
    try {
      const response = await llmCall("chunk_analysis", { messages: [{ role: "user", content: makeChunkPrompt(chunk.text, chunk.startPage, chunk.endPage) }], temperature: 0.3, max_tokens: 1100 });
      const analysis = parseJson(response.text, { summary: "", entities: [] as ChunkEntity[], concepts: [] as string[], keyPassages: [] as { text: string; reason: string }[] });
      const validPages = new Set(Array.from({ length: chunk.endPage - chunk.startPage + 1 }, (_, i) => chunk.startPage + i));
      const entityEvidence = normalizeChunkEntities(analysis.entities, validPages);
      await db.updateBookChunkAnalysis(chunk.id, { summary: analysis.summary, entities: entityEvidence.map(entity => entity.name), entityEvidence, concepts: analysis.concepts, keyPassages: analysis.keyPassages, status: "done" });
    } catch (error) {
      if (isProviderAvailabilityError(error)) {
        await db.updateBookChunkAnalysis(chunk.id, { status: "pending", lastError: "AI provider temporarily unavailable; staged work is preserved." });
        throw error;
      }
      await db.updateBookChunkAnalysis(chunk.id, { status: "failed", lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000) });
    }
  }
  return (await db.getProcessableBookChunks(bookId, BOOK_BRAIN_VERSION, 1)).length === 0;
}

async function synthesizeStagedBook(bookId: number, staged: StagedStructure) {
  const chunks = await db.getBookChunks(bookId, BOOK_BRAIN_VERSION);
  if (chunks.some(chunk => chunk.status !== "done")) return false;
  const chapterSummaries = staged.sections.map(section => ({
    chapter: section.index, title: section.title,
    summary: chunks.filter(chunk => chunk.chapterNumber === section.index - 1).map(chunk => chunk.summary ?? "").filter(Boolean).join(" ").slice(0, 2600),
    startPage: section.startPage, endPage: section.endPage, authorDefined: section.authorDefined,
  }));
  const entityStore = new Map<string, { name: string; type: string; pages: Set<number>; relationships: { name: string; relation: string; page: number }[] }>();
  for (const chunk of chunks) mergeEntityEvidence(entityStore, (chunk.entityEvidence as Parameters<typeof mergeEntityEvidence>[1]) ?? []);
  await db.deleteBookEntities(bookId, BOOK_BRAIN_VERSION);
  const entities = Array.from(entityStore.values()).filter(entity => entity.name.length > 1).slice(0, 60);
  if (entities.length) await db.insertBookEntities(entities.map(entity => ({ bookId, type: entity.type as "person" | "place" | "concept" | "term" | "other", name: entity.name.slice(0, 255), description: "", pages: Array.from(entity.pages).sort((a, b) => a - b), relationships: dedupeRelationships(entity.relationships), analysisVersion: BOOK_BRAIN_VERSION })));
  const synthesis = await runPass3(bookId, chapterSummaries, BOOK_BRAIN_VERSION);
  await db.updateBookBrain(bookId, { pipelineStage: "embeddings", stagedStructure: { ...staged, chapterSummaries, synthesis } });
  return true;
}

async function embedStagedBatch(bookId: number, staged: StagedStructure) {
  const chunks = await db.getBookChunks(bookId, BOOK_BRAIN_VERSION);
  const embeddedChunkIds = new Set((await db.getBookEmbeddingsForVersion(bookId, BOOK_BRAIN_VERSION)).map(row => row.chunkId));
  for (const chunk of chunks.filter(chunk => !embeddedChunkIds.has(chunk.id)).slice(0, CHUNK_EMBEDDINGS_PER_BACKGROUND_RUN)) {
    const text = [`Section ${(chunk.chapterNumber ?? 0) + 1}`, chunk.summary ?? "", ((chunk.entities as string[] | null) ?? []).join(", "), ((chunk.concepts as string[] | null) ?? []).join(", "), chunk.text.slice(0, 2000)].filter(Boolean).join("\n");
    const result = await llmEmbedWithMeta(text);
    await db.insertBookEmbedding({ bookId, chunkId: chunk.id, embedding: result.embedding, metadata: { startPage: chunk.startPage, endPage: chunk.endPage, chapterNumber: chunk.chapterNumber, chunkSequence: chunk.chunkSequence, embeddingProvider: result.provider, embeddingModel: result.model, embeddingDimensions: result.dimensions }, analysisVersion: BOOK_BRAIN_VERSION });
  }
  if ((await db.getRetrievalPassages(bookId, BOOK_BRAIN_VERSION)).length === 0) {
    const pages = await db.getAllPagesForBook(bookId);
    await db.insertRetrievalPassages(createRetrievalPassages(pages).map(passage => ({ bookId, startPage: passage.startPage, endPage: passage.endPage, text: passage.text.slice(0, 8000), embedding: null, analysisVersion: BOOK_BRAIN_VERSION })));
  }
  for (const passage of await db.getUnembeddedRetrievalPassages(bookId, BOOK_BRAIN_VERSION, PASSAGE_EMBEDDINGS_PER_BACKGROUND_RUN)) {
    const result = await llmEmbedWithMeta(passage.text.slice(0, 3200));
    await db.updateRetrievalPassageEmbedding(passage.id, result.embedding);
  }
  const chunksComplete = (await db.getBookEmbeddingsForVersion(bookId, BOOK_BRAIN_VERSION)).length >= chunks.length;
  const passagePending = (await db.getUnembeddedRetrievalPassages(bookId, BOOK_BRAIN_VERSION, 1)).length > 0;
  if (!chunksComplete || passagePending) return false;
  await db.updateBookBrain(bookId, {
    chapterSummaries: staged.chapterSummaries ?? [], structureSource: staged.source, structureConfidence: Math.round(staged.confidence * 100),
    overallSummary: staged.synthesis?.overallSummary ?? "", themes: staged.synthesis?.themes ?? [], timeline: staged.synthesis?.timeline ?? [],
    analysisVersion: BOOK_BRAIN_VERSION, passCompleted: 4, pipelineStage: "complete", stagedStructure: null,
  });
  return true;
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

  const current = await db.getBookBrain(bookId);
  if (!needsBookBrainRebuild(current?.analysisVersion, current?.passCompleted)) {
    return { passCompleted: 4, skipped: true };
  }
  if (!(await db.acquireBookBrainLease(bookId))) {
    return { passCompleted: current?.passCompleted ?? 1, skipped: true };
  }

  try {
    await db.resetInterruptedBookChunks(bookId, BOOK_BRAIN_VERSION);
    const brain = await db.getBookBrain(bookId);
    if (!brain || shouldInitialiseBookBrainStage(brain.pipelineVersion, brain.pipelineStage)) {
      await initialiseStagedPipeline(bookId, pages);
      return { passCompleted: brain?.passCompleted ?? 1, skipped: false };
    }
    const staged = brain.stagedStructure as StagedStructure | null;
    if (!staged || brain.pipelineStage === "failed") return { passCompleted: brain.passCompleted, skipped: true };

    if (brain.pipelineStage === "chunks") {
      const stagedChunks = await db.getBookChunks(bookId, BOOK_BRAIN_VERSION);
      if (stagedChunks.length === 0) {
        await initialiseStagedPipeline(bookId, pages);
        return { passCompleted: brain.passCompleted, skipped: false };
      }
      const chunksComplete = await processChunkBatch(bookId);
      if (chunksComplete) await db.updateBookBrain(bookId, { pipelineStage: "synthesis" });
      return { passCompleted: brain.passCompleted, skipped: false };
    }
    if (brain.pipelineStage === "synthesis") {
      await synthesizeStagedBook(bookId, staged);
      return { passCompleted: brain.passCompleted, skipped: false };
    }
    if (brain.pipelineStage === "embeddings") {
      const complete = await embedStagedBatch(bookId, staged);
      return { passCompleted: complete ? 4 : brain.passCompleted, skipped: false };
    }
    return { passCompleted: brain.passCompleted, skipped: true };
  } catch (error) {
    if (isProviderAvailabilityError(error)) {
      await db.updateBookBrain(bookId, {
        pipelineStage: "paused",
        pipelineError: "AI provider temporarily unavailable. Your book and completed analysis are safe; staged processing can resume later.",
      });
      return { passCompleted: current?.passCompleted ?? 1, skipped: false };
    }
    throw error;
  } finally {
    await db.releaseBookBrainLease(bookId);
  }
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
  /** Where chapter structure came from; drives whether chapter claims are allowed. */
  structureSource: "outline" | "detected" | "synthetic" | null;
  /** True only when the AI may say "Chapter N" as a fact. */
  chapterClaimsAllowed: boolean;
  /** Fine-grained retrieval passages (the evidence the answer must cite). */
  evidencePassages: string;
  /** Page numbers legitimately available for citation. */
  allowedPages: number[];
  /** Entity cards limited to what the reader has actually reached. */
  entityEvidence: {
    name: string;
    type: string;
    description: string;
    firstSeen: number | null;
    lastSeen: number | null;
    relationships: { name: string; relation: string; page?: number }[];
  }[];
}

/** How many fine-grained passages to send as evidence. */
const EVIDENCE_PASSAGE_LIMIT = 6;

/**
 * Keyword overlap score, used to boost semantic hits. Cheap, and it rescues
 * exact-name questions ("who is Shawn?") where pure vectors can drift.
 */
function keywordOverlap(query: string, text: string): number {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .filter(term => term.length >= 4),
    ),
  );
  if (terms.length === 0) return 0;
  const haystack = text.toLowerCase();
  const hits = terms.filter(term => haystack.includes(term)).length;
  return hits / terms.length;
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
  const activeAnalysisVersion = brain?.analysisVersion ?? 1;
  const structureSource = (brain?.structureSource ?? null) as BrainContext["structureSource"];
  const chapterClaimsAllowed = canMakeChapterClaims({
    source: structureSource ?? "synthetic",
    confidence: (brain?.structureConfidence ?? 0) / 100,
  });

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
      structureSource,
      chapterClaimsAllowed: false,
      evidencePassages: "",
      allowedPages: [],
      entityEvidence: [],
    };
  }

  // Spoiler mode: in "safe" mode, only use information up to the current page.
  const pageLimit = spoilerMode === "safe" ? currentPage : Infinity;

  // Chapter context: find the chapter the reader is currently in.
  const chapters = ((brain?.chapterSummaries ?? []) as {
    chapter: number; title: string; summary: string; startPage: number; endPage?: number; authorDefined?: boolean;
  }[]).filter(c => spoilerMode === "full" || c.startPage <= pageLimit);

  const currentChapter = [...chapters].reverse().find(c => c.startPage <= currentPage);
  // Structural honesty: only call it a chapter when it genuinely is one.
  const chapterContext = currentChapter
    ? (() => {
        const authorDefined = currentChapter.authorDefined ?? chapterClaimsAllowed;
        const label = authorDefined
          ? `Chapter ${currentChapter.chapter} — "${currentChapter.title}"`
          : `Earlier in the book (reading section ${currentChapter.chapter}, not an author-defined chapter)`;
        return `${label}: ${currentChapter.summary}`;
      })()
    : null;

  // Entity evidence — in safe mode, both the entity AND its page evidence are
  // clipped to what the reader has reached.
  const entities = await db.getBookEntities(bookId, activeAnalysisVersion);
  const entityEvidence = entities
    .map(entity => {
      const pages = ((entity.pages as number[] | null) ?? []).filter(
        page => spoilerMode === "full" || page <= pageLimit,
      );
      const relationships = (((entity.relationships ?? []) as { name: string; relation: string; page?: number }[]) ?? [])
        .filter(rel => spoilerMode === "full" || rel.page === undefined || rel.page <= pageLimit);
      return {
        name: entity.name,
        type: entity.type as string,
        description: entity.description ?? "",
        firstSeen: pages.length > 0 ? Math.min(...pages) : null,
        lastSeen: pages.length > 0 ? Math.max(...pages) : null,
        relationships,
        seenPages: pages,
      };
    })
    // In safe mode an entity with no reached pages has not been met yet.
    .filter(entity => spoilerMode === "full" || entity.seenPages.length > 0)
    .map(({ seenPages, ...entity }) => entity);

  const relevantEntities = entityEvidence
    .slice(0, 15)
    .map(entity => {
      const seen =
        entity.firstSeen !== null
          ? ` (first seen p.${entity.firstSeen}${entity.lastSeen && entity.lastSeen !== entity.firstSeen ? `, most recently p.${entity.lastSeen}` : ""})`
          : " (no confirmed page evidence yet)";
      return `• ${entity.name} (${entity.type})${seen}: ${entity.description}`;
    })
    .join("\n");

  // Key passages nearby (proximity-based fallback)
  const keyPassagesNearby = ((brain?.keyPassages ?? []) as { page: number; text: string; reason: string }[])
    .filter(p => (spoilerMode === "safe" ? p.page <= pageLimit : true) && Math.abs(p.page - currentPage) <= 15)
    .slice(0, 3)
    .map(p => `[p.${p.page}] "${p.text}" — ${p.reason}`)
    .join("\n");

  /* -- Fine-grained evidence retrieval -----------------------------------
   * Analysis chunks are for understanding; retrieval passages are for evidence.
   * The live path searches the passages, which is what makes citations exact.
   */
  let evidencePassages = "";
  const allowedPages = new Set<number>();
  if (queryText && passCompleted >= 2) {
    try {
      const passages = await db.getRetrievalPassages(bookId, activeAnalysisVersion);
      const eligible = passages.filter(passage =>
        spoilerMode === "full" ? true : passage.endPage <= pageLimit,
      );

      if (eligible.length > 0) {
        let scored: { passage: (typeof eligible)[number]; score: number }[] = [];
        const withVectors = eligible.filter(passage => Array.isArray(passage.embedding));

        if (withVectors.length > 0) {
          const queryEmbedding = (await llmEmbedWithMeta(queryText)).embedding;
          scored = withVectors.map(passage => {
            const similarity = cosineSimilarity(queryEmbedding, (passage.embedding as number[]) ?? []);
            // Hybrid: vectors lead, keywords break ties and rescue exact names.
            return { passage, score: similarity + 0.15 * keywordOverlap(queryText, passage.text) };
          });
        } else {
          // No vectors yet (brain still building): keyword + proximity fallback.
          scored = eligible.map(passage => ({
            passage,
            score:
              keywordOverlap(queryText, passage.text) +
              0.2 / (1 + Math.abs(passage.endPage - currentPage)),
          }));
        }

        const top = scored
          .sort((a, b) => b.score - a.score)
          .filter(entry => entry.score > 0)
          .slice(0, EVIDENCE_PASSAGE_LIMIT);

        evidencePassages = top
          .map(({ passage }) => {
            for (let page = passage.startPage; page <= passage.endPage; page++) allowedPages.add(page);
            const label = passage.startPage === passage.endPage
              ? `[p.${passage.startPage}]`
              : `[pp.${passage.startPage}–${passage.endPage}]`;
            return `${label}\n${passage.text.slice(0, 1800)}`;
          })
          .join("\n\n---\n\n");
      }
    } catch (err) {
      console.warn("[bookBrain] passage retrieval failed:", err);
    }
  }

  // Semantic retrieval: find the most relevant chunks from anywhere in the book
  let semanticChunks = "";
  if (queryText && brainReady) {
    try {
      const queryEmbResult = await llmEmbedWithMeta(queryText);
      const queryEmbedding = queryEmbResult.embedding;
      const embeddings = await db.getBookEmbeddings(bookId, activeAnalysisVersion);

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
            if (meta) {
              for (let page = meta.startPage; page <= meta.endPage; page++) allowedPages.add(page);
            }
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
    structureSource,
    chapterClaimsAllowed,
    evidencePassages,
    allowedPages: Array.from(allowedPages).sort((a, b) => a - b),
    entityEvidence,
  };
}
