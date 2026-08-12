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
  onGoToNextPage?: () => void;
};

export function ReaderContent({ articleRef, pageNumber, pageCount, paragraphs, nextParagraphs, continuousMode, annotations, chapter, fontSize, lineHeight, textClassName, isLoading, intelligenceCue, onOpenEarlierPassage, onGoToNextPage }: ReaderContentProps) {
  const style = { fontSize: `${fontSize}px`, lineHeight };
  return (
    <div ref={articleRef} className="relative pb-4">
      <p className="mb-8 text-center text-[10px] font-medium tracking-[0.16em] text-current/35 tabular-nums">{pageNumber} / {pageCount}</p>
      {intelligenceCue && <button onClick={() => onOpenEarlierPassage?.(intelligenceCue.firstPage)} className="mb-6 flex items-center gap-3 text-left text-[11px] leading-snug text-[var(--reader-accent)] transition-opacity hover:opacity-70 lg:absolute lg:-left-28 lg:top-16 lg:mb-0 lg:w-24 lg:flex-col lg:items-start"><span className="relative flex h-14 w-4 justify-center"><span className="rb-thread absolute top-2 h-10" /><span className="rb-thread-node relative z-10" /></span><span><strong className="font-semibold">Earlier thread</strong><br />{intelligenceCue.name}<br /><span className="text-current/70">p.{intelligenceCue.firstPage} →</span></span></button>}
      {isLoading ? <div className="space-y-3"><div className="h-4 w-full animate-pulse rounded bg-current/10" /><div className="h-4 w-11/12 animate-pulse rounded bg-current/10" /><div className="h-4 w-4/5 animate-pulse rounded bg-current/10" /></div> : paragraphs.length === 0 ? <div className="rounded-xl border border-current/10 bg-current/[0.035] px-5 py-8 text-center"><p className="text-sm opacity-70">This PDF page has no readable text.</p><p className="mt-1 text-xs opacity-50">Your book is still here — try the next page.</p>{pageNumber < pageCount && <button onClick={onGoToNextPage} className="mt-4 rounded-lg bg-current/10 px-3 py-2 text-xs font-semibold transition-colors hover:bg-current/15">Next page →</button>}</div> : <>
        <div data-testid="page-text" data-reader-page={pageNumber} className={`font-reading selection:bg-[var(--reader-accent-soft)] selection:text-current ${textClassName}`} style={style}>
          {chapter?.startPage === pageNumber && <div className="mb-12 border-b border-current/10 pb-8 text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-50">{chapter.authorDefined === false ? "Reading section" : `Chapter ${chapter.chapter}`}</p><h1 className="mt-3 font-display text-[1.58em] font-semibold leading-tight">{chapter.title || (chapter.authorDefined === false ? `Section ${chapter.chapter}` : `Chapter ${chapter.chapter}`)}</h1></div>}
          <div data-reader-page-body>{paragraphs.map((paragraph, index) => <ReaderParagraph key={index} text={paragraph} annotations={annotations} paragraphStartOffset={paragraphs.slice(0, index).reduce((offset, previous) => offset + previous.length, 0)} />)}</div>
        </div>
        {continuousMode && nextParagraphs.length > 0 && <section className="mt-16 border-t border-current/10 pt-12" data-reader-page={pageNumber + 1}><p className="mb-8 text-center text-[10px] font-medium uppercase tracking-[0.18em] opacity-35">Page {pageNumber + 1}</p><div data-reader-page-body className={`font-reading selection:bg-[var(--reader-accent-soft)] selection:text-current ${textClassName}`} style={style}>{nextParagraphs.map((paragraph, index) => <ReaderParagraph key={index} text={paragraph} paragraphStartOffset={nextParagraphs.slice(0, index).reduce((offset, previous) => offset + previous.length, 0)} />)}</div></section>}
      </>}
    </div>
  );
}
