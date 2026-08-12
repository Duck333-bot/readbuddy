import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import BookCard from "@/components/BookCard";
import UploadBookDialog from "@/components/UploadBookDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { progressPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookOpen, Library as LibraryIcon, Plus, Sparkles, Stars } from "lucide-react";
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
      <div className="relative mx-auto max-w-7xl overflow-hidden px-5 py-10 sm:px-8 sm:py-14">
        <div className="pointer-events-none absolute -right-20 top-4 h-64 w-64 rounded-full bg-[#ece6ff]/70 blur-3xl" />
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#716cc0]">Your reading worlds</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.04em] text-[#17213e] sm:text-5xl">
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
          <Button className="relative gap-2 rounded-full bg-[#17213e] px-5 text-white shadow-[0_10px_22px_rgba(23,33,62,.18)] hover:bg-[#2a3a60]" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Add a book
          </Button>
        </div>

        {/* Continue reading */}
        {continueReading && (
          <Link
            href={`/read/${continueReading.id}`}
            className="relative mt-10 flex items-center gap-5 overflow-hidden rounded-[1.75rem] border border-[#716cc0]/15 bg-[#18243d] p-5 text-[#fffaf1] no-underline shadow-[0_18px_42px_rgba(23,33,62,.16)] transition-transform duration-300 hover:-translate-y-0.5 sm:p-6">
            <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-[#716cc0]/30 blur-2xl" />
            <div className="relative h-[6.3rem] w-[4.7rem] shrink-0 overflow-hidden rounded-lg border border-white/20 bg-[#2e3e65] shadow-[0_10px_20px_rgba(0,0,0,.24)]">
              {continueReading.coverUrl ? (
                <img
                  src={continueReading.coverUrl}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#716cc0]/30">
                  <BookOpen className="h-5 w-5 text-[#f7d77e]" strokeWidth={1.7} />
                </div>
              )}
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f7d77e]">
                Continue your journey
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-semibold text-white">
                {continueReading.title}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-[#f7d77e]"
                    style={{
                      width: `${progressPercent(
                        continueReading.lastPage,
                        continueReading.pageCount,
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-[#ced8ee]">
                  page {continueReading.lastPage} of {continueReading.pageCount}
                </span>
              </div>
            </div>
            <Button variant="outline" className="relative hidden rounded-full border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex">
              Resume <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        )}

        {/* Grid */}
        <div className="mt-10">
          {booksQuery.isLoading ? (
            <LibrarySkeleton />
          ) : books.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] border border-[#716cc0]/15 bg-gradient-to-br from-[#f5f0ff] via-[#fffdf8] to-[#f7ddd5] px-6 py-14 text-center shadow-[0_18px_45px_rgba(71,57,125,.08)] sm:px-12 sm:py-20">
              <div className="absolute left-10 top-8 h-24 w-16 -rotate-12 rounded-t-[1rem] rounded-b-sm bg-[#e27f73]/85 shadow-[8px_9px_0_rgba(132,111,188,.16)]" /><div className="absolute right-12 top-14 h-28 w-20 rotate-12 rounded-t-[1.15rem] rounded-b-sm bg-[#7fbbd4]/85 shadow-[-8px_9px_0_rgba(247,215,126,.22)]" />
              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18243d] text-[#f7d77e] shadow-[0_12px_24px_rgba(23,33,62,.18)]"><LibraryIcon className="h-6 w-6" strokeWidth={1.6} /></span>
              <h2 className="relative mt-6 font-display text-3xl font-semibold tracking-[-.03em] text-[#17213e]">Your shelf is waiting.</h2>
              <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#63708a]">Bring a book you are curious about. ReadBuddy will learn its world while you make it your own.</p>
              <Button className="relative mt-7 gap-2 rounded-full bg-[#18243d] px-6 text-white hover:bg-[#2b3b62]" onClick={() => setUploadOpen(true)}><Stars className="h-4 w-4 text-[#f7d77e]" /> Add your first book</Button>
            </motion.div>
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
