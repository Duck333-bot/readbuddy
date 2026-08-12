import { StickyNote } from "lucide-react";
import type { PageAnnotation } from "./types";

const annotationStyles: Record<string, string> = {
  yellow: "bg-[var(--reader-highlight-yellow)]",
  blue: "bg-[var(--reader-highlight-blue)]",
  pink: "bg-[var(--reader-highlight-pink)]",
  green: "bg-[var(--reader-highlight-green)]",
};

function formatInlineText(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={index}>{piece.slice(2, -2)}</strong>;
    if ((piece.startsWith("*") && piece.endsWith("*")) || (piece.startsWith("_") && piece.endsWith("_"))) return <em key={index}>{piece.slice(1, -1)}</em>;
    return piece;
  });
}

function paragraphKind(text: string): "chapter" | "subheading" | "quote" | "body" {
  const compact = text.replace(/\s+/g, " ").trim();
  if (/^(chapter|part|book)\s+(\d+|[ivxlcdm]+|one|two|three|four|five)\b/i.test(compact) || (/^[A-Z0-9 ,.'’—–:-]{3,80}$/.test(compact) && compact.length <= 80)) return "chapter";
  // Do not promote an ordinary short Title Case sentence into a heading. PDF
  // line breaks are noisy; only an explicit numbered subsection is strong enough.
  if (/^\d+(?:\.\d+)*[.)]?\s+[A-Z][A-Za-z0-9 ,.'’—–:-]{2,}$/.test(compact)) return "subheading";
  if (/^[“"].+[”"]$/.test(compact) || /^—/.test(compact)) return "quote";
  return "body";
}

type LocalRange = { annotation: PageAnnotation; start: number; end: number };

function rangesForParagraph(text: string, annotations: PageAnnotation[], paragraphStartOffset: number): LocalRange[] {
  const endOffset = paragraphStartOffset + text.length;
  const anchored = annotations
    .filter(annotation => annotation.startOffset !== null && annotation.endOffset !== null)
    .map(annotation => ({ annotation, start: Math.max(0, annotation.startOffset! - paragraphStartOffset), end: Math.min(text.length, annotation.endOffset! - paragraphStartOffset) }))
    .filter(range => range.end > 0 && range.start < text.length && range.end > range.start);
  // Older annotations have no offsets. Preserve them with the previous first-match
  // fallback, while all new highlights become stable even when text repeats.
  if (anchored.length > 0) return anchored;
  const legacy = annotations.find(annotation => annotation.selectedText && text.includes(annotation.selectedText));
  if (!legacy) return [];
  const start = text.indexOf(legacy.selectedText);
  return start >= 0 ? [{ annotation: legacy, start, end: start + legacy.selectedText.length }] : [];
}

function annotatedText(text: string, ranges: LocalRange[]) {
  if (ranges.length === 0) return formatInlineText(text);
  const points = Array.from(new Set([0, text.length, ...ranges.flatMap(range => [range.start, range.end])])).sort((a, b) => a - b);
  return <>{points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]!;
    const active = ranges.filter(range => range.start <= start && range.end >= end);
    const piece = text.slice(start, end);
    if (active.length === 0) return <span key={`${start}-${end}`}>{formatInlineText(piece)}</span>;
    // Overlaps are rare. The newest rendered annotation owns the colour, while
    // every note is still shown below the paragraph.
    const annotation = active[active.length - 1]!.annotation;
    return <mark key={`${start}-${end}`} className={`rounded-sm px-0.5 text-inherit ${annotationStyles[annotation.color] ?? annotationStyles.yellow}`}>{formatInlineText(piece)}</mark>;
  })}</>;
}

export function ReaderParagraph({ text, annotations = [], paragraphStartOffset = 0 }: { text: string; annotations?: PageAnnotation[]; paragraphStartOffset?: number }) {
  const kind = paragraphKind(text);
  const ranges = rangesForParagraph(text, annotations, paragraphStartOffset);
  const notes = ranges.map(range => range.annotation).filter(annotation => annotation.note);
  const content = annotatedText(text, ranges);
  if (kind === "chapter") return <h2 className="mb-8 mt-12 font-display text-[1.35em] font-semibold leading-[1.15] tracking-tight first:mt-0">{content}</h2>;
  if (kind === "subheading") return <h3 className="mb-5 mt-9 font-display text-[1.08em] font-semibold leading-snug">{content}</h3>;
  if (kind === "quote") return <blockquote className="my-8 border-l-2 border-[var(--rb-evidence)] pl-5 font-reading italic opacity-85">{content}</blockquote>;
  return <div className="mb-[1.2em] last:mb-0"><p>{content}</p>{notes.map(annotation => <aside key={annotation.id} className="mt-2 flex gap-2 rounded-r-md border-l-2 border-[var(--rb-evidence)] bg-[var(--rb-evidence-surface)] px-3 py-2 text-xs leading-relaxed text-current"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rb-evidence)]" /><span><strong className="font-semibold">Your note</strong> — {annotation.note}</span></aside>)}</div>;
}
