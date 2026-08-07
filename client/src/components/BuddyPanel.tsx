import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CornerDownLeft,
  AlertTriangle,
  Languages,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export type BuddyMode = "explain" | "simplify" | "translate" | "define" | "ask";

type Turn = {
  id: string;
  mode: BuddyMode;
  question: string | null;
  answer: string;
  saved: boolean;
};

const MODE_BUTTONS: { mode: BuddyMode; label: string; icon: typeof Lightbulb }[] = [
  { mode: "explain", label: "Explain", icon: Lightbulb },
  { mode: "simplify", label: "Simplify", icon: Sparkles },
  { mode: "translate", label: "Translate", icon: Languages },
  { mode: "define", label: "Define", icon: BookOpen },
];

const LANGUAGES = [
  "English",
  "Traditional Chinese",
  "Simplified Chinese",
  "German",
  "Spanish",
  "French",
  "Japanese",
  "Korean",
];

export function BuddyPanel({
  bookId,
  pageNumber,
  highlight,
  onClose,
  onHighlightChange,
}: {
  bookId: number;
  pageNumber: number;
  highlight: string;
  onClose: () => void;
  /** Lets the panel clear the reader's selection state when it closes. */
  onHighlightChange?: (value: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [language, setLanguage] = useState("English");
  const [activeMode, setActiveMode] = useState<BuddyMode | null>(null);
  const [failure, setFailure] = useState<{ mode: BuddyMode; question?: string; message: string } | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastHighlightRef = useRef<string>("");
  const utils = trpc.useUtils();

  const askMutation = trpc.buddy.ask.useMutation();
  const saveMutation = trpc.notebook.save.useMutation();

  const run = useCallback(
    async (mode: BuddyMode, question?: string) => {
      if (!highlight.trim()) return;
      setActiveMode(mode);
      setFailure(null);
      try {
        const result = await askMutation.mutateAsync({
          bookId,
          pageNumber,
          highlight,
          mode,
          question: question?.trim() || undefined,
          targetLanguage: mode === "translate" ? language : undefined,
          history: turns.slice(-3).flatMap(turn => [
            { role: "user" as const, content: turn.question ?? `(${turn.mode})` },
            { role: "assistant" as const, content: turn.answer },
          ]),
        });
        setTurns(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            mode,
            question: question?.trim() || null,
            answer: result.answer,
            saved: false,
          },
        ]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The reading buddy could not answer just now.";
        setFailure({ mode, question, message });
      } finally {
        setActiveMode(null);
      }
    },
    [askMutation, bookId, highlight, language, pageNumber, turns],
  );

  // A brand-new highlight starts a fresh conversation and auto-explains it.
  useEffect(() => {
    if (!highlight.trim()) return;
    if (lastHighlightRef.current === highlight) return;
    lastHighlightRef.current = highlight;
    setTurns([]);
    setFollowUp("");
    setFailure(null);
    void run("explain");
    // `run` changes with every turn; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  // Keep the newest answer in view.
  useEffect(() => {
    const node = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, activeMode]);

  const handleSave = useCallback(
    async (turn: Turn) => {
      try {
        await saveMutation.mutateAsync({
          bookId,
          pageNumber,
          mode: turn.mode,
          highlight,
          question: turn.question,
          answer: turn.answer,
        });
        setTurns(prev => prev.map(t => (t.id === turn.id ? { ...t, saved: true } : t)));
        await utils.notebook.list.invalidate();
        await utils.notebook.count.invalidate();
        toast.success("Saved to your notebook.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save that.");
      }
    },
    [bookId, highlight, pageNumber, saveMutation, utils],
  );

  const busy = activeMode !== null;

  return (
    <aside
      className="flex h-full flex-col border-l border-border/80 bg-card/60"
      aria-label="Reading buddy">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/14">
          <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-tight">Reading buddy</p>
          <p className="text-[11px] text-muted-foreground">page {pageNumber}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Close reading buddy"
          onClick={() => {
            onHighlightChange?.("");
            onClose();
          }}>
          <X className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>

      {/* Highlighted passage */}
      <div className="border-b border-border/70 px-5 py-4">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          You highlighted
        </p>
        <blockquote className="max-h-28 overflow-y-auto border-l-2 border-primary/45 pl-3 font-reading text-[0.9rem] italic leading-relaxed text-foreground/85">
          {highlight}
        </blockquote>
      </div>

      {/* Mode buttons */}
      <div className="border-b border-border/70 px-5 py-3">
        <div className="grid grid-cols-2 gap-2">
          {MODE_BUTTONS.map(item => (
            <Button
              key={item.mode}
              variant="outline"
              size="sm"
              disabled={busy}
              className="h-8 justify-start gap-1.5 bg-background px-2.5 text-xs font-normal"
              onClick={() => void run(item.mode)}>
              {activeMode === item.mode ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
              ) : (
                <item.icon className="h-3 w-3 text-primary" strokeWidth={1.9} />
              )}
              {item.label}
            </Button>
          ))}
        </div>
        <div className="mt-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 w-full bg-background text-xs">
              <SelectValue placeholder="Translate into…" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang} value={lang} className="text-xs">
                  Translate into {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversation */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="space-y-5 px-5 py-5">
          {turns.length === 0 && !busy && (
            failure === null && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pick one of the options above, or type your own question below.
            </p>
            )
          )}

          {turns.map(turn => (
            <div key={turn.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary">
                  {turn.mode}
                </span>
                {turn.question && (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    “{turn.question}”
                  </span>
                )}
              </div>

              <div className="prose prose-sm max-w-none text-[0.9rem] leading-relaxed text-foreground/90 prose-headings:font-display prose-p:my-2 prose-li:my-0.5 prose-strong:text-foreground">
                <Streamdown>{turn.answer}</Streamdown>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  disabled={turn.saved || saveMutation.isPending}
                  onClick={() => void handleSave(turn)}>
                  {turn.saved ? (
                    <>
                      <BookmarkCheck className="h-3 w-3 text-primary" strokeWidth={2} />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-3 w-3" strokeWidth={2} />
                      Save to notebook
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  disabled={busy}
                  onClick={() => void run(turn.mode, turn.question ?? undefined)}>
                  <RefreshCw className="h-3 w-3" strokeWidth={2} />
                  Try again
                </Button>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              Thinking about this passage…
            </div>
          )}

          {failure && !busy && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/35 bg-destructive/[0.06] p-3.5">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {failure.message}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5 h-7 gap-1.5 bg-background px-2.5 text-[11px]"
                    onClick={() => void run(failure.mode, failure.question)}>
                    <RefreshCw className="h-3 w-3" strokeWidth={2} />
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Follow-up */}
      <form
        className="border-t border-border/70 p-3"
        onSubmit={event => {
          event.preventDefault();
          const question = followUp.trim();
          if (!question || busy) return;
          setFollowUp("");
          void run("ask", question);
        }}>
        <div className="relative">
          <Input
            value={followUp}
            disabled={busy}
            onChange={event => setFollowUp(event.target.value)}
            placeholder="Ask your own question…"
            className="h-10 bg-background pr-10 text-sm"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={busy || !followUp.trim()}
            aria-label="Send question"
            className="absolute right-1 top-1 h-8 w-8 text-muted-foreground">
            <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </form>
    </aside>
  );
}

export default BuddyPanel;
