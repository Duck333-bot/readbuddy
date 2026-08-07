import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import BookCard from "@/components/BookCard";
import UploadBookDialog from "@/components/UploadBookDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { progressPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { BookOpen, Library as LibraryIcon, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <Skeleton className="mt-3 h-4 w-4/5" />
          <Skeleton className="mt-2 h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export default function Library() {
  const { isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const utils = trpc.useUtils();

  const booksQuery = trpc.books.list.useQuery(undefined, { enabled: isAuthenticated });
  const notebookCount = trpc.notebook.count.useQuery(undefined, { enabled: isAuthenticated });

  const removeMutation = trpc.books.remove.useMutation({
    onSuccess: async () => {
      toast.success("Book removed.");
      await utils.books.list.invalidate();
      await utils.notebook.count.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const books = booksQuery.data ?? [];

  const continueReading = useMemo(
    () =>
      books
        .filter(book => book.lastPage > 1 && progressPercent(book.lastPage, book.pageCount) < 100)
        .slice(0, 1)[0],
    [books],
  );

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <LibrarySkeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your library
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              {books.length === 0
                ? "Nothing here yet — add your first book."
                : `${books.length} book${books.length === 1 ? "" : "s"}${
                    notebookCount.data
                      ? ` · ${notebookCount.data} notebook ${
                          notebookCount.data === 1 ? "entry" : "entries"
                        }`
                      : ""
                  }`}
            </p>
          </div>
          <Button className="gap-2 shadow-book" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Add a book
          </Button>
        </div>

        {/* Continue reading */}
        {continueReading && (
          <Link
            href={`/read/${continueReading.id}`}
            className="mt-9 flex items-center gap-5 rounded-2xl border border-border/80 bg-card/70 p-5 no-underline transition-shadow duration-200 hover:shadow-book">
            <div className="h-[5.5rem] w-[4.15rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-muted">
              {continueReading.coverUrl ? (
                <img
                  src={continueReading.coverUrl}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary/70" strokeWidth={1.7} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Continue reading
              </p>
              <h2 className="mt-1 truncate font-display text-lg font-semibold">
                {continueReading.title}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${progressPercent(
                        continueReading.lastPage,
                        continueReading.pageCount,
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  page {continueReading.lastPage} of {continueReading.pageCount}
                </span>
              </div>
            </div>
            <Button variant="outline" className="hidden bg-background sm:inline-flex">
              Resume
            </Button>
          </Link>
        )}

        {/* Grid */}
        <div className="mt-10">
          {booksQuery.isLoading ? (
            <LibrarySkeleton />
          ) : books.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-6 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <LibraryIcon className="h-5 w-5 text-primary" strokeWidth={1.7} />
              </span>
              <h2 className="mt-5 font-display text-xl font-semibold">
                Your shelf is empty
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Upload a PDF and ReadBuddy will pull out the text page by page, then
                sit beside you while you read it. Highlight any sentence to ask what
                it means.
              </p>
              <Button className="mt-6 gap-2" onClick={() => setUploadOpen(true)}>
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Add your first book
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
              {books.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  deleting={removeMutation.isPending}
                  onDelete={bookId => removeMutation.mutate({ bookId })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <UploadBookDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={bookId => navigate(`/read/${bookId}`)}
      />
    </AppShell>
  );
}

