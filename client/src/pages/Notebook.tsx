import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, MODE_LABELS } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { BookOpen, Highlighter, NotebookPen, Search, StickyNote, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Streamdown } from "streamdown";

const ALL_BOOKS = "all";
type MemoryView = "all" | "highlights" | "notes" | "answers";

export default function Notebook() {
  const { isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: true });
  const [bookFilter, setBookFilter] = useState<string>(ALL_BOOKS);
  const [query, setQuery] = useState("");
  const [memoryView, setMemoryView] = useState<MemoryView>("all");
  const utils = trpc.useUtils();

  const entriesQuery = trpc.notebook.list.useQuery(undefined, { enabled: isAuthenticated });
  const annotationsQuery = trpc.annotations.listForUser.useQuery(undefined, { enabled: isAuthenticated });
  const booksQuery = trpc.books.list.useQuery(undefined, { enabled: isAuthenticated });

  const removeMutation = trpc.notebook.remove.useMutation({
    onMutate: async ({ entryId }) => {
      await utils.notebook.list.cancel();
      const previous = utils.notebook.list.getData();
      utils.notebook.list.setData(undefined, old =>
        old ? old.filter(entry => entry.id !== entryId) : old,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) utils.notebook.list.setData(undefined, context.previous);
      toast.error(error.message);
    },
    onSettled: async () => {
      await utils.notebook.list.invalidate();
      await utils.notebook.count.invalidate();
    },
  });

  const entries = entriesQuery.data ?? [];
  const annotations = annotationsQuery.data ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(entry => {
      if (bookFilter !== ALL_BOOKS && String(entry.bookId) !== bookFilter) return false;
      if (!needle) return true;
      return (
        entry.highlight.toLowerCase().includes(needle) ||
        entry.answer.toLowerCase().includes(needle) ||
        (entry.question ?? "").toLowerCase().includes(needle) ||
        (entry.bookTitle ?? "").toLowerCase().includes(needle)
      );
    });
  }, [entries, bookFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<
      number,
      { bookId: number; bookTitle: string; entries: typeof filtered }
    >();
    for (const entry of filtered) {
      const existing = map.get(entry.bookId);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(entry.bookId, {
          bookId: entry.bookId,
          bookTitle: entry.bookTitle ?? "Removed book",
          entries: [entry],
        });
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  const filteredAnnotations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return annotations.filter(annotation => {
      if (bookFilter !== ALL_BOOKS && String(annotation.bookId) !== bookFilter) return false;
      if (memoryView === "notes" && !annotation.note) return false;
      if (memoryView === "answers") return false;
      if (!needle) return true;
      return annotation.selectedText.toLowerCase().includes(needle) || (annotation.note ?? "").toLowerCase().includes(needle) || (annotation.bookTitle ?? "").toLowerCase().includes(needle);
    });
  }, [annotations, bookFilter, query, memoryView]);

  const showAnswers = memoryView === "all" || memoryView === "answers";
  const showAnnotations = memoryView !== "answers";
  const hasAnyMemory = entries.length + annotations.length > 0;
  const hasFilteredMemory = (showAnswers && filtered.length > 0) || (showAnnotations && filteredAnnotations.length > 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Notebook
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              Your highlights, personal notes, and saved explanations — all linked back to the book.
            </p>
          </div>
        </div>

        {/* Filters */}
        {hasAnyMemory && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2}
              />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search your notes…"
                className="h-9 bg-background pl-9 text-sm"
              />
            </div>
            <Select value={bookFilter} onValueChange={setBookFilter}>
              <SelectTrigger className="h-9 w-[13rem] bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BOOKS}>All books</SelectItem>
                {(booksQuery.data ?? []).map(book => (
                  <SelectItem key={book.id} value={String(book.id)}>
                    {book.title.length > 32 ? `${book.title.slice(0, 32)}…` : book.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hasAnyMemory && <div className="mt-4 inline-flex rounded-xl border border-border bg-muted/30 p-1" role="tablist" aria-label="Notebook memory type">{([{ key: "all", label: "All" }, { key: "highlights", label: "Highlights" }, { key: "notes", label: "My notes" }, { key: "answers", label: "AI explanations" }] as { key: MemoryView; label: string }[]).map(tab => <button key={tab.key} role="tab" aria-selected={memoryView === tab.key} onClick={() => setMemoryView(tab.key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${memoryView === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}</div>}

        {/* Entries */}
        <div className="mt-9">
          {loading || entriesQuery.isLoading || annotationsQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border/80 p-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-4 w-11/12" />
                  <Skeleton className="mt-2 h-4 w-9/12" />
                  <Skeleton className="mt-4 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-10/12" />
                </div>
              ))}
            </div>
          ) : !hasAnyMemory ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-6 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <NotebookPen className="h-5 w-5 text-primary" strokeWidth={1.7} />
              </span>
              <h2 className="mt-5 font-display text-xl font-semibold">
                Nothing saved yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                While reading, use <strong>Highlight</strong>, add a personal note, or save an AI explanation. What you keep will show up here, grouped by book.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/library">Go to library</Link>
              </Button>
            </div>
          ) : !hasFilteredMemory ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              No notes match that search.
            </p>
          ) : (
            <div className="space-y-10">
              {showAnnotations && filteredAnnotations.length > 0 && <section>
                <div className="mb-4 flex items-center gap-2.5"><Highlighter className="h-4 w-4 text-[var(--rb-evidence)]" strokeWidth={1.9} /><h2 className="font-display text-lg font-semibold">{memoryView === "notes" ? "My notes" : "Highlights and notes"}</h2><span className="text-xs text-muted-foreground">{filteredAnnotations.length}</span></div>
                <div className="space-y-3">{filteredAnnotations.map(annotation => <article key={annotation.id} className="rounded-xl border border-border/80 bg-card/60 p-4"><div className="flex items-center gap-2"><span className="rounded-full bg-[var(--rb-evidence-surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--rb-evidence)]">Highlight</span><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{annotation.bookTitle ?? "Removed book"}</span><Link href={`/read/${annotation.bookId}?page=${annotation.pageNumber}`} className="text-xs text-muted-foreground no-underline hover:text-primary hover:underline">page {annotation.pageNumber}</Link></div><blockquote className="mt-3 border-l-2 border-[var(--rb-evidence)]/45 pl-3 font-reading text-[0.95rem] italic leading-relaxed text-foreground/85">{annotation.selectedText}</blockquote>{annotation.note && <div className="mt-3 flex gap-2 rounded-lg bg-[var(--rb-evidence-surface)] px-3 py-2 text-sm leading-relaxed text-foreground"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rb-evidence)]" /><span>{annotation.note}</span></div>}</article>)}</div>
              </section>}
              {showAnswers && grouped.map(group => (
                <section key={group.bookId}>
                  <div className="mb-4 flex items-center gap-2.5">
                    <BookOpen className="h-4 w-4 text-primary" strokeWidth={1.9} />
                    <h2 className="font-display text-lg font-semibold">
                      {group.bookTitle}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {group.entries.length}{" "}
                      {group.entries.length === 1 ? "note" : "notes"}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {group.entries.map(entry => (
                      <article
                        key={entry.id}
                        className="group rounded-xl border border-border/80 bg-card/60 p-5 transition-shadow duration-200 hover:shadow-book">
                        <div className="flex items-center gap-2.5">
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary">
                            {MODE_LABELS[entry.mode] ?? entry.mode}
                          </span>
                          <Link
                            href={`/read/${entry.bookId}?page=${entry.pageNumber}`}
                            className="text-xs text-muted-foreground no-underline hover:text-primary hover:underline">
                            page {entry.pageNumber}
                          </Link>
                          <span className="text-xs text-muted-foreground/70">
                            {formatRelativeTime(entry.createdAt)}
                          </span>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete note"
                                className="ml-auto h-7 w-7 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display">
                                  Delete this note?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  The highlighted sentence and its answer will be
                                  removed from your notebook.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() =>
                                    removeMutation.mutate({ entryId: entry.id })
                                  }>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <blockquote className="mt-3.5 border-l-2 border-primary/40 pl-3.5 font-reading text-[0.95rem] italic leading-relaxed text-foreground/80">
                          {entry.highlight}
                        </blockquote>

                        {entry.question && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Asked:</span>{" "}
                            {entry.question}
                          </p>
                        )}

                        <div className="prose prose-sm mt-3.5 max-w-none text-[0.92rem] leading-relaxed text-foreground/90 prose-headings:font-display prose-p:my-2 prose-li:my-0.5 prose-strong:text-foreground">
                          <Streamdown>{entry.answer}</Streamdown>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
