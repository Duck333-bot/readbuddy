import { useAuth } from "@/_core/hooks/useAuth";
import { Wordmark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  NotebookPen,
  Settings2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Link, useLocation, useParams, useSearch } from "wouter";

type SelectionState = ReaderSelection;
type BuddyMode = "explain" | "simplify" | "context" | "who" | "why" | "translate" | "define" | "ask";

const FONT_SIZES = [17, 18, 19, 20, 22, 24];
const HEADER_HEIGHT = 56;
const WIDTHS = [
  { label: "Narrow", value: "34rem" },
  { label: "Comfortable", value: "40rem" },
  { label: "Wide", value: "48rem" },
];

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
}) {
  const [followUp, setFollowUp] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);

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
            <Streamdown>{answer}</Streamdown>
          </div>
        )}
      </div>

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

  // "I'm lost" state
  const [lostOpen, setLostOpen] = useState(false);

  // Resume recap state
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const [fontSizeIndex, setFontSizeIndex] = useState(1);
  const [widthIndex, setWidthIndex] = useState(1);
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

  const updateProgress = trpc.books.updateProgress.useMutation();
  const saveEntry = trpc.notebook.save.useMutation();

  // AI answer mutation
  const askMutation = trpc.buddy.ask.useMutation();

  // "I'm lost" mutation
  const lostMutation = trpc.reader.lost.useMutation();

  // Resume summary query
  const resumeQuery = trpc.reader.resumeSummary.useQuery(
    { bookId },
    { enabled: !!bookId && !Number.isNaN(bookId) },
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
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [handleSelection]);

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
      setActiveHighlight(selection.text);
      setActiveMode(mode);
      setActiveQuestion(question ?? null);
      setAnswerOpen(true);
      setIsSaved(false);
      setSelection(null);

      askMutation.mutate({
        bookId,
        pageNumber: pageNumber ?? 1,
        highlight: selection.text,
        mode,
        question,
      });
    },
    [selection, bookId, pageNumber, askMutation],
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
        },
      },
    );
  }, [activeHighlight, activeMode, activeQuestion, askMutation.data, bookId, pageNumber, saveEntry]);

  const handleLost = useCallback(() => {
    setLostOpen(true);
    lostMutation.mutate({ bookId, pageNumber: pageNumber ?? 1 });
  }, [bookId, pageNumber, lostMutation]);

  const paragraphs = useMemo(() => {
    const content = pageQuery.data?.content ?? "";
    if (!content) return [];
    return content
      .split(/\n{2,}/)
      .map((part: string) => part.trim())
      .filter(Boolean);
  }, [pageQuery.data?.content]);

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal sticky header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/88 backdrop-blur-md">
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
            <PopoverContent align="end" className="w-64">
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
                className="font-reading text-foreground selection:bg-primary/20 selection:text-foreground"
                style={{ fontSize: `${FONT_SIZES[fontSizeIndex]}px`, lineHeight: 1.82 }}>
                {paragraphs.map((paragraph: string, index: number) => (
                  <p key={index} className="mb-[1.15em] last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
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
            {selection.text.trim().split(/\s+/).length <= 4 && (
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
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Wordmark />
        </div>
      </footer>
    </div>
  );
}
