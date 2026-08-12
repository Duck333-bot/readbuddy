import type { RefObject } from "react";
import type { PageAnnotation, ReaderChapter } from "./types";
import { ReaderParagraph } from "./ReaderParagraph";

type ReaderContentProps = {
  articleRef: RefObject<HTMLDivElement | null>;
  pageNumber: number;
  pageCount: number;
  paragraphs: string[];
  nextParagraphs: string[];
  continuousMode: boolean;
  annotations: PageAnnotation[];
  chapter?: ReaderChapter;
  fontSize: number;
  lineHeight: number;
  textClassName: string;
  isLoading: boolean;
  intelligenceCue?: { name: string; firstPage: number } | null;
  onOpenEarlierPassage?: (page: number) => void;
};

export function ReaderContent({ articleRef, pageNumber, pageCount, paragraphs, nextParagraphs, continuousMode, annotations, chapter, fontSize, lineHeight, textClassName, isLoading, intelligenceCue, onOpenEarlierPassage }: ReaderContentProps) {
  const style = { fontSize: `${fontSize}px`, lineHeight };
  return (
    <div ref={articleRef} className="relative pb-4">
      <p className="mb-8 text-center text-[10px] font-medium tracking-[0.16em] text-current/35 tabular-nums">{pageNumber} / {pageCount}</p>
      {intelligenceCue && <button onClick={() => onOpenEarlierPassage?.(intelligenceCue.firstPage)} className="mb-5 flex items-center gap-2 rounded-full border border-[#716cc0]/18 bg-[#f4f1ff]/80 px-3 py-2 text-left text-[11px] leading-snug text-[#5d579f] transition-colors hover:bg-[#ece6ff] lg:absolute lg:-left-32 lg:top-16 lg:mb-0 lg:w-28 lg:flex-col lg:items-start lg:rounded-2xl"><span className="text-base leading-none">✦</span><span><strong className="font-semibold">Earlier thread</strong><br />{intelligenceCue.name} appeared on p.{intelligenceCue.firstPage}</span></button>}
      {isLoading ? <div className="space-y-3"><div className="h-4 w-full animate-pulse rounded bg-current/10" /><div className="h-4 w-11/12 animate-pulse rounded bg-current/10" /><div className="h-4 w-4/5 animate-pulse rounded bg-current/10" /></div> : paragraphs.length === 0 ? <p className="text-center text-sm opacity-60">No text found on this page.</p> : <>
        <div data-testid="page-text" data-reader-page={pageNumber} className={`font-reading selection:bg-[#8a85c9]/30 selection:text-current ${textClassName}`} style={style}>
          {chapter?.startPage === pageNumber && <div className="mb-12 border-b border-current/10 pb-8 text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-50">Chapter {chapter.chapter}</p><h1 className="mt-3 font-display text-[1.58em] font-semibold leading-tight">{chapter.title || `Chapter ${chapter.chapter}`}</h1></div>}
          {paragraphs.map((paragraph, index) => <ReaderParagraph key={index} text={paragraph} annotations={annotations} />)}
        </div>
        {continuousMode && nextParagraphs.length > 0 && <section className="mt-16 border-t border-current/10 pt-12" data-reader-page={pageNumber + 1}><p className="mb-8 text-center text-[10px] font-medium uppercase tracking-[0.18em] opacity-35">Page {pageNumber + 1}</p><div className={`font-reading selection:bg-[#8a85c9]/30 selection:text-current ${textClassName}`} style={style}>{nextParagraphs.map((paragraph, index) => <ReaderParagraph key={index} text={paragraph} />)}</div></section>}
      </>}
    </div>
  );
}
