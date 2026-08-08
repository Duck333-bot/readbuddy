/**
 * Book Brain — 4-pass background analysis pipeline.
 *
 * Pass 1 — text extraction (done synchronously at upload, not here)
 * Pass 2 — structure: chapter summaries, overall summary, themes, timeline
 * Pass 3 — entities: people, places, concepts, terminology, relationships
 * Pass 4 — deep reading: key passages, metaphors, foreshadowing, connections
 *
 * Each pass is idempotent: if the job is retried, it re-runs only the passes
 * that have not yet been marked complete on the bookBrain row.
 *
 * The pipeline is triggered by a Heartbeat cron job created at upload time.
 * The handler is mounted at /api/scheduled/bookBrain in server/_core/index.ts.
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";

/** Extract the first text choice from an InvokeResult. */
function extractText(result: Awaited<ReturnType<typeof invokeLLM>>): string {
  const content = result.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const first = content.find((c): c is { type: "text"; text: string } => c.type === "text");
    return first?.text ?? "";
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Concatenate all page text for the book, respecting the spoiler-mode page
 *  limit when provided. Returns a string of at most ~80 000 chars to stay
 *  within a reasonable context window. */
function buildFullText(
  pages: { pageNumber: number; content: string }[],
  maxPage?: number,
): string {
  const filtered = maxPage ? pages.filter(p => p.pageNumber <= maxPage) : pages;
  const raw = filtered.map(p => `[Page ${p.pageNumber}]\n${p.content}`).join("\n\n");
  // Hard cap at ~80 k chars (~20 k tokens) to keep LLM calls fast and cheap.
  return raw.slice(0, 80_000);
}

/** Parse JSON from an LLM response that may be wrapped in a markdown fence. */
function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/*  Pass 2 — Structure                                                        */
/* -------------------------------------------------------------------------- */

async function runPass2(bookId: number, fullText: string) {
  const structurePrompt = `You are a literary analyst. Analyse the following book text and return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "overallSummary": "2-3 sentence summary of the whole book",
  "themes": ["theme1", "theme2", ...],
  "timeline": [{"event": "...", "page": 1}, ...],
  "chapterSummaries": [
    {"chapter": 1, "title": "Chapter title or 'Chapter 1'", "summary": "...", "startPage": 1},
    ...
  ]
}

Rules:
- themes: 3-7 main themes as short phrases
- timeline: up to 15 key events in chronological order with the page they first appear
- chapterSummaries: one entry per detected chapter (max 20), each summary 1-2 sentences
- Keep all text concise and factual

BOOK TEXT:
${fullText.slice(0, 60_000)}`;

  const rawResult2 = await invokeLLM({ messages: [{ role: "user", content: structurePrompt }], model: "gpt-4o-mini", max_tokens: 2000 });
  const raw2 = extractText(rawResult2);

  type StructureResult = {
    overallSummary?: string;
    themes?: string[];
    timeline?: { event: string; page: number }[];
    chapterSummaries?: { chapter: number; title: string; summary: string; startPage: number }[];
  };

  const parsed = parseJson<StructureResult>(raw2, {});

  await db.upsertBookBrain(bookId, {
    passCompleted: 2,
    overallSummary: parsed.overallSummary ?? null,
    themes: parsed.themes ?? [],
    timeline: parsed.timeline ?? [],
    chapterSummaries: parsed.chapterSummaries ?? [],
  });
}

/* -------------------------------------------------------------------------- */
/*  Pass 3 — Entities                                                         */
/* -------------------------------------------------------------------------- */

async function runPass3(bookId: number, fullText: string) {
  const entityPrompt = `You are a literary analyst. Extract all significant entities from the following book text and return ONLY valid JSON (no markdown fences) with this exact shape:
[
  {
    "type": "person" | "place" | "concept" | "term" | "other",
    "name": "Entity name",
    "description": "1-2 sentence description",
    "pages": [1, 5, 12],
    "relationships": [{"name": "Other entity", "relation": "description of relationship"}]
  },
  ...
]

Rules:
- Include: major characters, key locations, important concepts, recurring terminology
- Exclude: minor mentions, common words
- Maximum 40 entities
- pages: list up to 5 page numbers where the entity appears
- relationships: up to 3 relationships per entity, omit if none

BOOK TEXT:
${fullText.slice(0, 60_000)}`;

  const rawResult3 = await invokeLLM({ messages: [{ role: "user", content: entityPrompt }], model: "gpt-4o-mini", max_tokens: 3000 });
  const raw3 = extractText(rawResult3);

  type EntityResult = {
    type: "person" | "place" | "concept" | "term" | "other";
    name: string;
    description: string;
    pages?: number[];
    relationships?: { name: string; relation: string }[];
  };

  const parsed = parseJson<EntityResult[]>(raw3, []);

  // Clear old entities before inserting fresh ones (idempotent).
  await db.deleteBookEntities(bookId);
  if (Array.isArray(parsed) && parsed.length > 0) {
    await db.insertBookEntities(
      parsed.slice(0, 40).map(e => ({
        bookId,
        type: e.type ?? "other",
        name: String(e.name ?? "").slice(0, 255),
        description: String(e.description ?? ""),
        pages: Array.isArray(e.pages) ? e.pages : [],
        relationships: Array.isArray(e.relationships) ? e.relationships : [],
      })),
    );
  }

  await db.updateBookBrain(bookId, { passCompleted: 3 });
}

/* -------------------------------------------------------------------------- */
/*  Pass 4 — Deep reading                                                     */
/* -------------------------------------------------------------------------- */

async function runPass4(bookId: number, fullText: string) {
  const deepPrompt = `You are a literary analyst. Perform a deep reading of the following book text and return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "keyPassages": [
    {"page": 1, "text": "exact quote (max 150 chars)", "reason": "why this passage matters"}
  ],
  "connections": [
    {"fromPage": 1, "toPage": 20, "description": "how these two parts connect"}
  ]
}

Rules:
- keyPassages: up to 15 passages — include important, difficult, metaphorical, or foreshadowing moments
- connections: up to 10 cross-chapter/cross-page thematic or narrative connections
- Be specific and insightful, not generic

BOOK TEXT:
${fullText.slice(0, 60_000)}`;

  const rawResult4 = await invokeLLM({ messages: [{ role: "user", content: deepPrompt }], model: "gpt-4o-mini", max_tokens: 2000 });
  const raw4 = extractText(rawResult4);

  type DeepResult = {
    keyPassages?: { page: number; text: string; reason: string }[];
    connections?: { fromPage: number; toPage: number; description: string }[];
  };

  const parsed = parseJson<DeepResult>(raw4, {});

  await db.updateBookBrain(bookId, {
    passCompleted: 4,
    keyPassages: parsed.keyPassages ?? [],
    connections: parsed.connections ?? [],
  });
}

/* -------------------------------------------------------------------------- */
/*  Main entry point — called by the Heartbeat handler                        */
/* -------------------------------------------------------------------------- */

export async function runBookBrainPipeline(bookId: number): Promise<{
  passCompleted: number;
  skipped: boolean;
}> {
  // Fetch all pages (pass 1 must already be done).
  const pages = await db.getAllPagesForBook(bookId);
  if (pages.length === 0) {
    return { passCompleted: 0, skipped: true };
  }

  const brain = await db.getBookBrain(bookId);
  const startPass = (brain?.passCompleted ?? 0) + 1;

  if (startPass > 4) {
    return { passCompleted: 4, skipped: true }; // already complete
  }

  const fullText = buildFullText(pages);

  // Ensure a bookBrain row exists before we start updating it.
  if (!brain) {
    await db.upsertBookBrain(bookId, { passCompleted: 1 });
  }

  if (startPass <= 2) {
    await runPass2(bookId, fullText);
  }
  if (startPass <= 3) {
    await runPass3(bookId, fullText);
  }
  if (startPass <= 4) {
    await runPass4(bookId, fullText);
  }

  return { passCompleted: 4, skipped: false };
}

/* -------------------------------------------------------------------------- */
/*  Context builder — used by the buddy when answering questions              */
/* -------------------------------------------------------------------------- */

export interface BrainContext {
  overallSummary: string | null;
  themes: string[];
  chapterContext: string | null;
  relevantEntities: string;
  keyPassagesNearby: string;
  brainReady: boolean; // true when pass 4 is complete
  passCompleted: number;
}

export async function buildBrainContext(
  bookId: number,
  currentPage: number,
  spoilerMode: "safe" | "full",
): Promise<BrainContext> {
  const brain = await db.getBookBrain(bookId);
  const entities = await db.getBookEntities(bookId);

  const passCompleted = brain?.passCompleted ?? 0;
  const brainReady = passCompleted >= 4;

  if (passCompleted < 2) {
    return {
      overallSummary: null,
      themes: [],
      chapterContext: null,
      relevantEntities: "",
      keyPassagesNearby: "",
      brainReady: false,
      passCompleted,
    };
  }

  // Spoiler mode: in "safe" mode, only use information up to the current page.
  const pageLimit = spoilerMode === "safe" ? currentPage : Infinity;

  // Chapter context: find the chapter the reader is currently in.
  const chapters = (brain?.chapterSummaries ?? []).filter(
    c => spoilerMode === "full" || c.startPage <= pageLimit,
  );
  const currentChapter = [...chapters].reverse().find(c => c.startPage <= currentPage);
  const chapterContext = currentChapter
    ? `Chapter ${currentChapter.chapter} — "${currentChapter.title}": ${currentChapter.summary}`
    : null;

  // Relevant entities: filter by pages visible to the reader.
  const visibleEntities = entities.filter(e => {
    if (spoilerMode === "full") return true;
    const pages = (e.pages as number[] | null) ?? [];
    return pages.length === 0 || pages.some(p => p <= pageLimit);
  });
  const relevantEntities =
    visibleEntities.length > 0
      ? visibleEntities
          .slice(0, 15)
          .map(e => `• ${e.name} (${e.type}): ${e.description}`)
          .join("\n")
      : "";

  // Key passages near the current page (within ±10 pages).
  const keyPassages = ((brain?.keyPassages ?? []) as { page: number; text: string; reason: string }[])
    .filter(p => {
      if (spoilerMode === "safe" && p.page > pageLimit) return false;
      return Math.abs(p.page - currentPage) <= 10;
    })
    .slice(0, 3);
  const keyPassagesNearby =
    keyPassages.length > 0
      ? keyPassages.map(p => `[p.${p.page}] "${p.text}" — ${p.reason}`).join("\n")
      : "";

  return {
    overallSummary: brain?.overallSummary ?? null,
    themes: (brain?.themes ?? []) as string[],
    chapterContext,
    relevantEntities,
    keyPassagesNearby,
    brainReady,
    passCompleted,
  };
}
