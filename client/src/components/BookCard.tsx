import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime, progressPercent } from "@/lib/format";
import { ArrowUpRight, MoreHorizontal, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";

export type BookCardData = {
  id: number;
  title: string;
  author: string | null;
  coverUrl: string | null;
  pageCount: number;
  lastPage: number;
  lastOpenedAt: Date | null;
  createdAt: Date;
};

/** Deterministic spine tint so each coverless book still looks intentional. */
function tintFor(title: string) {
  const hues = [28, 48, 168, 212, 268, 336];
  let sum = 0;
  for (let i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  return hues[sum % hues.length];
}

export function BookCard({
  book,
  onDelete,
  deleting,
}: {
  book: BookCardData;
  onDelete: (bookId: number) => void;
  deleting?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const percent = progressPercent(book.lastPage, book.pageCount);
  const started = book.lastPage > 1;
  const hue = tintFor(book.title);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group relative">
      <Link
        href={`/read/${book.id}`}
        className="block no-underline"
        aria-label={`Open ${book.title}`}>
        {/* Cover */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.1rem] border border-[#17213e]/12 bg-muted shadow-[0_12px_22px_rgba(23,33,62,.13)] transition-all duration-300 group-hover:-translate-y-2 group-hover:rotate-[-1deg] group-hover:shadow-[0_22px_34px_rgba(23,33,62,.22)]">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col justify-between p-4"
              style={{
                background: `linear-gradient(150deg, oklch(0.93 0.045 ${hue}), oklch(0.82 0.08 ${hue}))`,
              }}>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/45">
                Your copy
              </span>
              <span className="font-display text-[1.05rem] font-semibold leading-tight text-foreground/80">
                {book.title.slice(0, 60)}
              </span>
            </div>
          )}

          {/* Progress ribbon */}
          {started && (
            <div className="absolute inset-x-0 bottom-0">
              <div className="h-1 w-full bg-foreground/12">
                <div
                  className="h-full bg-[#f2cc70] transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="mt-3 pr-7">
          <h3 className="line-clamp-2 font-display text-[1.05rem] font-semibold leading-snug text-[#17213e]">
            {book.title}
          </h3>
          {book.author && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {started ? (
              <>
                <span className="font-medium text-[#716cc0]">{percent}% read</span>
                <span className="mx-1.5 text-border">·</span>
                page {book.lastPage} of {book.pageCount}
              </>
            ) : (
              <>Waiting to be opened · {book.pageCount} pages</>
            )}
          </p>
          {book.lastOpenedAt && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/75">
              Read {formatRelativeTime(book.lastOpenedAt)}
            </p>
          )}
        </div>
      </Link>
      <span className="pointer-events-none absolute right-2 top-[calc(75%-1rem)] flex h-7 w-7 items-center justify-center rounded-full bg-[#fffaf1]/90 text-[#716cc0] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"><ArrowUpRight className="h-3.5 w-3.5" /></span>

      {/* Overflow menu */}
      <div className="absolute right-0 top-[calc(100%-4.6rem)] sm:top-auto sm:bottom-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`More options for ${book.title}`}>
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmOpen(true)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" strokeWidth={1.9} />
              Remove from library
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Remove this book?</AlertDialogTitle>
            <AlertDialogDescription>
              "{book.title}" and its notebook entries will be deleted. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(book.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export default BookCard;
