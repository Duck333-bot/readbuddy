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
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 40 * 1024 * 1024;

type Stage = "idle" | "reading" | "uploading" | "done";

const STAGE_COPY: Record<Stage, string> = {
  idle: "",
  reading: "Reading the PDF and rendering the cover…",
  uploading: "Extracting text page by page…",
  done: "Finished",
};

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add a book</DialogTitle>
          <DialogDescription>
            Upload a PDF with selectable text. Scanned books, where the pages are
            images, cannot be read yet.
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
            className={`flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-11 text-center transition-colors duration-150 ${
              dragging
                ? "border-primary bg-primary/[0.06]"
                : "border-border bg-muted/35 hover:border-primary/50 hover:bg-muted/55"
            }`}>
            <UploadCloud className="h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
            <span className="text-sm font-medium text-foreground">
              Drop a PDF here, or click to choose one
            </span>
            <span className="text-xs text-muted-foreground">Up to 40 MB</span>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                <FileText className="h-4.5 w-4.5 text-primary" strokeWidth={1.8} />
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

            {busy && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5" />
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                  {STAGE_COPY[stage]}
                </p>
              </div>
            )}
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
