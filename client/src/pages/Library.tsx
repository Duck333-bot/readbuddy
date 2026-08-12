import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import BookCard from "@/components/BookCard";
import UploadBookDialog from "@/components/UploadBookDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { progressPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookOpen, Library as LibraryIcon, Plus, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
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
      <div className="relative mx-auto max-w-7xl overflow-hidden px-5 py-12 sm:px-8 sm:py-16">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--rb-violet)]">Your private collection</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em] text-[var(--rb-ink)] sm:text-6xl">
              Good morning.
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
          <Button className="relative h-11 gap-2 rounded-xl bg-[var(--rb-ink)] px-5 text-[var(--rb-paper)] shadow-none hover:bg-[#24335e]" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Add a book
          </Button>
        </div>

        {/* Continue reading */}
        {continueReading && (
          <Link
            href={`/read/${continueReading.id}`}
            className="relative mt-12 flex items-center gap-5 overflow-hidden rounded-[1.125rem] bg-[var(--rb-night)] p-5 text-[var(--rb-paper)] no-underline transition-transform duration-200 hover:-translate-y-0.5 sm:p-7">
            <div className="relative h-[7.5rem] w-[5.4rem] shrink-0 overflow-hidden rounded-[0.65rem] border border-white/20 bg-[#243864] shadow-[10px_12px_0_rgba(255,210,105,.16)]">
              {continueReading.coverUrl ? (
                <img
                  src={continueReading.coverUrl}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#243864]">
                  <BookOpen className="h-5 w-5 text-[var(--rb-sun)]" strokeWidth={1.7} />
                </div>
              )}
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rb-sun)]">
                Continue your journey
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-semibold text-white">
                {continueReading.title}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-[var(--rb-sun)]"
                    style={{
                      width: `${progressPercent(
                        continueReading.lastPage,
                        continueReading.pageCount,
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-[#c9d3ed]">
                  page {continueReading.lastPage} of {continueReading.pageCount}
                </span>
              </div>
            </div>
            <Button variant="outline" className="relative hidden rounded-lg border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex">
              Resume <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        )}

        {/* Grid */}
        <div className="mt-10">
          {booksQuery.isLoading ? (
            <LibrarySkeleton />
          ) : books.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="border-y border-border px-6 py-16 text-center sm:px-12 sm:py-24">
              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rb-night)] text-[var(--rb-sun)]"><LibraryIcon className="h-6 w-6" strokeWidth={1.6} /></span>
              <h2 className="relative mt-6 font-display text-4xl font-semibold tracking-[-.05em] text-[var(--rb-ink)]">Your collection begins here.</h2>
              <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Bring a book you want to understand deeply. Start reading as soon as the text is ready; the deeper connections keep forming quietly.</p>
              <Button className="relative mt-7 h-11 gap-2 rounded-xl bg-[var(--rb-ink)] px-6 text-[var(--rb-paper)] hover:bg-[#24335e]" onClick={() => setUploadOpen(true)}><Sparkles className="h-4 w-4 text-[var(--rb-sun)]" /> Add your first book</Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
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
