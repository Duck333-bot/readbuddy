/**
 * Book structure detection.
 *
 * Chapter structure drives Contents, chapter debrief, chapter context, and any
 * AI sentence that says "as Chapter 4 argues". If the structure is wrong, all of
 * that becomes a confident lie, so this module is deliberately conservative and
 * always reports where the structure came from.
 *
 * Confidence hierarchy:
 *   1. `outline`    — the PDF's own bookmarks (highest confidence, real titles)
 *   2. `detected`   — explicit textual headings, after rejecting running headers
 *   3. `synthetic`  — reading sections we invented; never called "Chapter"
 */

export type StructureSource = "outline" | "detected" | "synthetic";

export type BookSection = {
  /** 1-indexed position in the book. */
  index: number;
  /** Real title when we have one; otherwise a neutral label. */
  title: string;
  startPage: number;
  endPage: number;
  /** True only when this is an author-defined chapter, not our own grouping. */
  authorDefined: boolean;
};

export type BookStructure = {
  source: StructureSource;
  /** 0–1. Callers must not make confident chapter claims below 0.5. */
  confidence: number;
  sections: BookSection[];
};

export type StructurePage = { pageNumber: number; content: string };

export type HeadingCandidate = {
  pageNumber: number;
  /** The raw line as it appears in the text. */
  line: string;
  /** Why this line looked like a heading. */
  kind: "explicit" | "numbered" | "roman" | "allcaps" | "frontmatter";
};

/** Words that mark a real structural division even without a number. */
const FRONT_MATTER = /^(prologue|epilogue|introduction|preface|foreword|afterword|conclusion|appendix|acknowledgements?|dedication|contents|glossary|notes|index|bibliography)\b/i;
const EXPLICIT_CHAPTER = /^(chapter|part|book|section)\s+(\d{1,3}|[ivxlcdm]{1,7}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i;
const NUMBERED_HEADING = /^(\d{1,3})([.)])?(\s+\S.*)?$/;
const ROMAN_ONLY = /^[IVXLCDM]{1,7}[.)]?$/;

const TITLE_CASE_SENTENCE = /[.!?,;:]$/;

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

/** A comparison key that ignores page numbers so running headers collapse together. */
function runningHeaderKey(line: string): string {
  return normalizeLine(line).replace(/\d+/g, "#").toLowerCase();
}

/**
 * Collect lines that could plausibly be headings, inspecting the top of each
 * page. Being generous here is safe because `rejectRunningHeaders` and the
 * ambiguity checks downstream remove the noise.
 */
export function collectHeadingCandidates(pages: StructurePage[], linesToInspect = 4): HeadingCandidate[] {
  const candidates: HeadingCandidate[] = [];
  for (const page of pages) {
    const lines = page.content
      .split("\n")
      .map(normalizeLine)
      .filter(line => line.length > 0)
      .slice(0, linesToInspect);

    for (const line of lines) {
      if (line.length > 90) continue;
      if (EXPLICIT_CHAPTER.test(line)) {
        candidates.push({ pageNumber: page.pageNumber, line, kind: "explicit" });
        break;
      }
      if (FRONT_MATTER.test(line) && line.length <= 60) {
        candidates.push({ pageNumber: page.pageNumber, line, kind: "frontmatter" });
        break;
      }
      if (ROMAN_ONLY.test(line)) {
        candidates.push({ pageNumber: page.pageNumber, line, kind: "roman" });
        break;
      }
      const numbered = NUMBERED_HEADING.exec(line);
      if (numbered && Number(numbered[1]) <= 150) {
        candidates.push({ pageNumber: page.pageNumber, line, kind: "numbered" });
        break;
      }
      const letters = line.replace(/[^A-Za-z]/g, "");
      const isAllCaps = letters.length >= 3 && letters === letters.toUpperCase();
      if (isAllCaps && line.length <= 60 && !TITLE_CASE_SENTENCE.test(line)) {
        candidates.push({ pageNumber: page.pageNumber, line, kind: "allcaps" });
        break;
      }
    }
  }
  return candidates;
}

/**
 * Remove repeated running headers and repeated book titles. A real chapter
 * heading appears once; a running header appears on many pages.
 */
export function rejectRunningHeaders(
  candidates: HeadingCandidate[],
  options: { bookTitle?: string | null; repeatThreshold?: number } = {},
): HeadingCandidate[] {
  const repeatThreshold = options.repeatThreshold ?? 3;
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = runningHeaderKey(candidate.line);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const titleKey = options.bookTitle ? runningHeaderKey(options.bookTitle) : null;

  return candidates.filter(candidate => {
    const key = runningHeaderKey(candidate.line);
    if (titleKey && key === titleKey) return false;
    // "Chapter 1", "Chapter 2" share the key "chapter #", so explicit chapter
    // headings are exempt from the repeat rule — they are supposed to recur.
    if (candidate.kind === "explicit") return true;
    return (counts.get(key) ?? 0) < repeatThreshold;
  });
}

function sectionsFromBoundaries(
  boundaries: { page: number; title: string }[],
  pages: StructurePage[],
  authorDefined: boolean,
): BookSection[] {
  const lastPage = pages.length > 0 ? pages[pages.length - 1]!.pageNumber : 1;
  const sorted = [...boundaries].sort((a, b) => a.page - b.page);
  return sorted.map((boundary, i) => ({
    index: i + 1,
    title: boundary.title,
    startPage: boundary.page,
    endPage: i + 1 < sorted.length ? Math.max(boundary.page, sorted[i + 1]!.page - 1) : lastPage,
    authorDefined,
  }));
}

/** Build sections directly from the PDF outline. Titles are the author's own. */
export function structureFromOutline(
  outline: { title: string; page: number; level: number }[],
  pages: StructurePage[],
): BookStructure | null {
  const topLevel = outline.filter(entry => entry.level === 0);
  const usable = (topLevel.length >= 3 ? topLevel : outline).filter(entry => entry.title.trim().length > 0);
  if (usable.length < 3) return null;

  // Deduplicate by page: outlines sometimes repeat a destination.
  const byPage = new Map<number, string>();
  for (const entry of usable) {
    if (!byPage.has(entry.page)) byPage.set(entry.page, entry.title);
  }
  const boundaries = Array.from(byPage.entries()).map(([page, title]) => ({ page, title }));
  if (boundaries.length < 3) return null;

  return {
    source: "outline",
    confidence: 0.95,
    sections: sectionsFromBoundaries(boundaries, pages, true),
  };
}

/** Build sections from textual headings, preserving real titles where they exist. */
export function structureFromHeadings(
  candidates: HeadingCandidate[],
  pages: StructurePage[],
): BookStructure | null {
  const strong = candidates.filter(c => c.kind === "explicit" || c.kind === "frontmatter");
  const supporting = candidates.filter(c => c.kind === "numbered" || c.kind === "roman");
  const chosen = strong.length >= 3 ? strong : strong.length + supporting.length >= 4 ? [...strong, ...supporting] : [];
  if (chosen.length < 3) return null;

  const byPage = new Map<number, HeadingCandidate>();
  for (const candidate of chosen.sort((a, b) => a.pageNumber - b.pageNumber)) {
    if (!byPage.has(candidate.pageNumber)) byPage.set(candidate.pageNumber, candidate);
  }
  const boundaries = Array.from(byPage.values()).map(candidate => ({
    page: candidate.pageNumber,
    title: candidate.line,
  }));

  // Explicit "Chapter N" headings are much stronger evidence than bare numbers.
  const explicitShare = chosen.filter(c => c.kind === "explicit" || c.kind === "frontmatter").length / chosen.length;
  const confidence = explicitShare >= 0.6 ? 0.8 : 0.55;

  return {
    source: "detected",
    confidence,
    sections: sectionsFromBoundaries(boundaries, pages, true),
  };
}

/**
 * Last resort: split the book into reading sections of roughly equal length.
 * These are OUR groupings, so they are named "Section", never "Chapter", and
 * `authorDefined` is false so the AI cannot claim chapter knowledge.
 */
export function syntheticSections(pages: StructurePage[], targetTokens = 3000): BookStructure {
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  const boundaries: { page: number; title: string }[] = [];
  let tokens = 0;
  let index = 0;

  for (const page of pages) {
    if (index === 0 || tokens >= targetTokens) {
      index += 1;
      boundaries.push({ page: page.pageNumber, title: `Section ${index}` });
      tokens = 0;
    }
    tokens += estimateTokens(page.content);
  }
  if (boundaries.length === 0 && pages.length > 0) {
    boundaries.push({ page: pages[0]!.pageNumber, title: "Section 1" });
  }

  return {
    source: "synthetic",
    confidence: 0.2,
    sections: sectionsFromBoundaries(boundaries, pages, false),
  };
}

/**
 * Resolve the best available structure. `validate` is an optional LLM-backed
 * classifier used only when textual headings are ambiguous; it never receives
 * the whole book, only candidate lines.
 */
export async function resolveBookStructure(
  pages: StructurePage[],
  options: {
    outline?: { title: string; page: number; level: number }[];
    bookTitle?: string | null;
    validate?: (candidates: HeadingCandidate[]) => Promise<HeadingCandidate[]>;
  } = {},
): Promise<BookStructure> {
  if (pages.length === 0) {
    return { source: "synthetic", confidence: 0, sections: [] };
  }

  const fromOutline = options.outline?.length ? structureFromOutline(options.outline, pages) : null;
  if (fromOutline) return fromOutline;

  const candidates = rejectRunningHeaders(collectHeadingCandidates(pages), { bookTitle: options.bookTitle });
  const strongCount = candidates.filter(c => c.kind === "explicit" || c.kind === "frontmatter").length;

  // Only spend an LLM call when the evidence is genuinely ambiguous.
  let usable = candidates;
  if (options.validate && candidates.length >= 3 && strongCount < 3) {
    try {
      const validated = await options.validate(candidates);
      if (validated.length >= 3) usable = validated;
    } catch {
      // Validation is best-effort; fall back to the heuristic candidates.
    }
  }

  const fromHeadings = structureFromHeadings(usable, pages);
  if (fromHeadings) return fromHeadings;

  return syntheticSections(pages);
}

/** True when callers may safely say "Chapter N" to the reader or the model. */
export function canMakeChapterClaims(structure: Pick<BookStructure, "source" | "confidence">): boolean {
  return structure.source !== "synthetic" && structure.confidence >= 0.5;
}
