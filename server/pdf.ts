/**
 * Server-side PDF parsing: page-by-page plain text extraction plus metadata.
 * Uses pdfjs-dist's legacy build, which runs in plain Node without a worker.
 */

export type ExtractedPdf = {
  pageCount: number;
  pages: string[];
  title: string | null;
  author: string | null;
  /** Chapter entries taken from the PDF's own bookmark outline, when present. */
  outline: PdfOutlineEntry[];
  /** First page containing enough selectable text to be worth opening on. */
  firstReadablePage: number;
};

/** One entry from the PDF's embedded outline (bookmarks panel). */
export type PdfOutlineEntry = {
  title: string;
  page: number;
  level: number;
};

/**
 * A page needs a reasonable amount of real prose before we treat it as the
 * opening page. Covers, blank pages, and pure-image plates fall below this.
 */
export const MEANINGFUL_TEXT_CHARS = 200;

/** Count characters that belong to words, ignoring stray punctuation and page numbers. */
export function meaningfulTextLength(pageText: string): number {
  return pageText.replace(/[^0-9A-Za-z\u00C0-\u024F\u0370-\u1FFF\u3040-\u9FFF]+/g, " ").trim().length;
}

/**
 * Pick the first page a reader should land on. Prefers the first page with
 * enough prose; if a book is unusually sparse, falls back to the densest early
 * page so we never open on a blank sheet, and finally to page 1.
 */
export function findFirstReadablePage(pages: string[]): number {
  for (let i = 0; i < pages.length; i++) {
    if (meaningfulTextLength(pages[i] ?? "") >= MEANINGFUL_TEXT_CHARS) return i + 1;
  }
  let bestIndex = -1;
  let bestLength = 0;
  const searchLimit = Math.min(pages.length, 30);
  for (let i = 0; i < searchLimit; i++) {
    const length = meaningfulTextLength(pages[i] ?? "");
    if (length > bestLength) {
      bestLength = length;
      bestIndex = i;
    }
  }
  return bestLength > 0 ? bestIndex + 1 : 1;
}

/** Hard ceiling so a pathological upload cannot exhaust the request budget. */
export const MAX_PAGES = 1200;

type TextItem = { str: string; hasEOL?: boolean; transform?: number[] };

/**
 * pdf.js returns positioned text fragments. Stitch them back into readable
 * paragraphs: join fragments on the same visual line, break the paragraph when
 * the vertical position jumps or a line ends without sentence continuation.
 */
function itemsToText(items: TextItem[]): string {
  const lines: string[] = [];
  let current = "";
  let lastY: number | null = null;

  for (const item of items) {
    const str = typeof item.str === "string" ? item.str : "";
    const y = Array.isArray(item.transform) ? item.transform[5] : null;

    const newLine =
      lastY !== null && y !== null && Math.abs(y - lastY) > 1.5;

    if (newLine && current.trim()) {
      lines.push(current.trim());
      current = "";
    }

    current += str;
    if (item.hasEOL) current += " ";
    if (y !== null) lastY = y;
  }
  if (current.trim()) lines.push(current.trim());

  // Merge wrapped lines into paragraphs: a line that does not end a sentence
  // and is not obviously a heading continues the previous one.
  const paragraphs: string[] = [];
  let buffer = "";
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (!buffer) {
      buffer = line;
      continue;
    }

    const endsSentence = /[.!?;:"'”’)\]]$/.test(buffer);
    const startsNewBlock = /^([A-Z0-9][A-Z0-9 .,'’-]{0,40}|[•\-–—*])$/.test(line);

    if (buffer.endsWith("-")) {
      buffer = buffer.slice(0, -1) + line;
    } else if (endsSentence || startsNewBlock) {
      paragraphs.push(buffer);
      buffer = line;
    } else {
      buffer += " " + line;
    }
  }
  if (buffer) paragraphs.push(buffer);

  return paragraphs.join("\n\n");
}

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPdf> {
  // Dynamic import keeps pdfjs out of the cold-start path for requests that
  // never touch PDF parsing.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const doc = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    // pdf.js prints noisy font warnings for many real-world books.
    verbosity: 0,
  }).promise;

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(itemsToText(content.items as TextItem[]));
      page.cleanup();
    } catch {
      pages.push("");
    }
  }

  let title: string | null = null;
  let author: string | null = null;
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string; Author?: string } | undefined;
    const rawTitle = info?.Title?.trim();
    const rawAuthor = info?.Author?.trim();
    // Reject junk metadata like "untitled" or a bare filename fragment.
    if (rawTitle && rawTitle.length > 1 && !/^untitled$/i.test(rawTitle)) {
      title = rawTitle.slice(0, 500);
    }
    if (rawAuthor && rawAuthor.length > 1 && !/^(unknown|anonymous)$/i.test(rawAuthor)) {
      author = rawAuthor.slice(0, 250);
    }
  } catch {
    // Metadata is optional.
  }

  // The PDF's own outline is the highest-confidence source of chapter structure,
  // so resolve every bookmark destination to a real page number.
  const outline: PdfOutlineEntry[] = [];
  try {
    type OutlineNode = { title?: string; dest?: unknown; items?: OutlineNode[] };
    const rawOutline = (await doc.getOutline()) as OutlineNode[] | null;
    const resolvePage = async (dest: unknown): Promise<number | null> => {
      try {
        const resolved = typeof dest === "string" ? await doc.getDestination(dest) : dest;
        if (!Array.isArray(resolved) || resolved.length === 0) return null;
        const index = await doc.getPageIndex(resolved[0] as never);
        return index + 1;
      } catch {
        return null;
      }
    };
    const walk = async (nodes: OutlineNode[] | undefined, level: number) => {
      if (!nodes || level > 3) return;
      for (const node of nodes) {
        const rawTitle = typeof node.title === "string" ? node.title.replace(/\s+/g, " ").trim() : "";
        const page = node.dest === undefined || node.dest === null ? null : await resolvePage(node.dest);
        if (rawTitle && page !== null && page >= 1 && page <= pageCount) {
          outline.push({ title: rawTitle.slice(0, 300), page, level });
        }
        await walk(node.items, level + 1);
      }
    };
    await walk(rawOutline ?? undefined, 0);
  } catch {
    // Outline is optional; heading detection is the fallback.
  }

  await doc.cleanup();

  return {
    pageCount,
    pages,
    title,
    author,
    outline,
    firstReadablePage: findFirstReadablePage(pages),
  };
}

/** Derive a human-friendly title from a filename when metadata is missing. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[Pp][Dd][Ff]$/, "").replace(/[_+]+/g, " ");
  const cleaned = base
    .replace(/\s{2,}/g, " ")
    .replace(/^\W+|\W+$/g, "")
    .trim();
  if (!cleaned) return "Untitled book";
  return cleaned
    .split(" ")
    .map(word =>
      word.length > 2 && word === word.toLowerCase()
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word,
    )
    .join(" ")
    .slice(0, 500);
}
