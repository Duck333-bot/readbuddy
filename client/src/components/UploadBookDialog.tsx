import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { buildPdfPreview, fileToBase64 } from "@/lib/pdfClient";
import { formatBytes } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { BrainCircuit, Check, FileText, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 40 * 1024 * 1024;

type Stage = "idle" | "reading" | "uploading" | "done";

const STAGE_COPY: Record<Stage, string> = {
  idle: "",
  reading: "I’m opening your book…",
  uploading: "I’m getting it ready to read together…",
  done: "Ready to read together.",
};

const BRAIN_STEPS = ["Understanding the chapters", "Meeting the characters", "Connecting the ideas", "Remembering important moments"];

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
  /** Tracks whether the reader edited the title, so an untouched field lets the
   * server prefer the PDF's own metadata title over the filename. */
  const [titleTouched, setTitleTouched] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.books.upload.useMutation();
  const busy = stage === "reading" || stage === "uploading";

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setTitleTouched(false);
    setStage("idle");
    setProgress(0);
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
    setTitle(
      candidate.name
        .replace(/\.pdf$/i, "")
        .replace(/[_+]+/g, " ")
        .trim()
        .slice(0, 200),
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    try {
      setStage("reading");
      setProgress(12);
      const [preview, fileBase64] = await Promise.all([
        buildPdfPreview(file),
        fileToBase64(file),
      ]);
      setProgress(38);
      setStage("uploading");

      const result = await uploadMutation.mutateAsync({
        filename: file.name,
        fileBase64,
        coverBase64: preview.coverDataUrl ?? undefined,
        // Only send an explicit title when the reader typed one; otherwise the
        // server uses the PDF's metadata title and falls back to the filename.
        title: titleTouched && title.trim() ? title.trim() : undefined,
      });

      setProgress(100);
      setStage("done");
      await utils.books.list.invalidate();
      toast.success(`"${result.title}" is ready — ${result.pageCount} pages.`);
      if (result.truncated) {
        toast.info("Only the first 1200 pages were imported.");
      }
      onUploaded(result.bookId);
      onOpenChange(false);
      reset();
    } catch (error) {
      setStage("idle");
      setProgress(0);
      const message =
        error instanceof Error ? error.message : "Something went wrong during the upload.";
      toast.error(message);
    }
  }, [file, title, titleTouched, uploadMutation, utils, onUploaded, onOpenChange, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (busy) return;
        onOpenChange(next);
        if (!next) reset();
      }}>
      <DialogContent className="overflow-hidden border-[#716cc0]/15 bg-[#fffaf1] sm:max-w-lg">
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#ece6ff] blur-2xl" />
        <DialogHeader>
          <DialogTitle className="relative font-display text-2xl text-[#17213e]">Bring a book into your world</DialogTitle>
          <DialogDescription>
            Drop in a text-based PDF. ReadBuddy will get to know it while you start reading.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={event => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              acceptFile(event.dataTransfer.files?.[0]);
            }}
            className={`relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ${
              dragging
                ? "border-[#716cc0] bg-[#ece6ff]/70"
                : "border-[#cfc7ee] bg-white/70 hover:-translate-y-0.5 hover:border-[#8e85ce] hover:bg-[#f8f5ff]"
            }`}>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18243d] text-[#f7d77e] shadow-[0_10px_22px_rgba(24,36,61,.18)]"><UploadCloud className="h-6 w-6" strokeWidth={1.7} /></span>
            <span className="font-display text-xl font-semibold text-[#17213e]">Drop a book here</span>
            <span className="max-w-xs text-sm leading-relaxed text-[#65718b]">or choose a PDF from your computer. Selectable text works best.</span>
            <span className="rounded-full bg-[#f5d9cf] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[#9d5548]">Up to 40 MB</span>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-[#716cc0]/15 bg-white/75 p-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ece6ff]">
                <FileText className="h-5 w-5 text-[#625cad]" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {!busy && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Remove file"
                  onClick={reset}>
                  <X className="h-4 w-4" strokeWidth={2} />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="book-title">
                Title <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="book-title"
                value={title}
                disabled={busy}
                onChange={event => {
                  setTitleTouched(true);
                  setTitle(event.target.value);
                }}
                placeholder="How the book should appear in your library"
              />
              <p className="text-xs text-muted-foreground">
                Leave this as-is and ReadBuddy will use the title stored inside the
                PDF when it has one.
              </p>
            </div>

            {busy && (<div className="rounded-2xl border border-[#716cc0]/15 bg-[#f7f4ff] p-4"><p className="flex items-center gap-2 font-display text-lg font-semibold text-[#28365a]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#716cc0] text-white"><BrainCircuit className="h-3.5 w-3.5" /></span>{STAGE_COPY[stage]}</p><p className="mt-2 text-xs leading-relaxed text-[#68728a]">You can begin reading as soon as the text is ready. The deeper connections continue quietly in the background.</p><Progress value={progress} className="mt-4 h-1.5 bg-[#ded9f2]" /> <div className="mt-4 grid gap-2 sm:grid-cols-2">{BRAIN_STEPS.map((step, index) => { const complete = progress >= 38 + index * 16; const active = !complete && index === Math.min(3, Math.floor(Math.max(0, progress - 38) / 16)); return <div key={step} className={`flex items-center gap-2 text-xs ${complete ? "text-[#5d579f]" : active ? "text-[#28365a]" : "text-[#8c93a5]"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{step}</div>; })}</div></div>)}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={event => acceptFile(event.target.files?.[0])}
        />

        <DialogFooter>
          <Button
            variant="outline"
            className="bg-background"
            disabled={busy}
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!file || busy} onClick={() => void handleSubmit()}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                Working…
              </>
            ) : (
              "Add to library"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadBookDialog;
