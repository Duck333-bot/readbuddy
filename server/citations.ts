/**
 * Citation parsing and validation.
 *
 * The reader can click any `[[p.N]]` marker and jump to that page. That makes a
 * citation a promise: the page must exist, must be a page we actually supplied
 * as evidence, and in spoiler-safe mode must never be ahead of the reader.
 * A confident but invented page reference is worse than no citation at all, so
 * invalid ones are stripped before the answer reaches the reader.
 */

export const CITATION_PATTERN = /\[\[p\.(\d{1,5})\]\]/g;

export type CitationValidation = {
  /** The answer with invalid citations removed. */
  text: string;
  /** Pages cited and kept. */
  validPages: number[];
  /** Pages cited that were beyond the reader's position in safe mode. */
  futurePages: number[];
  /** Pages cited that were not part of the supplied evidence. */
  unsupportedPages: number[];
};

/** Every page number cited in the text, in order of appearance. */
export function parseCitedPages(text: string): number[] {
  const pages: number[] = [];
  const pattern = new RegExp(CITATION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const page = Number(match[1]);
    if (Number.isInteger(page) && page > 0) pages.push(page);
  }
  return pages;
}

/**
 * Collect the page numbers that appear as evidence labels in the context we sent
 * to the model: `[p.47]`, `[Page 47]`, and `pp.47–52` ranges.
 */
export function collectAllowedPages(contextBlocks: (string | null | undefined)[]): Set<number> {
  const allowed = new Set<number>();
  for (const block of contextBlocks) {
    if (!block) continue;
    const labelPattern = /\[\s*(?:p\.|page\s+)(\d{1,5})\s*\]/gi;
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = labelPattern.exec(block)) !== null) {
      allowed.add(Number(labelMatch[1]));
    }
    const rangePattern = /pp?\.\s*(\d{1,5})\s*[–—-]\s*(\d{1,5})/g;
    let rangeMatch: RegExpExecArray | null;
    while ((rangeMatch = rangePattern.exec(block)) !== null) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start <= 200) {
        for (let page = start; page <= end; page++) allowed.add(page);
      }
    }
  }
  return allowed;
}

/**
 * Strip citations we cannot stand behind. Leaves the surrounding sentence intact
 * so the answer still reads naturally, and tidies the whitespace it leaves.
 */
export function validateCitations(
  answer: string,
  options: {
    allowedPages: Set<number>;
    currentPage: number;
    spoilerMode: "safe" | "full";
    pageCount?: number;
  },
): CitationValidation {
  const futurePages: number[] = [];
  const unsupportedPages: number[] = [];
  const validPages: number[] = [];

  const text = answer.replace(CITATION_PATTERN, (marker, raw) => {
    const page = Number(raw);
    if (!Number.isInteger(page) || page < 1) {
      unsupportedPages.push(page);
      return "";
    }
    if (options.pageCount && page > options.pageCount) {
      unsupportedPages.push(page);
      return "";
    }
    if (options.spoilerMode === "safe" && page > options.currentPage) {
      futurePages.push(page);
      return "";
    }
    // The current page is always legitimate evidence: the reader is looking at it.
    if (!options.allowedPages.has(page) && page !== options.currentPage) {
      unsupportedPages.push(page);
      return "";
    }
    validPages.push(page);
    return marker;
  });

  const tidied = text
    // Collapse the gap left where a citation was removed.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return {
    text: tidied,
    validPages: Array.from(new Set(validPages)).sort((a, b) => a - b),
    futurePages: Array.from(new Set(futurePages)).sort((a, b) => a - b),
    unsupportedPages: Array.from(new Set(unsupportedPages)).sort((a, b) => a - b),
  };
}
