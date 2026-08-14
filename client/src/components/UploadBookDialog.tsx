import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/format";
import { getBookBrainPresentation, isReadyToRead, type BookBrainPipelineStage } from "@/lib/bookBrainReadiness";
import { getFunnelVisitorId } from "@/lib/funnel";
import { buildPdfPreview, fileToBase64 } from "@/lib/pdfClient";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Check, FileText, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 40 * 1024 * 1024;
type Stage = "idle" | "reading" | "uploading" | "ready";
type ReadyBook = { bookId: number; title: string; pageCount: number };
const UNDERSTANDING_STEPS = ["Pages and reading structure", "People and ideas in this book", "Connections that matter", "Evidence paths back to the page"];

export function UploadBookDialog({ open, onOpenChange, onUploaded }: { open: boolean; onOpenChange: (open: boolean) => void; onUploaded: (bookId: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);
  const [readyBook, setReadyBook] = useState<ReadyBook | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const uploadMutation = trpc.books.upload.useMutation();
  const track = trpc.analytics.track.useMutation();
  const busy = stage === "reading" || stage === "uploading";
  const brainQuery = trpc.books.getBrain.useQuery(
    { bookId: readyBook?.bookId ?? 1 },
    { enabled: stage === "ready" && Boolean(readyBook), refetchInterval: query => (query.state.data?.passCompleted ?? 0) < 4 ? 3500 : false },
  );
  const presentation = getBookBrainPresentation({ passCompleted: brainQuery.data?.passCompleted ?? 0, pipelineStage: brainQuery.data?.pipelineStage as BookBrainPipelineStage | undefined });

  const reset = useCallback(() => {
    setFile(null); setTitle(""); setTitleTouched(false); setStage("idle"); setReadyBook(null); setUploadError(null);
  }, []);

  const acceptFile = useCallback((candidate: File | null | undefined) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !/\.pdf$/i.test(candidate.name)) { toast.error("Only PDF files can be uploaded."); return; }
    if (candidate.size > MAX_BYTES) { toast.error("That PDF is larger than 40 MB."); return; }
    setFile(candidate);
    setTitleTouched(false);
    setTitle(candidate.name.replace(/\.pdf$/i, "").replace(/[_+]+/g, " ").trim().slice(0, 200));
    setUploadError(null);
    track.mutate({ event: "pdf_selected", visitorId: getFunnelVisitorId(), metadata: { sizeBucket: candidate.size > 10 * 1024 * 1024 ? "large" : "standard" } });
  }, [track]);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    try {
      setUploadError(null);
      track.mutate({ event: "upload_started", visitorId: getFunnelVisitorId() });
      setStage("reading");
      const [preview, fileBase64] = await Promise.all([buildPdfPreview(file), fileToBase64(file)]);
      setStage("uploading");
      const result = await uploadMutation.mutateAsync({ filename: file.name, fileBase64, coverBase64: preview.coverDataUrl ?? undefined, title: titleTouched && title.trim() ? title.trim() : undefined });
      setReadyBook({ bookId: result.bookId, title: result.title, pageCount: result.pageCount });
      setStage("ready");
      track.mutate({ event: "ready_to_read", bookId: result.bookId, visitorId: getFunnelVisitorId() });
      await utils.books.list.invalidate();
      if (result.truncated) toast.info("Only the first 1200 pages were imported.");
    } catch (error) {
      setStage("idle");
      const message = error instanceof Error ? error.message : "Something went wrong during the upload.";
      setUploadError(message);
      toast.error(message);
    }
  }, [file, title, titleTouched, track, uploadMutation, utils]);

  const beginReading = useCallback(() => {
    if (!readyBook || !isReadyToRead(stage === "ready")) return;
    track.mutate({ event: "start_reading_clicked", bookId: readyBook.bookId, visitorId: getFunnelVisitorId() });
    onUploaded(readyBook.bookId); onOpenChange(false); reset();
  }, [onOpenChange, onUploaded, readyBook, reset, stage, track]);

  const activeIndex = presentation.activeIndex;
  const heading = uploadError ? "We couldn't read this copy." : stage === "ready" ? "Your book is ready." : busy ? "Preparing your book" : file ? "Review your book" : "Add a book";
  const description = uploadError
    ? "This PDF's structure could not be processed. Choose another copy or try this one again."
    : stage === "ready"
      ? "You can begin reading now. Deeper Book Brain work will continue in the background."
      : busy
        ? "ReadBuddy is preparing the first readable pages."
        : file ? "Check the title, then prepare this book for reading." : "Upload a text-based PDF. You can begin reading as soon as its first pages are ready.";

  return (
    <Dialog open={open} onOpenChange={next => { if (busy) return; onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto rounded-2xl border-border bg-[var(--rb-paper)] p-6 shadow-[0_1.5rem_4rem_color-mix(in_srgb,var(--rb-ink)_18%,transparent)] sm:p-9">
        <DialogHeader className="space-y-2 text-left">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--rb-evidence)]">ReadBuddy</p>
          <DialogTitle className="font-display text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-[2.25rem]">{heading}</DialogTitle>
          <DialogDescription className="max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-8 space-y-6">
          {!file && (
            <button type="button" onClick={() => inputRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }} className={`w-full rounded-xl border border-dashed p-8 text-left transition-colors ${dragging ? "border-[var(--rb-evidence)] bg-[var(--rb-evidence-surface)]" : "border-border bg-card/40 hover:border-[var(--rb-evidence)] hover:bg-[var(--rb-evidence-surface)]"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--rb-night)] text-[var(--rb-paper)]"><UploadCloud className="h-4 w-4" /></span>
              <span className="mt-5 block text-base font-semibold text-foreground">Choose a PDF</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Text-based PDF · Up to 40 MB</span>
            </button>
          )}

          {file && stage !== "ready" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4">
                <span className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-evidence-surface)] text-[var(--rb-evidence)]"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size)} · Text-based PDF</p></div>
                {!busy && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={reset} aria-label="Remove file"><X className="h-4 w-4" /></Button>}
              </div>
              {!busy && <div className="space-y-2"><Label htmlFor="book-title" className="text-xs font-semibold uppercase tracking-[.12em]">Book title <span className="font-normal normal-case tracking-normal text-muted-foreground">optional</span></Label><Input id="book-title" value={title} onChange={event => { setTitleTouched(true); setTitle(event.target.value); }} placeholder="Use the book title" className="h-11 rounded-lg border-border bg-background" /></div>}
              {busy && <div className="rounded-lg border-l-2 border-[var(--rb-evidence)] bg-[var(--rb-evidence-surface)] px-4 py-3" aria-live="polite"><p className="text-sm font-semibold text-foreground">{stage === "reading" ? "Preparing readable pages" : "Saving readable text"}</p><p className="mt-1 text-sm text-muted-foreground">You can begin reading before deeper connections are finished.</p></div>}
              {uploadError && <div className="rounded-lg border-l-2 border-destructive bg-destructive/5 px-4 py-3" role="alert"><p className="text-sm font-semibold text-destructive">We couldn't read this copy.</p><p className="mt-1 text-sm leading-relaxed text-destructive">{uploadError}</p></div>}
              {!busy && <Button className="h-11 w-full rounded-lg bg-primary text-primary-foreground hover:opacity-90" onClick={() => void handleSubmit()}>{uploadError ? "Try this book again" : "Prepare this book"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            </div>
          )}

          {stage === "ready" && readyBook && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card/50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--rb-evidence)]">Ready to read</p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-.035em] text-foreground">{readyBook.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{readyBook.pageCount} pages are ready. You can start with the first readable page now.</p>
                <Button className="mt-5 h-11 rounded-lg bg-primary px-5 text-primary-foreground hover:opacity-90" onClick={beginReading}>Open the first readable page<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
              <section className="border-t border-border pt-5" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{presentation.eyebrow}</p>
                <p className="mt-2 text-base font-semibold text-foreground">{presentation.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{presentation.detail}</p>
                <ol className="mt-5 space-y-3">
                  {UNDERSTANDING_STEPS.map((label, index) => {
                    const complete = presentation.kind === "complete" || index < activeIndex;
                    const active = index === activeIndex && presentation.kind !== "complete";
                    return <li key={label} className="flex items-center gap-3 text-sm"><span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${complete ? "border-[var(--rb-success)] bg-[var(--rb-success)] text-white" : active ? "border-[var(--rb-evidence)] text-[var(--rb-evidence)]" : "border-border text-muted-foreground"}`}>{complete ? <Check className="h-3 w-3" /> : active ? "→" : ""}</span><span className={complete || active ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>{active ? <span className="ml-auto text-xs text-muted-foreground">In progress</span> : null}</li>;
                  })}
                </ol>
              </section>
            </div>
          )}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => acceptFile(event.target.files?.[0])} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UploadBookDialog;
