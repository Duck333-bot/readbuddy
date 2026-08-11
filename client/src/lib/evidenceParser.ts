/**
 * Parses [[p.N]] citation markers from AI answer text.
 * Returns an array of segments: plain text or a citation.
 */
export type TextSegment = { type: "text"; content: string };
export type CitationSegment = { type: "citation"; page: number; label: string };
export type AnswerSegment = TextSegment | CitationSegment;

const CITATION_RE = /\[\[p\.(\d+)\]\]/g;

export function parseEvidenceCitations(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    const [full, pageStr] = match;
    const page = parseInt(pageStr!, 10);
    const before = text.slice(lastIndex, match.index);
    if (before) segments.push({ type: "text", content: before });
    segments.push({ type: "citation", page, label: `p.${page}` });
    lastIndex = match.index + full.length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) segments.push({ type: "text", content: remaining });

  return segments;
}

/** Extract all unique page numbers cited in an answer. */
export function extractCitedPages(text: string): number[] {
  const pages = new Set<number>();
  CITATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(text)) !== null) {
    pages.add(parseInt(match[1]!, 10));
  }
  return Array.from(pages);
}
