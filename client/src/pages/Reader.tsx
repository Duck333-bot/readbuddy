import { useAuth } from "@/_core/hooks/useAuth";
import { Wordmark } from "@/components/AppShell";
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
import { readSelection, type ReaderSelection } from "@/lib/selection";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Moon,
  NotebookPen,
  Palette,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { ExternalLink } from "lucide-react";

type SelectionState = ReaderSelection;
type BuddyMode = "explain" | "simplify" | "context" | "who" | "why" | "translate" | "define" | "ask";

const FONT_SIZES = [16, 17, 18, 19, 20, 22, 24];
const HEADER_HEIGHT = 56;
const WIDTHS = [
  { label: "Narrow", value: "34rem" },
  { label: "Comfortable", value: "40rem" },
  { label: "Wide", value: "48rem" },
];
const LINE_HEIGHTS = [1.6, 1.75, 1.9, 2.1];
const LINE_HEIGHT_LABELS = ["Tight", "Normal", "Relaxed", "Spacious"];
type ReadingTheme = "light" | "sepia" | "dark";
const THEME_STYLES: Record<ReadingTheme, { bg: string; text: string; label: string }> = {
  light: { bg: "bg-background", text: "text-foreground", label: "Light" },
  sepia: { bg: "bg-[#f5f0e8]", text: "text-[#3b2f1e]", label: "Sepia" },
  dark: { bg: "bg-[#1a1a1a]", text: "text-[#e8e0d0]", label: "Dark" },
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

  // "I'm lost" state
  const [lostOpen, setLostOpen] = useState(false);

  // Resume recap state
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  // Evidence jump/back state — tracks the page to return to after jumping to evidence
  const [jumpBackPage, setJumpBackPage] = useState<number | null>(null);

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
    } else if (book?.lastPage) {
      setPageNumber(book.lastPage);
    } else {
      setPageNumber(1);
    }
  }, [search, book?.lastPage, pageCount]);

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
    window.localStorage.setItem("readbuddy-continuous-reading", String(continuousMode));
  }, [continuousMode]);

  const updateProgress = trpc.books.updateProgress.useMutation();
  const saveEntry = trpc.notebook.save.useMutation();
  const trackEvent = trpc.analytics.track.useMutation();

  // AI answer mutation
  const askMutation = trpc.buddy.ask.useMutation();
  const askBookMutation = trpc.buddy.askBook.useMutation();

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

  // Show resume card when returning to a book (has progress, not dismissed)
  useEffect(() => {
    if (resumeQuery.data && !resumeDismissed && !resumeOpen) {
      setResumeOpen(true);
    }
  }, [resumeQuery.data]);

  const goTo = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, pageCount));
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
    [bookId, pageCount, navigate, updateProgress],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.shiftKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo((pageNumber ?? 1) + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo((pageNumber ?? 1) - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pageNumber, goTo]);

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
    (mode: BuddyMode, question?: string) => {
      if (!selection?.text) return;
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
      });
    },
    [selection, selectionPage, activeMode, bookId, pageNumber, askMutation, trackEvent],
  );

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
      setJumpBackPage(null);
    }
  }, [jumpBackPage, goTo]);

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
    <div className={`flex min-h-screen flex-col transition-colors duration-300 ${THEME_STYLES[readingTheme].bg} ${THEME_STYLES[readingTheme].text}`}>
      {/* Minimal sticky header */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${readingTheme === "dark" ? "border-white/10 bg-[#1a1a1a]/88" : readingTheme === "sepia" ? "border-[#cbbd9d]/60 bg-[#f5f0e8]/88" : "border-border/60 bg-background/88"}`}>
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/library"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
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

          <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
            {percent}%
          </span>

          {/* Reading settings (font size, width, spoiler mode) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Reading settings">
                <Settings2 className="h-4 w-4" strokeWidth={1.9} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium">Text size</span>
                    <span className="text-xs text-muted-foreground">{FONT_SIZES[fontSizeIndex]}px</span>
                  </div>
                  <Slider
                    value={[fontSizeIndex]}
                    min={0}
                    max={FONT_SIZES.length - 1}
                    step={1}
                    onValueChange={value => setFontSizeIndex(value[0])}
                  />
                </div>
                <div>
                  <span className="mb-2 block text-xs font-medium">Page width</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {WIDTHS.map((option, index) => (
                      <Button
                        key={option.value}
                        variant={widthIndex === index ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-[11px] ${widthIndex === index ? "" : "bg-background"}`}
                        onClick={() => setWidthIndex(index)}>
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium">Line spacing</span>
                    <span className="text-xs text-muted-foreground">{LINE_HEIGHT_LABELS[lineHeightIndex]}</span>
                  </div>
                  <Slider
                    value={[lineHeightIndex]}
                    min={0}
                    max={LINE_HEIGHTS.length - 1}
                    step={1}
                    onValueChange={value => setLineHeightIndex(value[0] ?? 2)}
                  />
                </div>
                <div>
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-medium"><Palette className="h-3.5 w-3.5" /> Reading theme</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(THEME_STYLES) as ReadingTheme[]).map(theme => (
                      <Button
                        key={theme}
                        variant={readingTheme === theme ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-[11px] ${readingTheme === theme ? "" : "bg-background"}`}
                        onClick={() => setReadingTheme(theme)}>
                        {theme === "light" ? <Sun className="mr-1 h-3 w-3" /> : theme === "dark" ? <Moon className="mr-1 h-3 w-3" /> : null}
                        {THEME_STYLES[theme].label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium">Continuous reading</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Keep the next page flowing below.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={continuousMode}
                    onClick={() => setContinuousMode(value => !value)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${continuousMode ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${continuousMode ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <div>
                  <span className="mb-2 block text-xs font-medium">Spoiler protection</span>
                  <p className="text-[11px] text-muted-foreground">
                    ReadBuddy only uses what you've read so far. Change this in a future update.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/notebook"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
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

      {/* Reading area — full width, no sidebar */}
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div
          className="mx-auto"
          style={{ maxWidth: WIDTHS[widthIndex]?.value ?? "40rem" }}>

          {/* "I'm lost" card */}
          {lostOpen && (
            <LostCard
              answer={lostMutation.data?.answer ?? ""}
              isLoading={lostMutation.isPending}
              onClose={() => setLostOpen(false)}
            />
          )}

          <article ref={articleRef}>
            {/* Page number */}
            <p className="mb-6 text-center text-[11px] tabular-nums text-muted-foreground/60">
              {pageNumber} / {pageCount}
            </p>

            {pageQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : !pageQuery.data?.content ? (
              <p className="text-center text-sm text-muted-foreground">
                No text found on this page.
              </p>
            ) : (
              <div
                data-testid="page-text"
                data-reader-page={pageNumber ?? 1}
                className={`font-reading selection:bg-primary/25 selection:text-current ${THEME_STYLES[readingTheme].text}`}
                style={{ fontSize: `${FONT_SIZES[fontSizeIndex]}px`, lineHeight: LINE_HEIGHTS[lineHeightIndex] }}>
                {currentChapterInfo && currentChapterInfo.startPage === pageNumber && (
                  <div className="mb-9 border-b border-current/10 pb-6 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55">Chapter {currentChapterInfo.chapter}</p>
                    <h1 className="mt-2 font-display text-[1.5em] font-semibold leading-tight">{currentChapterInfo.title || `Chapter ${currentChapterInfo.chapter}`}</h1>
                  </div>
                )}
                {paragraphs.map((paragraph: string, index: number) => {
                  const kind = paragraphKind(paragraph);
                  if (kind === "chapter") return <h2 key={index} className="mb-7 mt-10 font-display text-[1.35em] font-semibold leading-tight tracking-tight first:mt-0">{formatInlineBookText(paragraph)}</h2>;
                  if (kind === "subheading") return <h3 key={index} className="mb-4 mt-8 font-display text-[1.08em] font-semibold leading-snug">{formatInlineBookText(paragraph)}</h3>;
                  if (kind === "quote") return <blockquote key={index} className="my-7 border-l-2 border-primary/35 pl-5 font-reading italic opacity-85">{formatInlineBookText(paragraph)}</blockquote>;
                  return <p key={index} className="mb-[1.15em] last:mb-0">{formatInlineBookText(paragraph)}</p>;
                })}
              </div>
            )}

            {continuousMode && nextParagraphs.length > 0 && (
              <section className="mt-14 border-t border-current/10 pt-10" data-reader-page={(pageNumber ?? 1) + 1}>
                <p className="mb-7 text-center text-[10px] font-semibold uppercase tracking-[0.16em] opacity-45">Page {(pageNumber ?? 1) + 1}</p>
                <div
                  className={`font-reading selection:bg-primary/25 selection:text-current ${THEME_STYLES[readingTheme].text}`}
                  style={{ fontSize: `${FONT_SIZES[fontSizeIndex]}px`, lineHeight: LINE_HEIGHTS[lineHeightIndex] }}>
                  {nextParagraphs.map((paragraph: string, index: number) => {
                    const kind = paragraphKind(paragraph);
                    if (kind === "chapter") return <h2 key={index} className="mb-7 mt-10 font-display text-[1.35em] font-semibold leading-tight tracking-tight first:mt-0">{formatInlineBookText(paragraph)}</h2>;
                    if (kind === "subheading") return <h3 key={index} className="mb-4 mt-8 font-display text-[1.08em] font-semibold leading-snug">{formatInlineBookText(paragraph)}</h3>;
                    if (kind === "quote") return <blockquote key={index} className="my-7 border-l-2 border-primary/35 pl-5 font-reading italic opacity-85">{formatInlineBookText(paragraph)}</blockquote>;
                    return <p key={index} className="mb-[1.15em] last:mb-0">{formatInlineBookText(paragraph)}</p>;
                  })}
                </div>
              </section>
            )}

            {/* Inline AI answer card — appears below text, no layout shift */}
            {answerOpen && activeHighlight && (
              <InlineAnswerCard
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
      {selection && (
        <div
          data-selection-actions
          className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: Math.max(8, selection.x - 80), top: selection.y - 8 }}>
          <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-card px-1.5 py-1 shadow-lg">
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => askBuddy("explain")}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
              Explain
            </button>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => askBuddy("simplify")}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
              Simpler
            </button>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => askBuddy("context")}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
              Context
            </button>
            {selection.text.trim().split(/\s+/).length <= 4 &&
              knownEntityNames.has(selection.text.trim().toLowerCase()) && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => askBuddy("who")}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10">
                Who?
              </button>
            )}
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => setSelection(null)}
              className="ml-0.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* "I'm lost" floating button — subtle, always visible */}
      <div className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2 sm:right-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLost}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-md transition-all hover:border-primary/40 hover:text-primary hover:shadow-lg active:scale-95"
              aria-label="I'm lost — help me understand where I am">
              <HelpCircle className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">I'm lost</TooltipContent>
        </Tooltip>
      </div>

      {/* Resume recap card */}
      {resumeOpen && resumeQuery.data && (
        <ResumeCard
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
      {/* Chapter debrief card — appears at end of each chapter */}
      {showDebrief && debriefQuery.data && (
        <div className="mx-auto mt-6 max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-primary/70">
                  Chapter {debriefQuery.data.chapterNumber} Complete
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-foreground">
                  What did you just read?
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowDebrief(false);
                  trackEvent.mutate({
                    event: "chapter_debrief_dismiss",
                    bookId,
                    pageNumber: pageNumber ?? 1,
                    metadata: { action: "close" },
                  });
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mt-1 [&_li]:mb-0.5">
              <Streamdown>{debriefQuery.data.debrief}</Streamdown>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setShowDebrief(false);
                  trackEvent.mutate({
                    event: "chapter_debrief_dismiss",
                    bookId,
                    pageNumber: pageNumber ?? 1,
                    metadata: { action: "continue" },
                  });
                }}
                className="rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                Continue reading
              </button>
            </div>
          </div>
        </div>
      )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Wordmark />
        </div>
      </footer>
    </div>
  );
}
