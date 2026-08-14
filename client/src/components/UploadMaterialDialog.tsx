import { useRef, useState } from "react";
import { FileText, Loader2, Plus, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

const ACCEPTED = ".pdf,.docx,.pptx,.txt,.md,.markdown";

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("This file could not be read in your browser."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function UploadMaterialDialog({ triggerLabel = "Add material" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const upload = trpc.materials.upload.useMutation({
    onSuccess: result => {
      toast.success("Material ready. ZhiyaAI will keep understanding it in the background.");
      setOpen(false);
      setFile(null);
      setTitle("");
      navigate(`/materials/${result.materialId}`);
    },
    onError: error => toast.error(error.message),
  });
  const chooseFile = (next: File | null) => {
    if (!next) return;
    if (next.size > 40 * 1024 * 1024) return toast.error("Materials must be 40 MB or smaller.");
    setFile(next);
    setTitle(next.name.replace(/\.(pdf|docx|pptx|txt|md|markdown)$/i, "").replace(/[_-]+/g, " "));
  };
  const submit = async () => {
    if (!file) return toast.error("Choose a learning material first.");
    try {
      await upload.mutateAsync({ filename: file.name, fileBase64: await toBase64(file), title: title.trim() || undefined, mimeType: file.type || undefined });
    } catch {
      // Mutation toast is the user-facing error surface.
    }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" />{triggerLabel}</Button></DialogTrigger>
    <DialogContent className="max-w-lg rounded-2xl">
      <DialogHeader><DialogTitle className="font-display text-2xl">Add a learning material</DialogTitle><DialogDescription>PDF, Word, PowerPoint, text, or Markdown. You can start learning once the material is ready while deeper analysis continues.</DialogDescription></DialogHeader>
      <input ref={inputRef} className="sr-only" type="file" accept={ACCEPTED} onChange={event => chooseFile(event.target.files?.[0] ?? null)} />
      {!file ? <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/[.035] px-6 text-center transition-colors hover:bg-primary/[.07]">
        <Upload className="mb-3 h-6 w-6 text-primary" /><span className="font-medium text-foreground">Choose a material</span><span className="mt-1 text-sm text-muted-foreground">PDF · DOCX · PPTX · TXT · Markdown</span>
      </button> : <div className="rounded-2xl border border-border bg-card p-4"><div className="flex gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate font-medium">{file.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p></div><Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setFile(null); inputRef.current && (inputRef.current.value = ""); }}>Change</Button></div></div>}
      <div className="grid gap-2"><Label htmlFor="material-title">Title</Label><Input id="material-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Give this material a clear title" /></div>
      <Button disabled={!file || upload.isPending} onClick={() => void submit()} className="h-11 rounded-xl">{upload.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing material…</> : "Add to ZhiyaAI"}</Button>
    </DialogContent>
  </Dialog>;
}
