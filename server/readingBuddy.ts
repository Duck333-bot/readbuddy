import { invokeLLM } from "./_core/llm";

export const BUDDY_MODES = ["explain", "simplify", "translate", "define", "ask"] as const;
export type BuddyMode = (typeof BUDDY_MODES)[number];

/** Model chosen for a good balance of quality, latency and cost per question. */
const MODEL = "gpt-5-mini";

const BASE_SYSTEM = `You are ReadBuddy, a warm and precise reading companion who sits beside a reader as they work through a book.

Rules you always follow:
- Ground every answer in the passage the reader gives you. If the passage is ambiguous, say what the likely readings are instead of inventing certainty.
- Never invent facts about the book beyond what the provided context supports. If the reader asks something the context cannot answer, say so plainly and explain what you can infer.
- Write in clear, everyday language a curious 14-year-old could follow. Short sentences. No jargon unless you immediately define it.
- Be concise: 2 to 5 short paragraphs at most, or a tight list when comparing things.
- Use Markdown for structure (bold for key terms, lists when helpful). Never wrap your whole answer in a code block.
- Do not greet the reader or mention that you are an AI. Answer directly.`;

const MODE_INSTRUCTIONS: Record<BuddyMode, string> = {
  explain: `Task: EXPLAIN the highlighted passage.
Give (1) what it means in plain words, (2) why it matters in this part of the book, and (3) one concrete everyday example or analogy that makes it click. Point out any word or phrase that is likely the source of the confusion.`,
  simplify: `Task: SIMPLIFY the highlighted passage.
Rewrite it in the simplest accurate English you can, as if for a reader several years younger. First give the rewritten sentence(s) in bold. Then, in one short paragraph, note anything the simplification had to leave out.`,
  translate: `Task: TRANSLATE the highlighted passage.
Translate it into the requested target language, keeping the tone of the original. Present the translation first in bold. Then briefly explain any word or idiom that does not translate cleanly.`,
  define: `Task: DEFINE the key terms in the highlighted passage.
For each important or unfamiliar word or phrase, give a one-line definition as it is used HERE (not just the dictionary sense), then a short note on why the author chose it. Format as a Markdown list.`,
  ask: `Task: ANSWER the reader's own question about the highlighted passage.
Answer their question directly and specifically, using the passage and surrounding context. If their question rests on a misreading, gently correct it first.`,
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

  const userPrompt = [
    `Book: "${req.bookTitle}"${req.bookAuthor ? ` by ${req.bookAuthor}` : ""}`,
    `Location: page ${req.pageNumber} of ${req.pageCount}`,
    "",
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

  const response = await invokeLLM({
    model: MODEL,
    messages: [
      { role: "system", content: BASE_SYSTEM },
      ...history,
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 1400,
    reasoning: { effort: "low" },
  });

  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) {
    throw new Error("The reading buddy returned an empty answer. Please try again.");
  }
  return text;
}
