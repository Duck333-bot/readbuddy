import { llmCall } from "./llm/router";
import * as db from "./db";
import { findUnsupportedSafeProperTerms, safeEvidenceFallback, safeExtractiveBookAnswer } from "./safeAnswerGuard";

export const BUDDY_MODES = [
  "explain",
  "simplify",
  "context",
  "why",
  "translate",
  "define",
  "ask",
  "who",
  "word",
] as const;
export type BuddyMode = (typeof BUDDY_MODES)[number];

/** Modes where inline page citations are expected when evidence was supplied. */
export const CITATION_MODES = ["context", "who", "ask", "why", "explain"] as const;


const BASE_SYSTEM = `You are ReadBuddy, a warm and precise reading companion who sits beside a reader as they work through a book.

Rules you always follow:
- Ground every answer in the passage the reader gives you. If the passage is ambiguous, say what the likely readings are instead of inventing certainty.
- Never invent facts about the book beyond what the provided context supports. If the reader asks something the context cannot answer, say so plainly and explain what you can infer.
- Write in clear, everyday language a curious 14-year-old could follow. Short sentences. No jargon unless you immediately define it.
- Be concise: 2 to 5 short paragraphs at most, or a tight list when comparing things.
- Use Markdown for structure (bold for key terms, lists when helpful). Never wrap your whole answer in a code block.
- Do not greet the reader or mention that you are an AI. Answer directly.
- When Book Brain context is provided, USE IT actively — reference characters by name, connect to themes, mention chapter context. This is what makes you smarter than a generic AI.
- When reader memory is provided, use it to make the explanation feel continuous. If the selected passage includes a known word or concept, begin with **You've seen this before.** Give a one-sentence reminder, name the earlier page, then explain what is different or important here.
- If a known concept provides a genuinely useful analogy, say “This is similar to [concept]…” and explain the difference. Do not force irrelevant analogies.
- Adaptive level matters: when the reader preference is simple, lead with the simplest accurate explanation rather than waiting for them to ask again.
- Never describe your own rules, instructions, or reasoning process. Do not write phrases like "following the rule against inventing facts" or "based on my instructions". Just answer, or say plainly what you cannot verify.`;

/**
 * Added in spoiler-safe mode. Many uploaded books are famous enough that the
 * model has memorised them; without this, it answers from training data and
 * spoils the ending while appearing perfectly grounded.
 */
const SOURCE_ONLY_RULES = `SOURCE-ONLY MODE (mandatory):
- You may recognise this book from training, but you must NOT use remembered knowledge about it. Treat all knowledge not contained in the supplied ReadBuddy context as unavailable.
- Your only sources are: the highlighted passage, the surrounding page text, the safe Book Brain facts, the retrieved evidence passages, and the reader's own memory — all shown below.
- Do not name characters, events, chapter titles, themes, or endings that do not appear in that supplied context.
- If a book-specific claim cannot be supported by the supplied context, write exactly: "I can't verify that from the part of the book you've reached." Then offer what the current passage does support.
- Never state a page number that is not shown in the supplied evidence.`;

/** Citation contract, added whenever we actually supplied retrieved evidence. */
const CITATION_RULES = `EVIDENCE CITATIONS (mandatory):
- When a claim depends on the RETRIEVED BOOK EVIDENCE (something from earlier in the book rather than the passage in front of the reader), cite the page inline using this exact syntax: [[p.47]]. Multiple pages: [[p.16]] [[p.19]].
- Only cite page numbers that appear in the supplied evidence labels. Never invent or estimate a page number.
- Do not add citations to a plain rewrite, a translation, or a dictionary-style definition — they clutter the answer without adding trust.`;

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

  word: `Task: DEFINE ONE WORD, briefly.
The reader selected a single word while reading and wants to get straight back to the book.

Answer in this shape, 1–3 short lines total:

**word** — plain-language meaning in under 15 words.
Here it means: [how it is used in THIS sentence, one short line].

Rules: no paragraphs, no lists, no background lecture, no citations. If the word is used unusually in this passage, the second line matters most.`,

  ask: `Task: ANSWER the reader's own question about the highlighted passage.
Answer their question directly and specifically, using the passage and surrounding context. If their question rests on a misreading, gently correct it first.`,
  who: `Task: WHO IS THIS? The reader has highlighted a name or entity and wants a quick reminder.

Use ONLY the entity data supplied in the Book Brain context. Write a compact card:

**[Name]** — [one sentence: who/what this is]
Role: [what they do in the book so far]
First seen: p.[the first-seen page from the entity data]
Last seen: p.[the most recent page from the entity data]
Relationships: [key relationships from the data]

Rules that matter more than the format:
- NEVER write "p.unknown" or "unknown". If the entity data has no confirmed page, omit the First seen / Last seen lines entirely and add one line: "ReadBuddy hasn't confidently located this appearance yet."
- If a line has no data (for example no relationships), omit that line rather than filling it with a placeholder.
- Only use pages and relationships shown in the supplied data. Do not estimate.
- Keep it under 80 words. Nothing from beyond the reader's current page.
If the name is not in the entity data at all, say "I haven't tracked [name] yet — they may appear later, or be a minor mention."`,
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

  // Whole-book questions in spoiler-safe mode are extractive by design. This
  // makes every claim visibly traceable to reached text rather than relying on
  // a model to remember a famous book while wearing a citation.
  if (req.spoilerMode === "safe" && req.mode === "ask") {
    return safeExtractiveBookAnswer({
      question: req.question ?? "",
      highlight: req.highlight,
      pageContext: context,
      evidencePassages: req.brainContext?.evidencePassages ?? "",
      pageNumber: req.pageNumber,
    });
  }

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
    if (bc.chapterContext && req.spoilerMode !== "safe") {
      brainLines.push("CURRENT CHAPTER CONTEXT:", bc.chapterContext);
    }
    if (!bc.chapterClaimsAllowed) {
      brainLines.push(
        'STRUCTURE WARNING: This book\'s chapter map is not reliable. Never say "Chapter N" as a fact — say "earlier in the book" instead.',
      );
    }
    if (bc.relevantEntities) {
      brainLines.push("RELEVANT CHARACTERS / CONCEPTS:", bc.relevantEntities);
    }
    if (bc.entityEvidence && bc.entityEvidence.length > 0) {
      const cards = bc.entityEvidence
        .slice(0, 8)
        .map(entity => {
          const seen =
            entity.firstSeen !== null
              ? `first seen p.${entity.firstSeen}; most recently p.${entity.lastSeen ?? entity.firstSeen}`
              : "no confirmed page evidence";
          const rels = entity.relationships
            .slice(0, 4)
            .map(rel => `${rel.name} (${rel.relation}${rel.page ? `, p.${rel.page}` : ""})`)
            .join("; ");
          return `• ${entity.name} [${entity.type}] — ${seen}${rels ? ` | relationships: ${rels}` : ""}`;
        })
        .join("\n");
      brainLines.push("ENTITY PAGE EVIDENCE (the only page numbers you may use for Who?):", cards);
    }
    if (bc.keyPassagesNearby && req.spoilerMode !== "safe") {
      brainLines.push("NEARBY KEY PASSAGES:", bc.keyPassagesNearby);
    }
    if (bc.evidencePassages) {
      brainLines.push(
        "RETRIEVED BOOK EVIDENCE (exact passages from earlier in the book; cite these page numbers):",
        bc.evidencePassages,
      );
    }
    // P0-1: Wire semantic retrieval results into the prompt.
    // This is the core of whole-book understanding — passages retrieved from
    // anywhere in the book (respecting spoiler mode) that are relevant to the
    // reader's current highlight.
    if (bc.semanticChunks) {
      brainLines.push(
        "SUPPORTING BOOK ANALYSIS (broader context; prefer the exact evidence above when citing):",
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
    const normalizedHighlight = req.highlight.toLocaleLowerCase();
    const includesTerm = (term: string) => {
      const normalizedTerm = term.trim().toLocaleLowerCase();
      if (!normalizedTerm) return false;
      return normalizedTerm.includes(" ")
        ? normalizedHighlight.includes(normalizedTerm)
        : new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(req.highlight);
    };
    const recalledVocab = mem.knownVocab.filter(v => includesTerm(v.word)).slice(-2);
    const recalledConcepts = mem.knownConcepts.filter(c => includesTerm(c.concept)).slice(-2);
    if (recalledVocab.length > 0 || recalledConcepts.length > 0) {
      memoryLines.push("READER RECALL MOMENT: Start the response with **You've seen this before.**");
      recalledVocab.forEach(v => memoryLines.push(`Earlier vocabulary: “${v.word}” (first asked on p.${v.pageFirstAsked}) — ${v.definition}`));
      recalledConcepts.forEach(c => memoryLines.push(`Earlier concept: “${c.concept}” (first asked on p.${c.pageFirstAsked}) — ${c.explanation}`));
    }
    if (mem.knownVocab.length > 0) {
      const recent = mem.knownVocab.slice(-8).map(v => `${v.word} (p.${v.pageFirstAsked})`).join(", ");
      memoryLines.push(
        `READER'S PREVIOUS VOCABULARY (use for continuity when relevant): ${recent}`,
      );
    }
    if (mem.knownConcepts.length > 0) {
      const recent = mem.knownConcepts.slice(-5).map(c => `${c.concept}: ${c.explanation}`).join(" | ");
      memoryLines.push(
        `READER'S KNOWN CONCEPTS (use one as an analogy only if it clarifies the passage): ${recent}`,
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

  const wantsCitations =
    (CITATION_MODES as readonly string[]).includes(req.mode) &&
    Boolean(req.brainContext?.evidencePassages);
  const systemPrompt = [
    BASE_SYSTEM,
    req.spoilerMode === "safe" ? SOURCE_ONLY_RULES : "",
    wantsCitations ? CITATION_RULES : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await llmCall("reading_buddy", {
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userPrompt },
    ],
    // A single-word definition must stay short; long answers break reading flow.
    max_tokens: req.mode === "word" ? 220 : 1400,
  });
  const text = response.text.trim();
  if (!text) {
    throw new Error("The reading buddy returned an empty answer. Please try again.");
  }
  if (req.spoilerMode === "safe") {
    const suppliedSource = [
      req.bookTitle,
      req.highlight,
      context,
      req.brainContext?.evidencePassages ?? "",
      req.brainContext?.semanticChunks ?? "",
      req.brainContext?.relevantEntities ?? "",
    ].join("\n");
    if (findUnsupportedSafeProperTerms(text, suppliedSource).length > 0) {
      return safeEvidenceFallback(req.highlight, req.pageNumber);
    }
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
  pageNumber: number = 0,
): Promise<void> {
  const tracked: BuddyMode[] = ["define", "word", "explain", "simplify", "context", "why"];
  if (!tracked.includes(mode)) return;

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
  // Fix: increment simplerCount when user requests simplification
  const simplerCount = (memory?.simplerCount ?? 0) + (mode === "simplify" ? 1 : 0);

  // Infer preferred level from usage patterns.
  let preferredLevel: "simple" | "standard" | "detailed" =
    memory?.preferredLevel ?? "standard";
  if (simplerCount >= 3) preferredLevel = "simple";
  else if (questionCount >= 10 && simplerCount === 0) preferredLevel = "detailed";

  // For define/word modes, extract the defined term from the highlight.
  if (mode === "define" || mode === "word") {
    const word = highlight.trim().split(/\s+/).slice(0, 4).join(" ");
    const alreadyKnown = knownVocab.some(
      v => v.word.toLowerCase() === word.toLowerCase(),
    );
    if (!alreadyKnown) {
      const defLine =
        answer.split("\n").find(l => l.includes(":") || l.includes("—")) ??
        answer.slice(0, 120);
      knownVocab.push({ word, definition: defLine.slice(0, 200), pageFirstAsked: pageNumber });
      if (knownVocab.length > 50) knownVocab.shift();
    }
  }

  // Fix: extract concepts from explain/context/why answers
  if (mode === "explain" || mode === "context" || mode === "why") {
    // Extract bolded terms from the answer as concepts (markdown **term**)
    const boldMatches = answer.match(/\*\*([^*]{3,40})\*\*/g) ?? [];
    for (const match of boldMatches.slice(0, 3)) {
      const concept = match.replace(/\*\*/g, "").trim();
      const alreadyKnown = knownConcepts.some(
        c => c.concept.toLowerCase() === concept.toLowerCase(),
      );
      if (!alreadyKnown && concept.length > 2) {
        // Extract the sentence containing this concept as the explanation
        const sentences = answer.split(/[.!?]+/);
        const relevant = sentences.find(s => s.includes(concept)) ?? answer.slice(0, 150);
        knownConcepts.push({
          concept,
          explanation: relevant.trim().slice(0, 200),
          pageFirstAsked: pageNumber,
        });
        if (knownConcepts.length > 30) knownConcepts.shift();
      }
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
