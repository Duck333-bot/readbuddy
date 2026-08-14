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
  Brain,
  CornerDownLeft,
  AlertTriangle,
  Eye,
  EyeOff,
  Languages,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export type BuddyMode =
  | "explain"
  | "simplify"
  | "context"
  | "why"
  | "translate"
  | "define"
  | "ask";

type Turn = {
  id: string;
  mode: BuddyMode;
  question: string | null;
  answer: string;
  saved: boolean;
};

const PRIMARY_BUTTONS: { mode: BuddyMode; label: string; icon: typeof Lightbulb }[] = [
  { mode: "explain", label: "Explain", icon: Lightbulb },
  { mode: "simplify", label: "Simpler", icon: Sparkles },
  { mode: "context", label: "Context", icon: BookOpen },
  { mode: "why", label: "Why important", icon: Star },
];

const SECONDARY_BUTTONS: { mode: BuddyMode; label: string; icon: typeof Lightbulb }[] = [
  { mode: "translate", label: "Translate", icon: Languages },
  { mode: "define", label: "Define", icon: MessageCircleQuestion },
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

const MODE_LABELS: Record<BuddyMode, string> = {
  explain: "Explain",
  simplify: "Simpler",
  context: "Context",
  why: "Why important",
  translate: "Translate",
  define: "Define",
  ask: "Your question",
};

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
  onHighlightChange?: (value: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [language, setLanguage] = useState("English");
  const [activeMode, setActiveMode] = useState<BuddyMode | null>(null);
  const [failure, setFailure] = useState<{
    mode: BuddyMode;
    question?: string;
    message: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastHighlightRef = useRef<string>("");
  const utils = trpc.useUtils();

  // Book Brain status — poll every 15s until complete
  const { data: brainData } = trpc.books.getBrain.useQuery(
    { bookId },
    {
      refetchInterval: (q) => {
        const pass = (q.state.data as { passCompleted?: number } | undefined)?.passCompleted ?? 0;
        return pass < 4 ? 15_000 : false;
      },
    },
  );

  // Spoiler mode
  const { data: spoilerData } = trpc.books.getSpoilerMode.useQuery({ bookId });
  const setSpoilerMutation = trpc.books.setSpoilerMode.useMutation({
    onSuccess: () => utils.books.getSpoilerMode.invalidate({ bookId }),
  });
  const spoilerMode = spoilerData?.spoilerMode ?? "safe";

  const askMutation = trpc.buddy.ask.useMutation();
  const saveMutation = trpc.notebook.save.useMutation({
    onSuccess: () => {
      void utils.notebook.list.invalidate();
      void utils.notebook.count.invalidate();
    },
  });

  const busy = activeMode !== null;

  // Auto-scroll to the latest answer.
  useEffect(() => {
    const node = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, activeMode]);

  // Clear conversation when the user selects a new passage.
  useEffect(() => {
    if (!highlight.trim()) return;
    if (lastHighlightRef.current === highlight) return;
    lastHighlightRef.current = highlight;
    setTurns([]);
    setFollowUp("");
    setFailure(null);
    setActiveMode(null);
  }, [highlight]);

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
        toast.success("Saved to your notebook.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save that.");
      }
    },
    [bookId, highlight, pageNumber, saveMutation],
  );

  const passCompleted = brainData?.passCompleted ?? 0;
  const brainReady = passCompleted >= 4;

  return (
    <aside
      className="flex h-full flex-col border-l border-border/80 bg-card/60"
      aria-label="Reading buddy">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" strokeWidth={2} />
          <span className="font-display text-sm font-semibold tracking-tight">ZhiyaAI</span>
          {passCompleted > 0 && (
            <span
              title={
                brainReady
                  ? "Book Brain fully loaded — deep context available"
                  : `Book Brain building… pass ${passCompleted}/4`
              }
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                brainReady
                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/12 text-amber-600 dark:text-amber-400"
              }`}>
              {brainReady ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Brain ready
                </>
              ) : (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Building…
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            title={
              spoilerMode === "safe"
                ? "Spoiler-safe mode: AI only knows what you've read so far. Click to unlock full-book analysis."
                : "Full-book mode: AI has complete context. Click to switch back to spoiler-safe."
            }
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() =>
              setSpoilerMutation.mutate({
                bookId,
                spoilerMode: spoilerMode === "safe" ? "full" : "safe",
              })
            }>
            {spoilerMode === "safe" ? (
              <>
                <EyeOff className="h-3 w-3" strokeWidth={2} />
                No spoilers
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 text-amber-500" strokeWidth={2} />
                Full book
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onHighlightChange?.("");
              onClose();
            }}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Selected passage */}
      <div className="shrink-0 border-b border-border/50 bg-muted/30 px-4 py-2.5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          You highlighted
        </p>
        <blockquote className="max-h-24 overflow-y-auto border-l-2 border-primary/45 pl-3 font-reading text-[0.85rem] italic leading-relaxed text-foreground/80">
          {highlight}
        </blockquote>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 border-b border-border/50 px-4 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          {PRIMARY_BUTTONS.map(({ mode, label, icon: Icon }) => (
            <Button
              key={mode}
              variant={activeMode === mode ? "default" : "outline"}
              size="sm"
              disabled={busy}
              className="h-8 gap-1.5 text-[12px] font-medium justify-start px-3 bg-background"
              onClick={() => void run(mode)}>
              {activeMode === mode ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" strokeWidth={2} />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.9} />
              )}
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {SECONDARY_BUTTONS.map(({ mode, label, icon: Icon }) => (
            <Button
              key={mode}
              variant={activeMode === mode ? "default" : "outline"}
              size="sm"
              disabled={busy}
              className="h-7 gap-1.5 text-[11px] px-2.5 bg-background"
              onClick={() => void run(mode)}>
              {activeMode === mode ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0" strokeWidth={2} />
              ) : (
                <Icon className="h-3 w-3 shrink-0 text-primary" strokeWidth={1.9} />
              )}
              {label}
            </Button>
          ))}
          {activeMode === "translate" || turns.some(t => t.mode === "translate") ? (
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-7 w-36 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l} value={l} className="text-xs">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {/* Conversation */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="space-y-5 px-4 py-4">
          {turns.length === 0 && !busy && failure === null && (
            <div className="space-y-1.5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tap any button above to ask ZhiyaAI about this passage.
              </p>
              {!brainReady && passCompleted > 0 && (
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
                  Book Brain is still building — answers will get richer as it completes (pass {passCompleted}/4).
                </p>
              )}
            </div>
          )}

          {turns.map(turn => (
            <div key={turn.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary">
                  {MODE_LABELS[turn.mode]}
                </span>
                {turn.question && (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    "{turn.question}"
                  </span>
                )}
              </div>

              <div className="prose prose-sm max-w-none text-[0.9rem] leading-relaxed text-foreground/90 prose-headings:font-display prose-p:my-2 prose-li:my-0.5 prose-strong:text-foreground">
                <Streamdown>{turn.answer}</Streamdown>
              </div>

              {turn.mode === "simplify" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => void run("simplify", "Make it even simpler")}>
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  Even simpler
                </Button>
              )}

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
              ZhiyaAI is thinking…
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
