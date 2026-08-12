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
import { getBrainStepState, isBookBrainComplete, isReadyToRead } from "@/lib/bookBrainReadiness";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 40 * 1024 * 1024;

type Stage = "idle" | "reading" | "uploading" | "ready";
type ReadyBook = { bookId: number; title: string; pageCount: number };

const BRAIN_STEPS = [
  "Understanding chapters",
  "Meeting the characters",
  "Mapping important ideas",
  "Connecting distant moments",
];

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
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [readyBook, setReadyBook] = useState<ReadyBook | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const uploadMutation = trpc.books.upload.useMutation();
  const busy = stage === "reading" || stage === "uploading";

  const brainQuery = trpc.books.getBrain.useQuery(
    { bookId: readyBook?.bookId ?? 1 },
    {
      enabled: stage === "ready" && Boolean(readyBook),
      refetchInterval: query => (query.state.data?.passCompleted ?? 0) < 4 ? 3500 : false,
    },
  );
  const passCompleted = brainQuery.data?.passCompleted ?? 0;
  const fullyUnderstood = isBookBrainComplete(passCompleted);

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setTitleTouched(false);
    setStage("idle");
    setProgress(0);
    setReadyBook(null);
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
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    try {
      setStage("reading");
      setProgress(12);
      const [preview, fileBase64] = await Promise.all([buildPdfPreview(file), fileToBase64(file)]);
      setProgress(52);
      setStage("uploading");
      const result = await uploadMutation.mutateAsync({
        filename: file.name,
        fileBase64,
        coverBase64: preview.coverDataUrl ?? undefined,
        title: titleTouched && title.trim() ? title.trim() : undefined,
      });
      setProgress(100);
      setReadyBook({ bookId: result.bookId, title: result.title, pageCount: result.pageCount });
      setStage("ready");
      await utils.books.list.invalidate();
      if (result.truncated) toast.info("Only the first 1200 pages were imported.");
    } catch (error) {
      setStage("idle");
      setProgress(0);
      toast.error(error instanceof Error ? error.message : "Something went wrong during the upload.");
    }
  }, [file, title, titleTouched, uploadMutation, utils]);

  const beginReading = useCallback(() => {
    if (!readyBook || !isReadyToRead(stage === "ready")) return;
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
      <DialogContent className="h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-[#fff9ef] p-0 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-[2rem] sm:border sm:border-border">
        <div className="grid h-full overflow-y-auto lg:grid-cols-[0.92fr_1.08fr]">
          <section className="relative flex min-h-[18rem] flex-col justify-between overflow-hidden bg-[#08122e] p-7 text-[#fff9ef] sm:p-10 lg:min-h-0 lg:p-14">
            <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_76%_30%,rgba(101,87,232,.34),transparent_27%),radial-gradient(circle_at_32%_74%,rgba(70,184,232,.14),transparent_32%)]" />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffd269]">ReadBuddy / Book Brain</p>
              <h2 className="mt-5 max-w-sm font-display text-4xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-5xl">
                {stage === "ready" ? "Your book is ready." : "Give ReadBuddy a book."}
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#c9d3ed] sm:text-base">
                {stage === "ready"
                  ? "Start reading now. I’ll keep learning the book quietly in the background."
                  : "Text first. Deeper understanding keeps growing while you read."}
              </p>
            </div>
            <div className="relative mt-8 hidden lg:block">
              <div className="relative mx-auto h-44 w-32 rotate-[-5deg] rounded-[0.65rem] border border-white/20 bg-gradient-to-br from-[#6557e8] via-[#243864] to-[#08122e] shadow-[16px_18px_0_rgba(255,210,105,.18)]">
                <span className="absolute inset-x-5 top-8 h-px bg-white/30" />
                <span className="absolute inset-x-5 top-12 h-px bg-white/20" />
                <span className="absolute inset-x-5 top-16 h-px bg-white/20" />
                <span className="absolute bottom-7 left-5 text-[9px] font-bold uppercase tracking-[.2em] text-[#ffd269]">YOUR BOOK</span>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 items-center px-6 py-8 sm:px-10 sm:py-12 lg:px-16">
            <div className="mx-auto w-full max-w-xl">
              {!file && (
                <>
                  <DialogHeader className="sr-only"><DialogTitle>Give ReadBuddy a book</DialogTitle><DialogDescription>Upload a text-based PDF.</DialogDescription></DialogHeader>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={event => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={event => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
                    className={`group w-full border-b-2 px-2 py-16 text-left transition-colors sm:px-5 sm:py-20 ${dragging ? "border-[#6557e8] bg-[#f1efff]" : "border-[#e5decf] hover:border-[#6557e8]"}`}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#08122e] text-[#ffd269] transition-transform duration-200 group-hover:scale-105"><UploadCloud className="h-5 w-5" strokeWidth={1.8} /></span>
                    <span className="mt-7 block font-display text-3xl font-semibold tracking-[-.04em] text-[#131c38]">Drop in a PDF</span>
                    <span className="mt-3 block max-w-sm text-sm leading-relaxed text-[#68708a]">Or choose one from your computer. Text-based PDFs work best. Up to 40 MB.</span>
                    <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#6557e8]">Choose a book <ArrowRight className="h-4 w-4" /></span>
                  </button>
                </>
              )}

              {file && stage !== "ready" && (
                <div className="space-y-8">
                  <div className="flex items-center gap-4 border-b border-[#e5decf] pb-5">
                    <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-md bg-[#ebe8ff] text-[#6557e8]"><FileText className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#131c38]">{file.name}</p><p className="mt-1 text-xs text-[#68708a]">{formatBytes(file.size)}</p></div>
                    {!busy && <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={reset} aria-label="Remove file"><X className="h-4 w-4" /></Button>}
                  </div>
                  {!busy && <div className="space-y-2"><Label htmlFor="book-title" className="text-xs font-bold uppercase tracking-[.14em]">Book title <span className="font-normal normal-case tracking-normal text-muted-foreground">optional</span></Label><Input id="book-title" value={title} onChange={event => { setTitleTouched(true); setTitle(event.target.value); }} placeholder="Use the book title" className="h-12 rounded-xl border-[#e5decf] bg-white" /></div>}
                  {busy && <div className="space-y-6"><div><p className="font-display text-3xl font-semibold tracking-[-.04em] text-[#131c38]">{stage === "reading" ? "Reading the text…" : "Preparing your book…"}</p><p className="mt-2 text-sm text-[#68708a]">Reading will open as soon as basic structure is ready.</p></div><div className="h-px w-full overflow-hidden bg-[#e5decf]"><div className="h-full bg-[#6557e8] transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>}
                  {!busy && <Button className="h-12 w-full rounded-xl bg-[#131c38] text-[#fff9ef] hover:bg-[#24335e]" onClick={() => void handleSubmit()}>Read this book <ArrowRight className="ml-2 h-4 w-4" /></Button>}
                </div>
              )}

              {stage === "ready" && readyBook && (
                <div className="space-y-7">
                  <div className="border-b border-[#e5decf] pb-6"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#6557e8]">Ready to read</p><h3 className="mt-3 font-display text-4xl font-semibold tracking-[-.05em] text-[#131c38]">{readyBook.title}</h3><p className="mt-3 text-sm leading-relaxed text-[#68708a]">{readyBook.pageCount} pages are ready. ReadBuddy is still getting to know the whole book.</p><Button className="mt-6 h-12 rounded-xl bg-[#131c38] px-6 text-[#fff9ef] hover:bg-[#24335e]" onClick={beginReading}>Start reading <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
                  <div><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#68708a]">Book Brain continues</p>{fullyUnderstood && <span className="text-xs font-semibold text-[#26866b]">I know this book now.</span>}</div><div className="mt-4 space-y-3">{BRAIN_STEPS.map((step, index) => { const stepState = getBrainStepState(passCompleted, index); const complete = stepState === "complete"; const active = stepState === "active"; return <div key={step} className="flex items-center gap-3 text-sm"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${complete ? "bg-[#dff4eb] text-[#26866b]" : active ? "bg-[#ebe8ff] text-[#6557e8]" : "bg-[#f2ecdf] text-[#9ba3b5]"}`}>{complete ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="text-[10px]">•</span>}</span><span className={complete ? "text-[#3c4f69]" : "text-[#68708a]"}>{step}</span></div>; })}</div></div>
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
