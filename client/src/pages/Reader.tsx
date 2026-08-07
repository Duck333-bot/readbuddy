import { useAuth } from "@/_core/hooks/useAuth";
import { Wordmark } from "@/components/AppShell";
import BuddyPanel from "@/components/BuddyPanel";
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
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useParams, useSearch } from "wouter";
type SelectionState = ReaderSelection;

const FONT_SIZES = [17, 18, 19, 20, 22, 24];
/** Height of the sticky reader header in pixels (`h-14`). */
const HEADER_HEIGHT = 56;
const WIDTHS = [
  { label: "Narrow", value: "34rem" },
  { label: "Comfortable", value: "40rem" },
  { label: "Wide", value: "48rem" },
];

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
  const [buddyHighlight, setBuddyHighlight] = useState("");
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [fontSizeIndex, setFontSizeIndex] = useState(1);
  const [widthIndex, setWidthIndex] = useState(1);
  const [jumpValue, setJumpValue] = useState("");

  const articleRef = useRef<HTMLDivElement>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookQuery = trpc.books.get.useQuery(
    { bookId },
    { enabled: isAuthenticated && Number.isFinite(bookId) },
  );

  /**
   * `?page=N` (used by notebook deep links) wins over the saved position, so
   * clicking a note lands the reader exactly where the note was taken.
   */
  const requestedPage = useMemo(() => {
    const raw = new URLSearchParams(search).get("page");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : null;
  }, [search]);

  // Resume where the reader left off, once, when the book loads.
  useEffect(() => {
    if (pageNumber === null && bookQuery.data) {
      const target = requestedPage ?? bookQuery.data.lastPage;
      setPageNumber(Math.min(Math.max(1, target), Math.max(1, bookQuery.data.pageCount)));
    }
  }, [bookQuery.data, pageNumber, requestedPage]);

  // Support navigating between notes without a full remount.
  const lastRequestedRef = useRef<number | null>(null);
  useEffect(() => {
    if (requestedPage === null || !bookQuery.data) return;
    if (lastRequestedRef.current === requestedPage) return;
    lastRequestedRef.current = requestedPage;
    setPageNumber(Math.min(requestedPage, Math.max(1, bookQuery.data.pageCount)));
  }, [requestedPage, bookQuery.data]);

  const pageQuery = trpc.books.page.useQuery(
    { bookId, pageNumber: pageNumber ?? 1 },
    { enabled: isAuthenticated && Number.isFinite(bookId) && pageNumber !== null },
  );

  const progressMutation = trpc.books.updateProgress.useMutation();
  const utils = trpc.useUtils();

  const book = bookQuery.data;
  const pageCount = book?.pageCount ?? 0;

  // Persist progress, debounced so fast page-flipping does not spam the server.
  useEffect(() => {
    if (!book || pageNumber === null) return;
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      progressMutation.mutate(
        { bookId: book.id, lastPage: pageNumber },
        { onSuccess: () => void utils.books.list.invalidate() },
      );
    }, 900);
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
    // Only page changes should schedule a write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, book?.id]);

  const goTo = useCallback(
    (next: number) => {
      if (!pageCount) return;
      const clamped = Math.min(Math.max(next, 1), pageCount);
      setPageNumber(clamped);
      setSelection(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pageCount],
  );

  // Keyboard navigation, disabled while typing in an input.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (pageNumber === null) return;
      // Shift+Arrow is how people extend a text selection; it must never turn
      // the page out from under them.
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
        if (event.key === "Escape") setSelection(null);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goTo(pageNumber + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(pageNumber - 1);
      } else if (event.key === "Escape") {
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, pageNumber]);

  // Detect a text selection inside the page body and place the action pill.
  const handleSelection = useCallback(() => {
    setSelection(
      readSelection(window.getSelection(), articleRef.current, {
        headerHeight: HEADER_HEIGHT,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    );
  }, []);

  useEffect(() => {
    const onUp = () => window.setTimeout(handleSelection, 10);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("selectionchange", onUp);
    // Also react to keyboard-driven selection (shift+arrow / shift+end), which
    // some readers rely on and which never fires `mouseup`.
    document.addEventListener("keyup", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("selectionchange", onUp);
      document.removeEventListener("keyup", onUp);
    };
  }, [handleSelection]);

  const askBuddy = useCallback(() => {
    if (!selection) return;
    setBuddyHighlight(selection.text);
    setBuddyOpen(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [selection]);

  const paragraphs = useMemo(() => {
    const content = pageQuery.data?.content ?? "";
    return content
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean);
  }, [pageQuery.data?.content]);

  if (authLoading || (bookQuery.isLoading && !book)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-11/12" />
        <Skeleton className="mt-3 h-4 w-10/12" />
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-9/12" />
      </div>
    );
  }

  if (bookQuery.error || !book) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Book not found</h1>
        <p className="mt-2 text-muted-foreground">
          This book is not in your library, or it has been removed.
        </p>
        <Button className="mt-6" onClick={() => navigate("/library")}>
          Back to library
        </Button>
      </div>
    );
  }

  const percent = progressPercent(pageNumber ?? 1, pageCount);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Reader chrome — deliberately minimal */}
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
            {book.author && (
              <p className="truncate text-[11px] text-muted-foreground">{book.author}</p>
            )}
          </div>

          <span className="hidden text-xs text-muted-foreground sm:inline">
            {percent}% read
          </span>

          {/* Reading preferences */}
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
                    <span className="text-xs text-muted-foreground">
                      {FONT_SIZES[fontSizeIndex]}px
                    </span>
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
                        className={`h-7 text-[11px] ${
                          widthIndex === index ? "" : "bg-background"
                        }`}
                        onClick={() => setWidthIndex(index)}>
                        {option.label}
                      </Button>
                    ))}
                  </div>
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

        {/* Thin progress line */}
        <div className="h-[2px] w-full bg-transparent">
          <div
            className="h-full bg-primary/70 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      {/* Body: page + optional buddy panel */}
      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="paper-grain flex-1">
            <article
              ref={articleRef}
              className="mx-auto px-5 py-12 sm:px-8 sm:py-16"
              style={{ maxWidth: WIDTHS[widthIndex].value }}>
              <div className="mb-9 flex items-baseline justify-between border-b border-border/60 pb-3">
                <span className="font-display text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {book.title.length > 46 ? `${book.title.slice(0, 46)}…` : book.title}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {pageNumber} / {pageCount}
                </span>
              </div>

              {pageQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="h-4"
                      style={{ width: `${72 + ((index * 13) % 26)}%` }}
                    />
                  ))}
                </div>
              ) : paragraphs.length === 0 ? (
                <p className="font-reading text-muted-foreground">
                  This page has no extractable text — it may be an image, a blank
                  page, or a plate.
                </p>
              ) : (
                <div
                  data-testid="page-text"
                  className="font-reading text-foreground selection:bg-primary/20 selection:text-foreground"
                  style={{
                    fontSize: `${FONT_SIZES[fontSizeIndex]}px`,
                    lineHeight: 1.82,
                  }}>
                  {paragraphs.map((paragraph, index) => (
                    <p key={index} className="mb-[1.15em] last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {/* Page turn */}
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

              <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
                Tip: use ← and → to turn pages. Select any sentence to ask your buddy.
              </p>
            </article>
          </div>
        </div>

        {/* Buddy panel — inline on desktop, slide-over on mobile */}
        {buddyOpen && buddyHighlight && (
          <>
            <div className="hidden w-[24rem] shrink-0 lg:block">
              <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
                <BuddyPanel
                  bookId={book.id}
                  pageNumber={pageNumber ?? 1}
                  highlight={buddyHighlight}
                  onClose={() => setBuddyOpen(false)}
                  onHighlightChange={setBuddyHighlight}
                />
              </div>
            </div>

            <div className="fixed inset-0 z-50 flex flex-col justify-end bg-foreground/25 backdrop-blur-[2px] lg:hidden">
              <div
                className="absolute inset-0"
                onClick={() => setBuddyOpen(false)}
                aria-hidden="true"
              />
              <div className="relative h-[78vh] overflow-hidden rounded-t-2xl bg-card shadow-lift">
                <BuddyPanel
                  bookId={book.id}
                  pageNumber={pageNumber ?? 1}
                  highlight={buddyHighlight}
                  onClose={() => setBuddyOpen(false)}
                  onHighlightChange={setBuddyHighlight}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating selection action */}
      {selection && (
        <div
          className="fixed z-50 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: selection.x, top: selection.y }}>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-full px-4 text-xs shadow-lift"
            onMouseDown={event => event.preventDefault()}
            onClick={askBuddy}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.1} />
            Ask ReadBuddy
          </Button>
        </div>
      )}

      <footer className="border-t border-border/60 py-4">
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Wordmark />
        </div>
      </footer>
    </div>
  );
}
