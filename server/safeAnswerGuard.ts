const COMMON_CAPITALISED = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "he", "her", "his", "i", "if", "in", "is", "it", "my", "no", "of", "on", "or", "she", "so", "the", "their", "there", "this", "to", "we", "with", "yes", "yet", "you", "your", "your reverence", "your grace", "my lord",
]);

function capitalisedTerms(text: string) {
  const terms = new Set<string>();
  const pattern = /\b[A-Z][a-z]{2,}(?:[-'][A-Z][a-z]{2,})?(?:\s+[A-Z][a-z]{2,}(?:[-'][A-Z][a-z]{2,})?){0,2}\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const term = match[0].replace(/^(?:The|An|A)\s+/, "").trim().toLowerCase();
    if (term && !COMMON_CAPITALISED.has(term)) terms.add(term);
  }
  return Array.from(terms);
}

/**
 * In safe mode, unknown proper names are a strong, deterministic signal that a
 * model has drawn on memorised book knowledge rather than supplied excerpts.
 */
export function findUnsupportedSafeProperTerms(answer: string, suppliedSource: string) {
  const source = suppliedSource.toLowerCase();
  return capitalisedTerms(answer).filter(term => !source.includes(term));
}

export function safeEvidenceFallback(highlight: string, pageNumber: number) {
  const subject = highlight.trim().split(/\s+/).slice(0, 5).join(" ") || "that";
  return `I can't verify more about **${subject}** from the part of the book you've reached. I can safely say only what appears in the current passage. [[p.${pageNumber}]]`;
}

const STOP_WORDS = new Set([
  "about", "again", "and", "are", "book", "does", "for", "from", "have", "in", "is", "it", "of", "on", "pages", "reached", "the", "this", "to", "what", "who", "with", "you",
]);

function queryTerms(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(term => term.length > 2 && !STOP_WORDS.has(term));
}

/**
 * Safe whole-book questions are deliberately extractive. This is the last
 * trust boundary: an answer contains only reader-reached source sentences,
 * never a model's uncheckable summary of a famous book.
 */
export function safeExtractiveBookAnswer(input: {
  question: string;
  highlight: string;
  pageContext: string;
  evidencePassages: string;
  pageNumber: number;
}) {
  const terms = queryTerms(`${input.question} ${input.highlight}`);
  const source = `${input.evidencePassages}\n[p.${input.pageNumber}]\n${input.pageContext}`;
  const parts = source.split(/(?=\[p(?:p)?\.\d+)/i);
  const candidates: { page: number; sentence: string; score: number }[] = [];

  for (const part of parts) {
    const pageMatch = part.match(/^\[p(?:p)?\.(\d+)/i);
    const page = pageMatch ? Number(pageMatch[1]) : input.pageNumber;
    const body = part.replace(/^\[p(?:p)?\.\d+(?:[–-]\d+)?\]\s*/i, "");
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const compact = sentence.replace(/\s+/g, " ").trim();
      if (compact.length < 25) continue;
      const lower = compact.toLowerCase();
      const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
      if (score > 0) candidates.push({ page, sentence: compact.slice(0, 360), score });
    }
  }

  const chosen = candidates
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .filter((candidate, index, all) => all.findIndex(other => other.sentence === candidate.sentence) === index)
    .slice(0, 2);

  if (chosen.length === 0) return safeEvidenceFallback(input.highlight, input.pageNumber);
  const excerpts = chosen.map(candidate => `> ${candidate.sentence}\n> \n> [[p.${candidate.page}]]`).join("\n\n");
  return `Here is what the pages you have reached directly show:\n\n${excerpts}\n\nI can't verify more than these reached passages yet.`;
}
