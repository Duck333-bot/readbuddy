import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildPdfPreview, fileToBase64 } from "@/lib/pdfClient";
import { formatBytes } from "@/lib/format";
import { getBookBrainPresentation, isReadyToRead, type BookBrainPresentation, type BookBrainPipelineStage } from "@/lib/bookBrainReadiness";
import { getFunnelVisitorId } from "@/lib/funnel";
import { trpc } from "@/lib/trpc";
import { MarginMark, type MarginMarkKind } from "@/components/marketing/MarginMark";
import {
  ArrowRight,
  Check,
  FileText,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 40 * 1024 * 1024;

type Stage = "idle" | "reading" | "uploading" | "ready";
type ReadyBook = { bookId: number; title: string; pageCount: number };

const UNDERSTANDING_STEPS: { label: string; mark: MarginMarkKind }[] = [
	{ label: "Pages understood", mark: "memory" },
	{ label: "Structure, people & ideas", mark: "context" },
	{ label: "Connections", mark: "evidence" },
	{ label: "Evidence paths", mark: "return" },
];

function BookTerrain({
  mode,
  title,
  pageCount,
  presentation,
}: {
	mode: "empty" | "selected" | "preparing" | "ready" | "failure";
  title?: string;
  pageCount?: number;
  presentation?: BookBrainPresentation;
}) {
	const activeIndex = presentation?.activeIndex ?? (mode === "preparing" ? 0 : -1);
	const visibleCount = mode === "empty" ? 1 : mode === "selected" ? 2 : mode === "preparing" ? 3 : mode === "failure" ? 0 : 4;
	const bookState = mode === "empty"
		? "Your next book"
		: mode === "selected"
			? "A file becoming a book"
			: mode === "preparing"
				? "Making it readable"
				: mode === "ready"
					? "Ready to begin"
					: "Needs another copy";

  return (
    <div className={`rb-upload-terrain rb-upload-terrain--${mode}`} data-brain-kind={presentation?.kind}>
      <span className="rb-upload-field rb-upload-field--blush" />
      <span className="rb-upload-field rb-upload-field--mint" />
      <span className="rb-upload-field rb-upload-field--periwinkle" />
			<div className="rb-upload-book" aria-hidden="true">
				<span className="rb-upload-book__eyebrow">{bookState}</span>
        <span className="rb-upload-book__line rb-upload-book__line--one" />
        <span className="rb-upload-book__line rb-upload-book__line--two" />
        <span className="rb-upload-book__line rb-upload-book__line--three" />
        <span className="rb-upload-book__title">{title?.slice(0, 25) || "A book"}</span>
				{pageCount ? <span className="rb-upload-book__pages">{pageCount} readable pages</span> : null}
      </div>
      <div className="rb-upload-fragments" aria-hidden="true">
        {UNDERSTANDING_STEPS.slice(0, visibleCount).map((item, index) => {
          const complete = mode === "ready" && (presentation?.kind === "complete" || index < activeIndex);
          const active = index === activeIndex && presentation?.kind !== "complete";
          return (
            <div key={item.label} className={`rb-upload-fragment rb-upload-fragment--${index + 1} ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`}>
              <MarginMark kind={item.mark} className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
      {mode === "ready" && presentation && presentation.activeIndex >= 2 ? <span className="rb-upload-thread" aria-hidden="true" /> : null}
    </div>
  );
}

export function UploadBookDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (bookId: number) => void;
}) {
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
    {
      enabled: stage === "ready" && Boolean(readyBook),
      refetchInterval: query => (query.state.data?.passCompleted ?? 0) < 4 ? 3500 : false,
    },
  );
  const passCompleted = brainQuery.data?.passCompleted ?? 0;
  const presentation = getBookBrainPresentation({
    passCompleted,
    pipelineStage: brainQuery.data?.pipelineStage as BookBrainPipelineStage | undefined,
  });

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setTitleTouched(false);
    setStage("idle");
    setReadyBook(null);
    setUploadError(null);
  }, []);

  const acceptFile = useCallback((candidate: File | null | undefined) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !/\.pdf$/i.test(candidate.name)) {
      toast.error("Only PDF files can be uploaded.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      toast.error("That PDF is larger than 40 MB.");
      return;
    }
    setFile(candidate);
    setTitleTouched(false);
    setTitle(candidate.name.replace(/\.pdf$/i, "").replace(/[_+]+/g, " ").trim().slice(0, 200));
    setUploadError(null);
    track.mutate({ event: "pdf_selected", visitorId: getFunnelVisitorId(), metadata: { sizeBucket: candidate.size > 10 * 1024 * 1024 ? "large" : "standard" } });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    try {
      setUploadError(null);
      track.mutate({ event: "upload_started", visitorId: getFunnelVisitorId() });
      setStage("reading");
      const [preview, fileBase64] = await Promise.all([buildPdfPreview(file), fileToBase64(file)]);
      setStage("uploading");
      const result = await uploadMutation.mutateAsync({
        filename: file.name,
        fileBase64,
        coverBase64: preview.coverDataUrl ?? undefined,
        title: titleTouched && title.trim() ? title.trim() : undefined,
      });
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
  }, [file, title, titleTouched, uploadMutation, utils]);

  const beginReading = useCallback(() => {
    if (!readyBook || !isReadyToRead(stage === "ready")) return;
    track.mutate({ event: "start_reading_clicked", bookId: readyBook.bookId, visitorId: getFunnelVisitorId() });
    onUploaded(readyBook.bookId);
    onOpenChange(false);
    reset();
  }, [onOpenChange, onUploaded, readyBook, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (busy) return;
        onOpenChange(next);
        if (!next) reset();
      }}>
		<DialogContent className="rb-upload-dialog h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-[var(--rb-paper)] p-0 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none sm:rounded-[2rem] sm:border sm:border-border">
        <div className="rb-upload-layout h-full overflow-y-auto lg:grid lg:grid-cols-[1.02fr_0.98fr]">
          <section className="rb-upload-stage relative min-h-[31rem] overflow-hidden bg-[var(--rb-night)] px-6 pb-8 pt-10 text-[var(--rb-paper)] sm:px-10 sm:pt-12 lg:min-h-0 lg:px-14 lg:py-14">
            <div className="relative z-10 max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--rb-sun)]">ReadBuddy / Understanding a book</p>
				<h2 className="mt-4 max-w-xl font-display text-[1.85rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[2.15rem]">
					{uploadError ? "We couldn't read this copy." : stage === "ready" ? "Your book is ready to begin." : busy ? "The book is becoming readable." : file ? "Your book is taking shape." : "Give ReadBuddy a book."}
				</h2>
				<p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--rb-on-night-muted)] sm:text-base">
					{uploadError
						? "This PDF's structure could not be processed. Choose another copy or try this one again."
						: stage === "ready"
						? "Open the first readable page now. The deeper understanding keeps forming quietly around it."
                  : busy
                    ? "First, ReadBuddy prepares the book you can read. The deeper work comes after that."
                    : file
                      ? "ReadBuddy will organize the text, people, ideas, and evidence inside this book—not information about you."
                      : "Start with the book itself. ReadBuddy will build understanding around the pages as you read."}
              </p>
            </div>
			<BookTerrain mode={uploadError ? "failure" : stage === "ready" ? "ready" : busy ? "preparing" : file ? "selected" : "empty"} title={readyBook?.title ?? title} pageCount={readyBook?.pageCount} presentation={stage === "ready" ? presentation : undefined} />
          </section>

          <section className="flex min-h-0 items-center bg-[var(--rb-paper)] px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
            <div className="mx-auto w-full max-w-lg">
              {!file && (
                <>
                  <DialogHeader className="sr-only"><DialogTitle>Give ReadBuddy a book</DialogTitle><DialogDescription>Upload a text-based PDF.</DialogDescription></DialogHeader>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={event => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={event => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
                    className={`group rb-upload-dropzone w-full text-left transition-colors ${dragging ? "is-dragging" : ""}`}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--rb-night)] text-[var(--rb-sun)] transition-transform duration-200 group-hover:scale-105"><UploadCloud className="h-5 w-5" strokeWidth={1.8} /></span>
					<span className="mt-7 block font-display text-3xl font-semibold tracking-[-.04em] text-foreground">Bring in a book</span>
                    <span className="mt-3 block max-w-sm text-sm leading-relaxed text-muted-foreground">Choose a text-based PDF from your computer. You can begin reading as soon as the first usable pages are ready.</span>
                    <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--rb-evidence)]">Choose your book <ArrowRight className="h-4 w-4" /></span>
                  </button>
                </>
              )}

              {file && stage !== "ready" && (
                <div className="space-y-8">
                  <div className="flex items-center gap-4 border-b border-border pb-5">
                    <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-[.55rem] bg-[var(--rb-evidence-surface)] text-[var(--rb-evidence)]"><FileText className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size)} · Text-based PDF</p></div>
                    {!busy && <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={reset} aria-label="Remove file"><X className="h-4 w-4" /></Button>}
                  </div>
                  {!busy && <div className="space-y-2"><Label htmlFor="book-title" className="text-xs font-bold uppercase tracking-[.14em]">Book title <span className="font-normal normal-case tracking-normal text-muted-foreground">optional</span></Label><Input id="book-title" value={title} onChange={event => { setTitleTouched(true); setTitle(event.target.value); }} placeholder="Use the book title" className="h-12 rounded-xl border-border bg-card" /></div>}
					{busy && <div className="rb-upload-working" aria-live="polite"><MarginMark kind="memory" className="h-5 w-5 text-[var(--rb-evidence)]" /><div><p className="font-display text-2xl font-semibold tracking-[-.035em] text-foreground">{stage === "reading" ? "Preparing readable pages" : "Saving readable text"}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">You can begin reading before the deeper connections are finished.</p></div></div>}
					{uploadError && <div className="rb-upload-error" role="alert"><MarginMark kind="return" className="h-5 w-5 shrink-0" /><div><p className="font-display text-2xl font-semibold tracking-[-.035em]">We couldn't read this copy.</p><p className="mt-2 text-sm leading-relaxed">This PDF's structure could not be processed. {uploadError}</p></div></div>}
                  {!busy && <Button className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:opacity-90" onClick={() => void handleSubmit()}>{uploadError ? "Try this book again" : "Prepare this book"} <ArrowRight className="ml-2 h-4 w-4" /></Button>}
                </div>
              )}

              {stage === "ready" && readyBook && (
					<div className="space-y-8">
						<div className="border-b border-border pb-7"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-evidence)]">Ready to begin reading</p><h3 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-foreground">{readyBook.title}</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{readyBook.pageCount} pages are ready. Deeper understanding can continue without holding up your first chapter.</p><Button className="mt-6 h-12 rounded-xl bg-primary px-6 text-primary-foreground hover:opacity-90" onClick={beginReading}>Open the first readable page <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
						<div className="rb-upload-brain"><div className="flex items-start gap-3"><MarginMark kind={presentation.kind === "connections" ? "context" : presentation.kind === "evidence" ? "evidence" : presentation.kind === "complete" ? "return" : "memory"} className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rb-evidence)]" /><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">{presentation.eyebrow}</p><p className="mt-2 font-display text-2xl font-semibold tracking-[-.035em] text-foreground">{presentation.title}</p><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{presentation.detail}</p></div></div><ol className="mt-7 rb-upload-understanding-orbit">{UNDERSTANDING_STEPS.map((item, index) => { const complete = presentation.kind === "complete" || index < presentation.activeIndex; const active = index === presentation.activeIndex && presentation.kind !== "complete"; return <li key={item.label} className={`rb-upload-understanding-step ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`}><MarginMark kind={item.mark} className="h-4 w-4" /><span>{item.label}</span>{complete ? <Check className="ml-auto h-4 w-4" /> : null}</li>; })}</ol></div>
                </div>
              )}
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => acceptFile(event.target.files?.[0])} />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UploadBookDialog;
