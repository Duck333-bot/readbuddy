import { useAuth } from "@/_core/hooks/useAuth";
import { Wordmark } from "@/components/AppShell";
import { ReaderContent } from "@/components/reader/ReaderContent";
import { ReaderParagraph } from "@/components/reader/ReaderParagraph";
import { SelectionToolbar } from "@/components/reader/SelectionToolbar";
import { InlineAnswerCard as ReaderInlineAnswerCard } from "@/components/reader/InlineAnswerCard";
import { LostButton, LostReaderCard } from "@/components/reader/LostButton";
import { ResumeReadingCard } from "@/components/reader/ResumeReadingCard";
import { ChapterDebriefCard } from "@/components/reader/ChapterDebriefCard";
import { ContentsDrawer } from "@/components/reader/ContentsDrawer";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import type { BuddyMode, PageAnnotation, ReadingTheme } from "@/components/reader/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseEvidenceCitations, extractCitedPages } from "@/lib/evidenceParser";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { progressPercent } from "@/lib/format";
import { getFunnelVisitorId } from "@/lib/funnel";
import { shouldOfferResumeRecap } from "@/lib/readerResume";
import { readSelection, type ReaderSelection } from "@/lib/selection";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Highlighter,
  List,
  Moon,
  NotebookPen,
  Palette,
  Settings2,
  StickyNote,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { ExternalLink } from "lucide-react";

type SelectionState = ReaderSelection;

const FONT_SIZES = [16, 17, 18, 19, 20, 22, 24];
const HEADER_HEIGHT = 56;
const WIDTHS = [
  { label: "Narrow", value: "38.75rem" },
  { label: "Comfortable", value: "42rem" },
  { label: "Wide", value: "45rem" },
];
const LINE_HEIGHTS = [1.6, 1.75, 1.9, 2.1];
const LINE_HEIGHT_LABELS = ["Tight", "Normal", "Relaxed", "Spacious"];
const THEME_STYLES: Record<ReadingTheme, { bg: string; text: string; label: string }> = {
  light: { bg: "bg-background", text: "text-foreground", label: "Light" },
  sepia: { bg: "bg-[var(--rb-reader-sepia)]", text: "text-[var(--rb-reader-sepia-ink)]", label: "Sepia" },
  dark: { bg: "bg-[var(--rb-reader-night)]", text: "text-[var(--rb-reader-night-ink)]", label: "Dark" },
};

function formatInlineBookText(text: string) {
  const pieces = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);
  return pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return <strong key={index}>{piece.slice(2, -2)}</strong>;
    }
    if (
      (piece.startsWith("*") && piece.endsWith("*")) ||
      (piece.startsWith("_") && piece.endsWith("_"))
    ) {
      return <em key={index}>{piece.slice(1, -1)}</em>;
    }
    return piece;
  });
}

function paragraphKind(text: string): "chapter" | "subheading" | "quote" | "body" {
  const compact = text.replace(/\s+/g, " ").trim();
  if (
    /^(chapter|part|book)\s+(\d+|[ivxlcdm]+|one|two|three|four|five)\b/i.test(compact) ||
    (/^[A-Z0-9 ,.'’—–:-]{3,80}$/.test(compact) && compact.length <= 80)
  ) {
    return "chapter";
  }
  if (compact.length <= 72 && /^(\d+\.|[A-Z][A-Za-z0-9 ,.'’—–:-]+)$/.test(compact)) {
    return "subheading";
  }
  if (/^[“"].+[”"]$/.test(compact) || /^—/.test(compact)) return "quote";
  return "body";
}

const ANNOTATION_STYLES: Record<string, string> = {
  yellow: "bg-amber-200/70 dark:bg-amber-300/30",
  blue: "bg-sky-200/70 dark:bg-sky-300/30",
  pink: "bg-pink-200/70 dark:bg-pink-300/30",
  green: "bg-emerald-200/70 dark:bg-emerald-300/30",
};

function formatAnnotatedBookText(text: string, annotations: PageAnnotation[]) {
  const annotation = annotations.find(item => item.selectedText && text.includes(item.selectedText));
  if (!annotation) return formatInlineBookText(text);
  const [before, ...afterParts] = text.split(annotation.selectedText);
  const after = afterParts.join(annotation.selectedText);
  return <>{formatInlineBookText(before)}<mark className={`rounded-sm px-0.5 text-inherit ${ANNOTATION_STYLES[annotation.color] ?? ANNOTATION_STYLES.yellow}`}>{formatInlineBookText(annotation.selectedText)}</mark>{formatInlineBookText(after)}</>;
}

function annotationForText(text: string, annotations: PageAnnotation[]) {
  return annotations.find(item => item.selectedText && text.includes(item.selectedText));
}

/**
 * Renders AI answer text with [[p.N]] citations replaced by tappable links.
 * Falls back to plain Streamdown for answers without citations.
 */
function AnswerWithCitations({
  text,
  onJumpToPage,
}: {
  text: string;
  onJumpToPage: (page: number) => void;
}) {
  const segments = parseEvidenceCitations(text);
  const hasCitations = segments.some(s => s.type === "citation");
  if (!hasCitations) {
    return <Streamdown>{text}</Streamdown>;
  }
  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === "citation") {
          return (
            <button
              key={i}
              onClick={() => onJumpToPage(seg.page)}
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold text-primary underline-offset-2 hover:bg-primary/10 hover:underline"
              title={`Jump to page ${seg.page}`}>
              {seg.label}
            </button>
          );
        }
        return <Streamdown key={i}>{seg.content}</Streamdown>;
      })}
    </span>
  );
}

/** Inline AI answer card — overlays the text, never shifts the reading column. */
function InlineAnswerCard({
  highlight,
  answer,
  mode,
  isLoading,
  onClose,
  onSave,
  onAskFollowUp,
  onSimpler,
  onMore,
  isSaved,
  onJumpToPage,
}: {
  highlight: string;
  answer: string;
  mode: BuddyMode;
  isLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  onAskFollowUp: (question: string) => void;
  onSimpler: () => void;
  onMore: () => void;
  isSaved: boolean;
  onJumpToPage: (page: number) => void;
}) {
  const [followUp, setFollowUp] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const citedPages = extractCitedPages(answer);

  return (
    <div className="mt-4 mb-2 rounded-xl border border-border/70 bg-card shadow-lg animate-in slide-in-from-top-2 duration-200">
      {/* Highlighted text reference */}
      <div className="border-b border-border/50 px-4 py-2.5">
        <p className="text-xs text-muted-foreground line-clamp-2 italic">
          "{highlight.slice(0, 120)}{highlight.length > 120 ? "…" : ""}"
        </p>
      </div>

      {/* Answer */}
      <div className="px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mt-1 [&_li]:mb-0.5">
            <AnswerWithCitations text={answer} onJumpToPage={onJumpToPage} />
          </div>
        )}
      </div>

      {/* Evidence passage links — shown when AI cited specific pages */}
      {!isLoading && citedPages.length > 0 && (
        <div className="border-t border-border/40 bg-muted/30 px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence
          </p>
          <div className="flex flex-wrap gap-1.5">
            {citedPages.map(page => (
              <button
                key={page}
                onClick={() => onJumpToPage(page)}
                className="flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 active:scale-95">
                <ExternalLink className="h-3 w-3" />
                p.{page} · View passage
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action row */}
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 px-4 py-2.5">
          {mode !== "simplify" && (
            <button
              onClick={onSimpler}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              Simpler
            </button>
          )}
          {mode !== "context" && (
            <button
              onClick={onMore}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              More context
            </button>
          )}
          <button
            onClick={() => setShowFollowUp(v => !v)}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            Ask a question
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={onSave}
              disabled={isSaved}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isSaved
                  ? "text-primary/60"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}>
              {isSaved ? "Saved ✓" : "Save"}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Follow-up input */}
      {showFollowUp && !isLoading && (
        <div className="border-t border-border/50 px-4 pb-3 pt-2">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (followUp.trim()) {
                onAskFollowUp(followUp.trim());
                setFollowUp("");
                setShowFollowUp(false);
              }
            }}
            className="flex gap-2">
            <Input
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              placeholder="Ask anything about this passage…"
              className="h-8 flex-1 text-xs"
              autoFocus
            />
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={!followUp.trim()}>
              Ask
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

/** "I'm lost" card — appears when the reader taps the lost button. */
function LostCard({
  answer,
  isLoading,
  onClose,
}: {
  answer: string;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto mb-6 max-w-prose rounded-xl border border-primary/20 bg-primary/5 shadow-md animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between border-b border-primary/15 px-4 py-2.5">
        <span className="text-xs font-semibold text-primary">ReadBuddy</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-10/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground">
            <Streamdown>{answer}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

/** Resume recap card — shown when returning to a book. */
function ResumeCard({
  recap,
  lastPage,
  pageCount,
  onDismiss,
  onContinue,
}: {
  recap: string;
  lastPage: number;
  pageCount: number;
  onDismiss: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:bottom-6">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-primary">Welcome back</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You stopped on page {lastPage} of {pageCount}.
            </p>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 text-sm leading-relaxed text-foreground">
          <Streamdown>{recap}</Streamdown>
        </div>
        <Button className="mt-4 w-full" size="sm" onClick={onContinue}>
          Continue reading
        </Button>
      </div>
    </div>
  );
}

export default function Reader() {
  const params = useParams<{ bookId: string }>();
  const bookId = Number(params.bookId);
  const search = useSearch();
  const { isAuthenticated, loading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const [, navigate] = useLocation();
  const [pageNumber, setPageNumber] = useState<number | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  // Inline answer state
  const [activeHighlight, setActiveHighlight] = useState("");
  const [activeMode, setActiveMode] = useState<BuddyMode>("explain");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [bookAskOpen, setBookAskOpen] = useState(false);
  const [bookQuestion, setBookQuestion] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [annotationColor, setAnnotationColor] = useState<"yellow" | "blue" | "pink" | "green">("yellow");
  const [chromeVisible, setChromeVisible] = useState(true);
  const [translationLanguage, setTranslationLanguage] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("readbuddy-translation-language") ?? "",
  );
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);
  const [translationDraft, setTranslationDraft] = useState("");
  const [spoilerConfirmOpen, setSpoilerConfirmOpen] = useState(false);

  // "I'm lost" state
  const [lostOpen, setLostOpen] = useState(false);

  // Resume recap state
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  // Evidence jump/back state — tracks the page to return to after jumping to evidence
  const [jumpBackPage, setJumpBackPage] = useState<number | null>(null);
  const [jumpBackScrollY, setJumpBackScrollY] = useState<number | null>(null);

  const [fontSizeIndex, setFontSizeIndex] = useState(1);
  const [widthIndex, setWidthIndex] = useState(1);
  const [lineHeightIndex, setLineHeightIndex] = useState(2);
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>(() => {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem("readbuddy-reading-theme");
    return saved === "sepia" || saved === "dark" || saved === "light" ? saved : "light";
  });
  const [continuousMode, setContinuousMode] = useState(() =>
    typeof window === "undefined" ? false : window.localStorage.getItem("readbuddy-continuous-reading") === "true",
  );
  const [selectionPage, setSelectionPage] = useState<number | null>(null);
  const [jumpValue, setJumpValue] = useState("");
  const articleRef = useRef<HTMLDivElement>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookQuery = trpc.books.get.useQuery(
    { bookId },
    { enabled: !!bookId && !Number.isNaN(bookId) },
  );
  const book = bookQuery.data;
  const pageCount = book?.pageCount ?? 1;

  // Initialise page from URL
  useEffect(() => {
    const params = new URLSearchParams(search);
    const p = Number(params.get("page"));
    if (p > 0 && p <= pageCount) {
      setPageNumber(p);
    } else if (book?.lastPage && book.lastPage > (book.firstReadablePage ?? 1)) {
      setPageNumber(book.lastPage);
    } else {
      setPageNumber(book?.firstReadablePage ?? 1);
    }
  }, [search, book?.lastPage, book?.firstReadablePage, pageCount]);

  const pageQuery = trpc.books.page.useQuery(
    { bookId, pageNumber: pageNumber ?? 1 },
    { enabled: !!pageNumber && !!bookId },
  );
  const nextPageQuery = trpc.books.page.useQuery(
    { bookId, pageNumber: Math.min((pageNumber ?? 1) + 1, pageCount) },
    { enabled: continuousMode && !!pageNumber && !!bookId && (pageNumber ?? 1) < pageCount },
  );

  useEffect(() => {
    window.localStorage.setItem("readbuddy-reading-theme", readingTheme);
  }, [readingTheme]);
  useEffect(() => {
    // Dialogs, popovers, and sheets render in portals outside the reader root.
    // Put the temporary reader theme on <html> so those surfaces stay coherent.
    const root = document.documentElement;
    root.dataset.readbuddyReaderTheme = readingTheme;
    return () => { delete root.dataset.readbuddyReaderTheme; };
  }, [readingTheme]);
  useEffect(() => {
    if (translationLanguage.trim()) {
      window.localStorage.setItem("readbuddy-translation-language", translationLanguage.trim());
    }
  }, [translationLanguage]);
  useEffect(() => {
    window.localStorage.setItem("readbuddy-continuous-reading", String(continuousMode));
  }, [continuousMode]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeVisible(false), 2600);
  }, []);

  useEffect(() => {
    revealChrome();
    const onInteraction = () => revealChrome();
    window.addEventListener("mousemove", onInteraction, { passive: true });
    window.addEventListener("touchstart", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction);
    return () => {
      window.removeEventListener("mousemove", onInteraction);
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
  }, [revealChrome]);

  const updateProgress = trpc.books.updateProgress.useMutation();
  const saveEntry = trpc.notebook.save.useMutation();
  const trackEvent = trpc.analytics.track.useMutation();
  const annotationsQuery = trpc.annotations.listForPage.useQuery(
    { bookId, pageNumber: pageNumber ?? 1 },
    { enabled: !!bookId && !!pageNumber },
  );
  const bookmarksQuery = trpc.annotations.listBookmarks.useQuery(
    { bookId },
    { enabled: !!bookId },
  );
  const spoilerQuery = trpc.books.getSpoilerMode.useQuery(
    { bookId },
    { enabled: !!bookId && !Number.isNaN(bookId) },
  );
  const spoilerMode = spoilerQuery.data?.spoilerMode ?? "safe";
  const setSpoilerMutation = trpc.books.setSpoilerMode.useMutation({
    onSuccess: () => spoilerQuery.refetch(),
  });
  const createAnnotation = trpc.annotations.create.useMutation();
  const createBookmark = trpc.annotations.bookmark.useMutation();
  const deleteBookmark = trpc.annotations.removeBookmark.useMutation();
  const pageAnnotations = (annotationsQuery.data ?? []) as PageAnnotation[];
  const isCurrentPageBookmarked = (bookmarksQuery.data ?? []).some(bookmark => bookmark.pageNumber === (pageNumber ?? 1));

  useEffect(() => {
    if (!book?.id || !pageNumber) return;
    const visitorId = getFunnelVisitorId();
    trackEvent.mutate({ event: "reading_open", bookId: book.id, pageNumber, visitorId });
    trackEvent.mutate({ event: "reader_opened", bookId: book.id, pageNumber, visitorId });
    if (book.lastPage > 1) trackEvent.mutate({ event: "return_to_book", bookId: book.id, pageNumber, visitorId });
    const meaningfulTimer = window.setTimeout(() => {
      trackEvent.mutate({ event: "meaningful_reading_session", bookId: book.id, pageNumber, visitorId });
    }, 45_000);
    return () => window.clearTimeout(meaningfulTimer);
    // A book session is counted once per reader-page mount, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  // AI answer mutation
  const askMutation = trpc.buddy.ask.useMutation();
  const askBookMutation = trpc.buddy.askBook.useMutation();

  useEffect(() => {
    if (askMutation.data?.answer) {
      trackEvent.mutate({ event: "ai_answer_received", bookId, pageNumber: pageNumber ?? 1, visitorId: getFunnelVisitorId() });
    }
  }, [askMutation.data?.answer]);

  // "I'm lost" mutation
  const lostMutation = trpc.reader.lost.useMutation();

  // Resume summary query
  const resumeQuery = trpc.reader.resumeSummary.useQuery(
    { bookId },
    { enabled: !!bookId && !Number.isNaN(bookId) },
  );

  // Entity names from Book Brain (for Who? button gating)
  const brainQuery = trpc.books.getBrain.useQuery(
    { bookId },
    { enabled: !!bookId && !Number.isNaN(bookId) },
  );
  const knownEntityNames = new Set(
    (brainQuery.data?.entities ?? []).map((e: { name: string }) => e.name.toLowerCase()),
  );

  // Chapter debrief — triggered when reader reaches the last page of a chapter
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefChapter, setDebriefChapter] = useState<number | null>(null);
  const chapters = (brainQuery.data?.chapterSummaries ?? []) as {
    chapter: number; title: string; summary: string; startPage: number;
  }[];
  // Detect chapter end: current page is the last page before the next chapter starts
  const currentChapterInfo = [...chapters].reverse().find(c => c.startPage <= (pageNumber ?? 1));
  const nextChapterInfo = currentChapterInfo
    ? chapters.find(c => c.chapter === currentChapterInfo.chapter + 1)
    : null;
  const isChapterEnd = nextChapterInfo
    ? (pageNumber ?? 1) === nextChapterInfo.startPage - 1
    : false;
  useEffect(() => {
    if (isChapterEnd && currentChapterInfo && debriefChapter !== currentChapterInfo.chapter) {
      setDebriefChapter(currentChapterInfo.chapter);
      setShowDebrief(true);
      trackEvent.mutate({
        event: "chapter_debrief_open",
        bookId,
        pageNumber: pageNumber ?? 1,
        metadata: { chapter: currentChapterInfo.chapter },
      });
    }
  }, [isChapterEnd, currentChapterInfo?.chapter, debriefChapter, bookId, pageNumber, trackEvent]);
  const debriefQuery = trpc.reader.chapterDebrief.useQuery(
    { bookId, chapterNumber: debriefChapter ?? 1, currentPage: pageNumber ?? 1 },
    { enabled: !!debriefChapter && showDebrief },
  );

  // A URL page is intentional navigation (e.g. evidence jump), not saved-progress resume.
  useEffect(() => {
    if (shouldOfferResumeRecap(search, Boolean(resumeQuery.data)) && !resumeDismissed && !resumeOpen) {
      setResumeOpen(true);
    }
    if (new URLSearchParams(search).has("page")) setResumeOpen(false);
  }, [resumeQuery.data, resumeDismissed, resumeOpen, search]);

  const goTo = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, pageCount));
      if (clamped !== (pageNumber ?? 1)) {
        trackEvent.mutate({ event: "reading_continued", bookId, pageNumber: clamped, visitorId: getFunnelVisitorId() });
      }
      setPageNumber(clamped);
      setAnswerOpen(false);
      setLostOpen(false);
      setSelection(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      navigate(`/read/${bookId}?page=${clamped}`, { replace: true });
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(() => {
        updateProgress.mutate({ bookId, lastPage: clamped });
      }, 2000);
    },
    [bookId, pageCount, pageNumber, navigate, updateProgress, trackEvent],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Up/Down belong to the browser's normal scroll behaviour. In continuous
      // mode even Left/Right should not unexpectedly jump the reading position.
      if (e.shiftKey || continuousMode) return;
      if (e.key === "ArrowRight") goTo((pageNumber ?? 1) + 1);
      if (e.key === "ArrowLeft") goTo((pageNumber ?? 1) - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pageNumber, goTo, continuousMode]);

  // Selection detection
  const handleSelection = useCallback(() => {
    if (!articleRef.current) return;
    const sel = readSelection(
      window.getSelection(),
      articleRef.current,
      {
        headerHeight: HEADER_HEIGHT,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    );
    setSelection(sel);
    if (sel) {
      const anchor = window.getSelection()?.anchorNode;
      const element = anchor instanceof Element ? anchor : anchor?.parentElement;
      const selectedPage = Number(element?.closest("[data-reader-page]")?.getAttribute("data-reader-page"));
      setSelectionPage(Number.isFinite(selectedPage) && selectedPage > 0 ? selectedPage : pageNumber);
    }
  }, [pageNumber]);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [handleSelection]);

  // ⌘K / Ctrl+K opens book-level questions while the reading surface stays in place.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setBookAskOpen(true);
        trackEvent.mutate({ event: "book_question_open", bookId, pageNumber: pageNumber ?? 1 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bookId, pageNumber, trackEvent]);

  // Dismiss selection when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (articleRef.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement)?.closest("[data-selection-actions]")) return;
      setSelection(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const askBuddy = useCallback(
    (mode: BuddyMode, question?: string, explicitTargetLanguage?: string) => {
      if (!selection?.text) return;
      const targetLanguage = explicitTargetLanguage?.trim() || translationLanguage.trim();
      if (mode === "translate" && !targetLanguage) {
        setTranslationDraft("");
        setTranslationPickerOpen(true);
        return;
      }
      trackEvent.mutate({
        event: "highlight_action",
        bookId,
        pageNumber: selectionPage ?? pageNumber ?? 1,
        metadata: { mode },
      });
      if (mode === "simplify" && activeMode === "explain") {
        trackEvent.mutate({
          event: "simpler_after_explain",
          bookId,
          pageNumber: selectionPage ?? pageNumber ?? 1,
        });
      }
      setActiveHighlight(selection.text);
      setActiveMode(mode);
      setActiveQuestion(question ?? null);
      setAnswerOpen(true);
      setIsSaved(false);
      setSelection(null);

      askMutation.mutate({
        bookId,
        pageNumber: selectionPage ?? pageNumber ?? 1,
        highlight: selection.text,
        mode,
        question,
        targetLanguage: mode === "translate" ? targetLanguage : undefined,
      });
    },
    [selection, selectionPage, activeMode, bookId, pageNumber, askMutation, trackEvent, translationLanguage],
  );

  const createHighlight = useCallback((note?: string) => {
    if (!selection?.text) return;
    const annotationPage = selectionPage ?? pageNumber ?? 1;
    createAnnotation.mutate(
      {
        bookId,
        pageNumber: annotationPage,
        selectedText: selection.text,
        ...(selection.startOffset !== null && selection.endOffset !== null && annotationPage === selectionPage
          ? { startOffset: selection.startOffset, endOffset: selection.endOffset }
          : {}),
        color: annotationColor,
        note: note?.trim() || undefined,
      },
      {
        onSuccess: () => {
          annotationsQuery.refetch();
          toast.success(note?.trim() ? "Note saved" : "Highlight saved");
          setSelection(null);
          setNoteComposerOpen(false);
          setNoteText("");
        },
      },
    );
  }, [selection, selectionPage, pageNumber, createAnnotation, bookId, annotationColor, annotationsQuery]);

  const toggleBookmark = useCallback(() => {
    const current = pageNumber ?? 1;
    const existing = (bookmarksQuery.data ?? []).find(bookmark => bookmark.pageNumber === current);
    if (existing) {
      deleteBookmark.mutate({ bookmarkId: existing.id }, { onSuccess: () => bookmarksQuery.refetch() });
      return;
    }
    createBookmark.mutate(
      { bookId, pageNumber: current, label: `Page ${current}` },
      { onSuccess: () => { bookmarksQuery.refetch(); toast.success("Bookmark saved"); } },
    );
  }, [pageNumber, bookmarksQuery, deleteBookmark, createBookmark, bookId]);

  const askFollowUp = useCallback(
    (question: string) => {
      if (!activeHighlight) return;
      setActiveMode("ask");
      setActiveQuestion(question);
      setIsSaved(false);
      askMutation.mutate({
        bookId,
        pageNumber: pageNumber ?? 1,
        highlight: activeHighlight,
        mode: "ask",
        question,
      });
    },
    [activeHighlight, bookId, pageNumber, askMutation],
  );

  const submitBookQuestion = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (trimmed.length < 3) return;
      trackEvent.mutate({ event: "book_question_submit", bookId, pageNumber: pageNumber ?? 1 });
      askBookMutation.mutate({ bookId, currentPage: pageNumber ?? 1, question: trimmed });
    },
    [askBookMutation, bookId, pageNumber, trackEvent],
  );

  const handleSave = useCallback(() => {
    if (!activeHighlight || !askMutation.data) return;
    saveEntry.mutate(
      {
        bookId,
        pageNumber: pageNumber ?? 1,
        mode: activeMode,
        highlight: activeHighlight,
        question: activeQuestion ?? undefined,
        answer: askMutation.data.answer,
      },
      {
        onSuccess: () => {
          setIsSaved(true);
          toast.success("Saved to notebook");
          trackEvent.mutate({ event: "notebook_save", bookId, pageNumber: pageNumber ?? 1, metadata: { mode: activeMode } });
        },
      },
    );
  }, [activeHighlight, activeMode, activeQuestion, askMutation.data, bookId, pageNumber, saveEntry, trackEvent]);

  const handleLost = useCallback(() => {
    setLostOpen(true);
    trackEvent.mutate({ event: "lost_open", bookId, pageNumber: pageNumber ?? 1 });
    lostMutation.mutate({ bookId, pageNumber: pageNumber ?? 1 });
  }, [bookId, pageNumber, lostMutation, trackEvent]);

  /** Jump to an evidence page, remembering the current page for the Back button. */
  const handleJumpToEvidence = useCallback(
    (targetPage: number) => {
      if (pageNumber && pageNumber !== targetPage) {
        setJumpBackPage(pageNumber);
        setJumpBackScrollY(window.scrollY);
      }
      trackEvent.mutate({
        event: "evidence_tap",
        bookId,
        pageNumber: pageNumber ?? 1,
        metadata: { targetPage },
      });
      goTo(targetPage);
    },
    [pageNumber, goTo, trackEvent, bookId],
  );

  /** Return to the page we were reading before jumping to evidence. */
  const handleJumpBack = useCallback(() => {
    if (jumpBackPage) {
      goTo(jumpBackPage);
      if (jumpBackScrollY !== null) {
        window.setTimeout(() => window.scrollTo({ top: jumpBackScrollY, behavior: "smooth" }), 80);
      }
      setJumpBackPage(null);
      setJumpBackScrollY(null);
    }
  }, [jumpBackPage, jumpBackScrollY, goTo]);

  const paragraphs = useMemo(() => {
    const content = pageQuery.data?.content ?? "";
    if (!content) return [];
    return content
      .split(/\n{2,}/)
      .map((part: string) => part.trim())
      .filter(Boolean);
  }, [pageQuery.data?.content]);
  const nextParagraphs = useMemo(() => {
    const content = nextPageQuery.data?.content ?? "";
    if (!content) return [];
    return content
      .split(/\n{2,}/)
      .map((part: string) => part.trim())
      .filter(Boolean);
  }, [nextPageQuery.data?.content]);
  const earlierEntityCue = useMemo(() => {
    const currentPage = pageNumber ?? 1;
    const pageText = (pageQuery.data?.content ?? "").toLowerCase();
    if (!pageText || currentPage <= 1) return null;
    const entity = (brainQuery.data?.entities ?? []).find((candidate: { name: string; firstPage?: number }) => {
      const firstPage = candidate.firstPage ?? currentPage;
      return firstPage < currentPage && candidate.name.length > 2 && pageText.includes(candidate.name.toLowerCase());
    }) as { name: string; firstPage?: number } | undefined;
    return entity?.firstPage ? { name: entity.name, firstPage: entity.firstPage } : null;
  }, [brainQuery.data?.entities, pageNumber, pageQuery.data?.content]);

  if (authLoading || (bookQuery.isLoading && !book)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-11/12" />
        <Skeleton className="mt-3 h-4 w-10/12" />
      </div>
    );
  }

  if (bookQuery.error || !book) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Book not found</h1>
        <p className="mt-2 text-muted-foreground">This book is not in your library.</p>
        <Button className="mt-6" onClick={() => navigate("/library")}>
          Back to library
        </Button>
      </div>
    );
  }

  const percent = progressPercent(pageNumber ?? 1, pageCount);

  return (
    <div onMouseMove={revealChrome} onTouchStart={revealChrome} className={`reader-surface flex min-h-screen flex-col transition-colors duration-300 ${THEME_STYLES[readingTheme].bg} ${THEME_STYLES[readingTheme].text}`}>
      {/* Minimal sticky header */}
      <header className={`reader-chrome fixed inset-x-0 top-0 z-30 border-b backdrop-blur-md ${chromeVisible ? "" : "reader-chrome-hidden"} ${readingTheme === "dark" ? "border-white/10 bg-[color-mix(in_srgb,var(--rb-reader-night-chrome)_88%,transparent)]" : readingTheme === "sepia" ? "border-[color-mix(in_srgb,var(--rb-reader-sepia-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--rb-reader-sepia-chrome)_88%,transparent)]" : "border-border/60 bg-[color-mix(in_srgb,var(--rb-reader-paper)_88%,transparent)]"}`}>
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/library"
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground sm:h-8 sm:w-8"
                aria-label="Back to library">
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Back to library</TooltipContent>
          </Tooltip>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold leading-tight">
              {book.title}
            </p>
          </div>

          <ContentsDrawer open={tocOpen} onOpenChange={setTocOpen} bookTitle={book.title} chapters={chapters} currentChapter={currentChapterInfo?.chapter} currentPage={pageNumber ?? 1} bookmarks={bookmarksQuery.data ?? []} onGoToPage={goTo} />

          <button
            onClick={() => {
              setBookAskOpen(true);
              trackEvent.mutate({ event: "book_question_open", bookId, pageNumber: pageNumber ?? 1 });
            }}
            className="flex h-9 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
            aria-label="Ask this book">
            <BookOpen className="h-3.5 w-3.5" />
            Ask
          </button>

          <button
            onClick={() => {
              setBookAskOpen(true);
              trackEvent.mutate({ event: "book_question_open", bookId, pageNumber: pageNumber ?? 1 });
            }}
            className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex">
            <BookOpen className="h-3.5 w-3.5" />
            Ask this book
            <kbd className="ml-1 rounded border border-border/70 px-1 py-0.5 text-[9px] font-medium text-muted-foreground">⌘K</kbd>
          </button>

          {jumpBackPage && (
            <button
              onClick={handleJumpBack}
              className="hidden items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 sm:flex">
              <ArrowLeft className="h-3 w-3" />
              Back to p.{jumpBackPage}
            </button>
          )}
          {jumpBackPage && <button onClick={handleJumpBack} className="fixed right-3 top-[4.25rem] z-40 flex items-center gap-1 rounded-full border border-primary/30 bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-primary shadow-md backdrop-blur sm:hidden"><ArrowLeft className="h-3 w-3" /> Back to p.{jumpBackPage}</button>}

          <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
            {percent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleBookmark}
                className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors sm:h-8 sm:w-8 ${isCurrentPageBookmarked ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                aria-label={isCurrentPageBookmarked ? "Remove bookmark" : "Bookmark this page"}>
                <Bookmark className="h-4 w-4" fill={isCurrentPageBookmarked ? "currentColor" : "none"} strokeWidth={1.9} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{isCurrentPageBookmarked ? "Remove bookmark" : "Bookmark this page"}</TooltipContent>
          </Tooltip>

          <ReaderSettings fontSizeIndex={fontSizeIndex} setFontSizeIndex={setFontSizeIndex} widthIndex={widthIndex} setWidthIndex={setWidthIndex} lineHeightIndex={lineHeightIndex} setLineHeightIndex={setLineHeightIndex} theme={readingTheme} setTheme={setReadingTheme} continuousMode={continuousMode} setContinuousMode={setContinuousMode} spoilerMode={spoilerMode} onSpoilerModeChange={nextMode => {
            if (nextMode === "full" && spoilerMode !== "full") {
              setSpoilerConfirmOpen(true);
              return;
            }
            if (nextMode === "safe") setSpoilerMutation.mutate({ bookId, spoilerMode: "safe" });
          }} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/notebook"
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground sm:h-8 sm:w-8"
                aria-label="Open notebook">
                <NotebookPen className="h-4 w-4" strokeWidth={1.9} />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Notebook</TooltipContent>
          </Tooltip>
        </div>

        {/* Thin progress bar */}
        <div className="h-0.5 bg-border/40">
          <div
            className="h-full bg-primary/60 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      <Dialog open={bookAskOpen} onOpenChange={setBookAskOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border/60 px-5 pb-4 pt-5">
            <DialogTitle className="font-display text-xl">Ask this book</DialogTitle>
            <DialogDescription>
              Ask about an idea, person, or earlier event. ReadBuddy only uses pages you have reached.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            <form
              onSubmit={event => {
                event.preventDefault();
                submitBookQuestion(bookQuestion);
              }}>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={bookQuestion}
                  onChange={event => setBookQuestion(event.target.value)}
                  placeholder="What does the author mean by…?"
                  className="h-11 flex-1 text-sm"
                />
                <Button type="submit" disabled={askBookMutation.isPending || bookQuestion.trim().length < 3}>
                  Ask
                </Button>
              </div>
            </form>
            {!askBookMutation.data && !askBookMutation.isPending && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Try asking</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "What is the main idea of this chapter?",
                    "Who is this person again?",
                    "How does this connect to earlier events?",
                  ].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setBookQuestion(prompt);
                        submitBookQuestion(prompt);
                      }}
                      className="rounded-full border border-border/70 px-3 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {askBookMutation.isPending && (
              <div className="mt-6 space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            )}
            {askBookMutation.error && (
              <p className="mt-5 text-sm text-destructive">{askBookMutation.error.message}</p>
            )}
            {askBookMutation.data && (
              <div className="mt-5 border-t border-border/60 pt-5">
                <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_strong]:font-semibold">
                  <AnswerWithCitations text={askBookMutation.data.answer} onJumpToPage={page => {
                    setBookAskOpen(false);
                    handleJumpToEvidence(page);
                  }} />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noteComposerOpen} onOpenChange={setNoteComposerOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add a personal note</DialogTitle>
            <DialogDescription>
              Your thought stays separate from ReadBuddy’s AI explanations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs italic leading-relaxed text-muted-foreground line-clamp-3">
              “{selection?.text}”
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Highlight</span>
              {(["yellow", "blue", "pink", "green"] as const).map(color => (
                <button
                  key={color}
                  onClick={() => setAnnotationColor(color)}
                  aria-label={`${color} highlight`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${ANNOTATION_STYLES[color]} ${annotationColor === color ? "scale-110 border-foreground/60" : "border-transparent"}`}
                />
              ))}
            </div>
            <textarea
              value={noteText}
              onChange={event => setNoteText(event.target.value)}
              placeholder="Write what you think, question, or want to remember…"
              className="min-h-28 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNoteComposerOpen(false)}>Cancel</Button>
              <Button onClick={() => createHighlight(noteText)} disabled={createAnnotation.isPending}>
                Save note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={translationPickerOpen} onOpenChange={setTranslationPickerOpen}>
        <DialogContent className="max-w-sm sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Translate into</DialogTitle>
            <DialogDescription>
              Choose once. ReadBuddy will remember this for your next translation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {["Chinese", "German", "Spanish", "English"].map(language => (
                <button
                  key={language}
                  onClick={() => setTranslationDraft(language)}
                  className={`min-h-10 rounded-xl border px-3 text-left text-sm font-medium transition-colors ${translationDraft === language ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-foreground hover:bg-muted"}`}>
                  {language}
                </button>
              ))}
            </div>
            <Input
              value={translationDraft}
              onChange={event => setTranslationDraft(event.target.value)}
              placeholder="Or type a language"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTranslationPickerOpen(false)}>Cancel</Button>
              <Button
                disabled={translationDraft.trim().length < 2 || !selection?.text}
                onClick={() => {
                  const language = translationDraft.trim();
                  if (!language) return;
                  setTranslationLanguage(language);
                  setTranslationPickerOpen(false);
                  askBuddy("translate", undefined, language);
                }}>
                Translate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={spoilerConfirmOpen} onOpenChange={setSpoilerConfirmOpen}>
        <DialogContent className="max-w-sm sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Use the whole book?</DialogTitle>
            <DialogDescription>
              ReadBuddy may reveal events or information from pages you haven’t read yet.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSpoilerConfirmOpen(false)}>Keep me safe</Button>
            <Button
              onClick={() => {
                setSpoilerMutation.mutate({ bookId, spoilerMode: "full" });
                setSpoilerConfirmOpen(false);
              }}>
              Use whole book
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reading area — full width, no sidebar */}
      <main className="flex-1 px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
        <div
          className="mx-auto"
          style={{ maxWidth: WIDTHS[widthIndex]?.value ?? "40rem" }}>

          {/* "I'm lost" card */}
          {lostOpen && (
            <LostReaderCard
              answer={lostMutation.data?.answer ?? ""}
              isLoading={lostMutation.isPending}
              onClose={() => setLostOpen(false)}
            />
          )}

          <article>
            <ReaderContent
              articleRef={articleRef}
              pageNumber={pageNumber ?? 1}
              pageCount={pageCount}
              paragraphs={paragraphs}
              nextParagraphs={nextParagraphs}
              continuousMode={continuousMode}
              annotations={pageAnnotations}
              chapter={currentChapterInfo}
              fontSize={FONT_SIZES[fontSizeIndex]}
              lineHeight={LINE_HEIGHTS[lineHeightIndex]}
              textClassName={THEME_STYLES[readingTheme].text}
              isLoading={pageQuery.isLoading}
              intelligenceCue={earlierEntityCue}
              onOpenEarlierPassage={handleJumpToEvidence}
              onGoToNextPage={() => goTo((pageNumber ?? 1) + 1)}
            />

            {/* Inline AI answer card — appears below text, no layout shift */}
            {answerOpen && activeHighlight && (
              <ReaderInlineAnswerCard
                highlight={activeHighlight}
                answer={askMutation.data?.answer ?? ""}
                mode={activeMode}
                isLoading={askMutation.isPending}
                onClose={() => setAnswerOpen(false)}
                onSave={handleSave}
                onAskFollowUp={askFollowUp}
                onSimpler={() => {
                  setActiveMode("simplify");
                  askMutation.mutate({
                    bookId,
                    pageNumber: pageNumber ?? 1,
                    highlight: activeHighlight,
                    mode: "simplify",
                  });
                }}
                onMore={() => {
                  setActiveMode("context");
                  askMutation.mutate({
                    bookId,
                    pageNumber: pageNumber ?? 1,
                    highlight: activeHighlight,
                    mode: "context",
                  });
                }}
                isSaved={isSaved}
                onTrustFeedback={(positive, reason) => {
                  trackEvent.mutate({
                    event: positive ? "answer_positive" : "answer_negative",
                    bookId,
                    pageNumber: pageNumber ?? 1,
                    ...(reason ? { metadata: { reason } } : {}),
                  });
                }}
                onJumpToPage={handleJumpToEvidence}
              />
            )}

            {/* Page navigation */}
            <div className="mt-14 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
              <Button
                variant="ghost"
                className="gap-1.5 pl-2 text-muted-foreground hover:text-foreground"
                disabled={(pageNumber ?? 1) <= 1}
                onClick={() => goTo((pageNumber ?? 1) - 1)}>
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Previous
              </Button>
              <form
                className="flex items-center gap-2"
                onSubmit={event => {
                  event.preventDefault();
                  const target = Number(jumpValue);
                  if (!Number.isFinite(target) || target < 1 || target > pageCount) {
                    toast.error(`Enter a page between 1 and ${pageCount}.`);
                    return;
                  }
                  goTo(target);
                  setJumpValue("");
                }}>
                <Input
                  value={jumpValue}
                  onChange={event => setJumpValue(event.target.value)}
                  placeholder={String(pageNumber ?? 1)}
                  inputMode="numeric"
                  aria-label="Jump to page"
                  className="h-8 w-16 bg-background text-center text-xs tabular-nums"
                />
                <span className="text-xs text-muted-foreground">of {pageCount}</span>
              </form>
              <Button
                variant="ghost"
                className="gap-1.5 pr-2 text-muted-foreground hover:text-foreground"
                disabled={(pageNumber ?? 1) >= pageCount}
                onClick={() => goTo((pageNumber ?? 1) + 1)}>
                Next
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
          </article>
        </div>
      </main>

      {/* Instant selection action bar — appears at selection position */}
      {selection && <SelectionToolbar selection={selection} showWho={selection.text.trim().split(/\s+/).length <= 4 && knownEntityNames.has(selection.text.trim().toLowerCase())} isSavingHighlight={createAnnotation.isPending} onAction={askBuddy} onHighlight={() => createHighlight()} onNote={() => setNoteComposerOpen(true)} onDismiss={() => setSelection(null)} />}

      <LostButton onClick={handleLost} />

      {/* Resume recap card */}
      {resumeOpen && resumeQuery.data && (
        <ResumeReadingCard
          recap={resumeQuery.data.recap}
          lastPage={resumeQuery.data.lastPage}
          pageCount={resumeQuery.data.pageCount}
          onDismiss={() => {
            setResumeOpen(false);
            setResumeDismissed(true);
          }}
          onContinue={() => {
            setResumeOpen(false);
            setResumeDismissed(true);
            if (resumeQuery.data) goTo(resumeQuery.data.lastPage);
          }}
        />
      )}

      <footer className="border-t border-border/60 py-4">
      {showDebrief && debriefQuery.data && <ChapterDebriefCard chapterNumber={debriefQuery.data.chapterNumber} debrief={debriefQuery.data.debrief} onDismiss={() => { setShowDebrief(false); trackEvent.mutate({ event: "chapter_debrief_dismiss", bookId, pageNumber: pageNumber ?? 1, metadata: { action: "close" } }); }} onContinue={() => { setShowDebrief(false); trackEvent.mutate({ event: "chapter_debrief_dismiss", bookId, pageNumber: pageNumber ?? 1, metadata: { action: "continue" } }); }} />}

        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Wordmark />
        </div>
      </footer>
    </div>
  );
}
