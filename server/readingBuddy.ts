import { llmCall } from "./llm/router";
import * as db from "./db";

export const BUDDY_MODES = [
  "explain",
  "simplify",
  "context",
  "why",
  "translate",
  "define",
  "ask",
] as const;
export type BuddyMode = (typeof BUDDY_MODES)[number];


const BASE_SYSTEM = `You are ReadBuddy, a warm and precise reading companion who sits beside a reader as they work through a book.

Rules you always follow:
- Ground every answer in the passage the reader gives you. If the passage is ambiguous, say what the likely readings are instead of inventing certainty.
- Never invent facts about the book beyond what the provided context supports. If the reader asks something the context cannot answer, say so plainly and explain what you can infer.
- Write in clear, everyday language a curious 14-year-old could follow. Short sentences. No jargon unless you immediately define it.
- Be concise: 2 to 5 short paragraphs at most, or a tight list when comparing things.
- Use Markdown for structure (bold for key terms, lists when helpful). Never wrap your whole answer in a code block.
- Do not greet the reader or mention that you are an AI. Answer directly.
- When Book Brain context is provided, USE IT actively — reference characters by name, connect to themes, mention chapter context. This is what makes you smarter than a generic AI.
- When reader memory is provided, NEVER re-explain vocabulary or concepts the reader already knows. Reference them by name and build on them.`;

const MODE_INSTRUCTIONS: Record<BuddyMode, string> = {
  explain: `Task: EXPLAIN the highlighted passage.
Give (1) what it means in plain words, (2) why it matters in this part of the book, and (3) one concrete everyday example or analogy that makes it click. Point out any word or phrase that is likely the source of the confusion.`,

  simplify: `Task: SIMPLIFY the highlighted passage.
Rewrite it in the simplest accurate English you can, as if for a reader several years younger. First give the rewritten sentence(s) in bold. Then, in one short paragraph, note anything the simplification had to leave out.`,

  context: `Task: GIVE CONTEXT for the highlighted passage.
Using the book's structure, characters, and themes provided in the Book Brain context, explain: (1) what is happening in the story at this point, (2) who is involved and what their role is, and (3) how this passage fits into the larger narrative arc. Reference specific characters or concepts from the book where relevant. If Book Brain context is not yet available, use the surrounding page text instead.`,

  why: `Task: EXPLAIN WHY THIS PASSAGE IS IMPORTANT.
Explain why the author included this passage. Consider: (1) what argument, theme, or character development it advances, (2) whether it foreshadows something later, (3) whether it connects to an earlier part of the book, and (4) what the reader would miss if they skipped it. Be specific — avoid generic literary commentary.`,

  translate: `Task: TRANSLATE the highlighted passage.
Translate it into the requested target language, keeping the tone of the original. Present the translation first in bold. Then briefly explain any word or idiom that does not translate cleanly.`,

  define: `Task: DEFINE the key terms in the highlighted passage.
For each important or unfamiliar word or phrase, give a one-line definition as it is used HERE (not just the dictionary sense), then a short note on why the author chose it. Format as a Markdown list.`,

  ask: `Task: ANSWER the reader's own question about the highlighted passage.
Answer their question directly and specifically, using the passage and surrounding context. If their question rests on a misreading, gently correct it first.`,
};

// BrainContext is defined in bookBrain.ts — import and re-export to avoid duplication.
import type { BrainContext } from "./bookBrain";
export type { BrainContext };

export type ReaderMemoryContext = {
  knownVocab: { word: string; definition: string; pageFirstAsked: number }[];
  knownConcepts: { concept: string; explanation: string; pageFirstAsked: number }[];
  preferredLevel: "simple" | "standard" | "detailed";
};

export type BuddyRequest = {
  mode: BuddyMode;
  highlight: string;
  question?: string | null;
  targetLanguage?: string | null;
  bookTitle: string;
  bookAuthor?: string | null;
  pageNumber: number;
  pageCount: number;
  pageContext: string;
  history?: { role: "user" | "assistant"; content: string }[];
  brainContext?: BrainContext | null;
  readerMemory?: ReaderMemoryContext | null;
  spoilerMode?: "safe" | "full";
};

/** Keep the passage context bounded so long pages cannot blow up token cost. */
function trimContext(pageText: string, highlight: string, budget = 4000): string {
  if (pageText.length <= budget) return pageText;
  const idx = pageText.indexOf(highlight.slice(0, 60));
  if (idx === -1) return pageText.slice(0, budget);
  const start = Math.max(0, idx - Math.floor(budget / 2));
  return pageText.slice(start, start + budget);
}

export async function askReadingBuddy(req: BuddyRequest): Promise<string> {
  const context = trimContext(req.pageContext ?? "", req.highlight);

  const languageLine =
    req.mode === "translate"
      ? `Target language for the translation: ${req.targetLanguage?.trim() || "English"}.`
      : "";

  // Build the Book Brain section of the prompt (only when available).
  const brainLines: string[] = [];
  if (req.brainContext && req.brainContext.passCompleted >= 2) {
    const bc = req.brainContext;
    if (bc.overallSummary) {
      brainLines.push("BOOK OVERVIEW:", bc.overallSummary);
    }
    if (bc.themes.length > 0) {
      brainLines.push("MAIN THEMES: " + bc.themes.join(", "));
    }
    if (bc.chapterContext) {
      brainLines.push("CURRENT CHAPTER CONTEXT:", bc.chapterContext);
    }
    if (bc.relevantEntities) {
      brainLines.push("RELEVANT CHARACTERS / CONCEPTS:", bc.relevantEntities);
    }
    if (bc.keyPassagesNearby) {
      brainLines.push("NEARBY KEY PASSAGES:", bc.keyPassagesNearby);
    }
    // P0-1: Wire semantic retrieval results into the prompt.
    // This is the core of whole-book understanding — passages retrieved from
    // anywhere in the book (respecting spoiler mode) that are relevant to the
    // reader's current highlight.
    if (bc.semanticChunks) {
      brainLines.push(
        "RETRIEVED BOOK EVIDENCE (passages from earlier in the book relevant to this highlight):",
        bc.semanticChunks,
      );
    }
    if (req.spoilerMode === "safe") {
      brainLines.push(
        `SPOILER NOTE: Only use information from pages 1 to ${req.pageNumber}. Do not reveal anything that happens later in the book.`,
      );
    }
  }

  // Build the reader memory section.
  const memoryLines: string[] = [];
  if (req.readerMemory) {
    const mem = req.readerMemory;
    if (mem.knownVocab.length > 0) {
      const recent = mem.knownVocab.slice(-8).map(v => v.word).join(", ");
      memoryLines.push(
        `READER'S KNOWN VOCABULARY (do not re-explain these from scratch): ${recent}`,
      );
    }
    if (mem.knownConcepts.length > 0) {
      const recent = mem.knownConcepts.slice(-5).map(c => c.concept).join(", ");
      memoryLines.push(
        `READER'S KNOWN CONCEPTS (reference these by name, they already understand them): ${recent}`,
      );
    }
    if (mem.preferredLevel === "simple") {
      memoryLines.push(
        "READER PREFERENCE: This reader prefers very simple explanations. Use short sentences and everyday words.",
      );
    } else if (mem.preferredLevel === "detailed") {
      memoryLines.push(
        "READER PREFERENCE: This reader prefers detailed, thorough explanations.",
      );
    }
  }

  const userPrompt = [
    `Book: "${req.bookTitle}"${req.bookAuthor ? ` by ${req.bookAuthor}` : ""}`,
    `Location: page ${req.pageNumber} of ${req.pageCount}`,
    "",
    ...(brainLines.length > 0
      ? ["--- BOOK BRAIN CONTEXT ---", ...brainLines, "--- END BOOK BRAIN CONTEXT ---", ""]
      : []),
    ...(memoryLines.length > 0
      ? ["--- READER MEMORY ---", ...memoryLines, "--- END READER MEMORY ---", ""]
      : []),
    "HIGHLIGHTED PASSAGE (what the reader selected):",
    `"""${req.highlight.trim()}"""`,
    "",
    "SURROUNDING PAGE TEXT (context only — do not summarise all of it):",
    `"""${context}"""`,
    "",
    MODE_INSTRUCTIONS[req.mode],
    languageLine,
    req.question ? `\nThe reader asks: ${req.question.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const history = (req.history ?? []).slice(-6).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const response = await llmCall("reading_buddy", {
    messages: [
      { role: "system", content: BASE_SYSTEM },
      ...history,
      { role: "user", content: userPrompt },
    ],
    max_tokens: 1400,
  });
  const text = response.text.trim();
  if (!text) {
    throw new Error("The reading buddy returned an empty answer. Please try again.");
  }
  return text;
}

/**
 * After the buddy answers, update the reader's memory with any new vocabulary
 * or concepts that were explained. Runs asynchronously — never blocks the response.
 */
export async function updateReaderMemoryFromAnswer(
  userId: number,
  bookId: number,
  mode: BuddyMode,
  highlight: string,
  answer: string,
): Promise<void> {
  if (mode !== "define" && mode !== "explain" && mode !== "simplify") return;

  const memory = await db.getReaderMemory(userId, bookId);
  const knownVocab = (memory?.knownVocab ?? []) as {
    word: string;
    definition: string;
    pageFirstAsked: number;
  }[];
  const knownConcepts = (memory?.knownConcepts ?? []) as {
    concept: string;
    explanation: string;
    pageFirstAsked: number;
  }[];
  const questionCount = (memory?.questionCount ?? 0) + 1;
  const simplerCount = memory?.simplerCount ?? 0;

  // Infer preferred level from usage patterns.
  let preferredLevel: "simple" | "standard" | "detailed" =
    memory?.preferredLevel ?? "standard";
  if (simplerCount >= 3) preferredLevel = "simple";
  else if (questionCount >= 10 && simplerCount === 0) preferredLevel = "detailed";

  // For define mode, extract the first defined term from the highlight.
  if (mode === "define") {
    const word = highlight.trim().split(/\s+/).slice(0, 4).join(" ");
    const alreadyKnown = knownVocab.some(
      v => v.word.toLowerCase() === word.toLowerCase(),
    );
    if (!alreadyKnown) {
      const defLine =
        answer.split("\n").find(l => l.includes(":") || l.includes("—")) ??
        answer.slice(0, 120);
      knownVocab.push({ word, definition: defLine.slice(0, 200), pageFirstAsked: 0 });
      if (knownVocab.length > 50) knownVocab.shift();
    }
  }

  await db.upsertReaderMemory(userId, bookId, {
    knownVocab,
    knownConcepts,
    preferredLevel,
    questionCount,
    simplerCount,
  });
}
