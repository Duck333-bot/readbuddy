/**
 * Server-side PDF parsing: page-by-page plain text extraction plus metadata.
 * Uses pdfjs-dist's legacy build, which runs in plain Node without a worker.
 */

export type ExtractedPdf = {
  pageCount: number;
  pages: string[];
  title: string | null;
  author: string | null;
};

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

  await doc.cleanup();

  return { pageCount, pages, title, author };
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
