import { StickyNote } from "lucide-react";
import type { PageAnnotation } from "./types";

const annotationStyles: Record<string, string> = {
  yellow: "bg-amber-200/75 dark:bg-amber-300/30",
  blue: "bg-sky-200/75 dark:bg-sky-300/30",
  pink: "bg-pink-200/75 dark:bg-pink-300/30",
  green: "bg-emerald-200/75 dark:bg-emerald-300/30",
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
  if (compact.length <= 72 && /^(\d+\.|[A-Z][A-Za-z0-9 ,.'’—–:-]+)$/.test(compact)) return "subheading";
  if (/^[“"].+[”"]$/.test(compact) || /^—/.test(compact)) return "quote";
  return "body";
}

function annotationFor(text: string, annotations: PageAnnotation[]) {
  return annotations.find(item => item.selectedText && text.includes(item.selectedText));
}

function annotatedText(text: string, annotation?: PageAnnotation) {
  if (!annotation) return formatInlineText(text);
  const [before, ...rest] = text.split(annotation.selectedText);
  return <>{formatInlineText(before)}<mark className={`rounded-sm px-0.5 text-inherit ${annotationStyles[annotation.color] ?? annotationStyles.yellow}`}>{formatInlineText(annotation.selectedText)}</mark>{formatInlineText(rest.join(annotation.selectedText))}</>;
}

export function ReaderParagraph({ text, annotations = [] }: { text: string; annotations?: PageAnnotation[] }) {
  const kind = paragraphKind(text);
  const annotation = annotationFor(text, annotations);
  const content = annotatedText(text, annotation);
  if (kind === "chapter") return <h2 className="mb-8 mt-12 font-display text-[1.35em] font-semibold leading-[1.15] tracking-tight first:mt-0">{content}</h2>;
  if (kind === "subheading") return <h3 className="mb-5 mt-9 font-display text-[1.08em] font-semibold leading-snug">{content}</h3>;
  if (kind === "quote") return <blockquote className="my-8 border-l-2 border-[var(--rb-evidence)] pl-5 font-reading italic opacity-85">{content}</blockquote>;
  return <div className="mb-[1.2em] last:mb-0"><p>{content}</p>{annotation?.note && <aside className="mt-2 flex gap-2 rounded-r-md border-l-2 border-[var(--rb-evidence)] bg-[var(--rb-evidence-surface)] px-3 py-2 text-xs leading-relaxed text-current"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rb-evidence)]" /><span><strong className="font-semibold">Your note</strong> — {annotation.note}</span></aside>}</div>;
}
