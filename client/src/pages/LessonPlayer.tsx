import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronLeft, ChevronRight, CircleHelp, FileText, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import type { LessonStepMetadata } from "@shared/materials";

type LessonStep = {
  id: number;
  position: number;
  stepType: "explain" | "example" | "check" | "adapt" | "intro" | "visual" | "worked" | "mcq" | "note" | "flashcard" | "recap" | "continuation";
  content: string;
  checkPrompt: string | null;
  expectedAnswer: string | null;
  metadata: LessonStepMetadata | null;
  completedAt: Date | null;
};

const stepTheme: Record<LessonStep["stepType"], { label: string; icon: typeof Sparkles; surface: string; ink: string; soft: string }> = {
  explain: { label: "Understand", icon: Sparkles, surface: "#fff4ce", ink: "#76521d", soft: "#fffaf0" },
  example: { label: "Example", icon: Lightbulb, surface: "#dcefff", ink: "#215a82", soft: "#f6fbff" },
  check: { label: "Quick check", icon: CircleHelp, surface: "#f0e6ff", ink: "#62468e", soft: "#fbf8ff" },
  adapt: { label: "Keep going", icon: Sparkles, surface: "#e3f5e8", ink: "#2c7652", soft: "#f7fdf8" },
  intro: { label: "Your lesson", icon: Sparkles, surface: "#fff2bd", ink: "#76521d", soft: "#fffdf5" },
  visual: { label: "See the idea", icon: Lightbulb, surface: "#dcefff", ink: "#215a82", soft: "#f5fbff" },
  worked: { label: "Worked understanding", icon: BookOpenCheck, surface: "#dcefff", ink: "#215a82", soft: "#f5fbff" },
  mcq: { label: "Check your thinking", icon: CircleHelp, surface: "#eee7ff", ink: "#62468e", soft: "#fbf9ff" },
  note: { label: "Key reminders", icon: FileText, surface: "#dff3e6", ink: "#276a4d", soft: "#f6fcf8" },
  flashcard: { label: "Bring it back", icon: RotateCcw, surface: "#eee7ff", ink: "#62468e", soft: "#fbf9ff" },
  recap: { label: "Quick recap", icon: Check, surface: "#dff3e6", ink: "#276a4d", soft: "#f6fcf8" },
  continuation: { label: "Complete", icon: Check, surface: "#dff3e6", ink: "#276a4d", soft: "#f6fcf8" },
};

function SourceChip({ label }: { label?: string }) {
  if (!label) return null;
  return <span className="inline-flex items-center gap-1 rounded-full border border-black/[.07] bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500"><FileText className="h-3 w-3" />{label}</span>;
}

function VisualBlock({ visual }: { visual?: LessonStepMetadata["visual"] }) {
  if (!visual) return null;
  const isComparison = visual.kind === "comparison";
  return <div className="mt-7 rounded-[1.7rem] border border-sky-200/70 bg-white p-4 shadow-[0_18px_50px_rgba(80,130,170,.11)] sm:p-6">
    <div className={`grid gap-3 ${isComparison ? "sm:grid-cols-2" : ""}`}>
      {visual.items.map((item, index) => <div key={`${item.label}-${index}`} className={`relative rounded-2xl border p-5 ${index === 0 ? "border-sky-200 bg-sky-50" : "border-violet-200 bg-violet-50"}`}>
        {!isComparison && index === 0 ? <div className="absolute -bottom-3 left-1/2 h-6 w-px bg-slate-300 sm:-bottom-8 sm:h-8" /> : null}
        {!isComparison && index === 1 ? <div className="absolute -top-3 left-1/2 h-6 w-px bg-slate-300 sm:-top-8 sm:h-8" /> : null}
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{item.label}</p>
        <p className="mt-3 text-sm leading-6 text-slate-700">{item.detail}</p>
      </div>)}
    </div>
    <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center text-xs leading-5 text-slate-500">{visual.caption}</div>
  </div>;
}

function NotePoints({ points }: { points?: string[] }) {
  if (!points?.length) return null;
  return <div className="mt-7 space-y-3">{points.map((point, index) => <div key={point} className="flex gap-3 rounded-2xl border border-emerald-200/80 bg-white/70 px-4 py-4"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">{index + 1}</span><p className="text-sm leading-6 text-emerald-950">{point}</p></div>)}</div>;
}

function EvidenceExcerpt({ step }: { step: LessonStep }) {
  const excerpt = step.stepType === "worked" ? step.content : null;
  if (!excerpt) return null;
  return <blockquote className="mt-7 border-l-2 border-sky-300 bg-white/65 px-5 py-4 font-reading text-lg leading-8 text-slate-700">“{excerpt}”</blockquote>;
}

export default function LessonPlayer() {
  const [, params] = useRoute("/materials/:materialId/lesson");
  const [, setLocation] = useLocation();
  const materialId = Number(params?.materialId);
  const { isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<number>>(() => new Set());
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, { isCorrect: boolean; explanation: string; correctAnswer: string | null }>>({});
  const [flipped, setFlipped] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const lesson = trpc.materials.lesson.useMutation({ onError: error => toast.error(error.message) });
  const flashcards = trpc.materials.flashcards.useQuery({ materialId }, { enabled: isAuthenticated && Number.isFinite(materialId) });
  const complete = trpc.materials.completeLessonStep.useMutation({ onError: error => toast.error(error.message) });
  const answerMcq = trpc.materials.answerLessonMcq.useMutation({ onError: error => toast.error(error.message) });

  useEffect(() => {
    if (isAuthenticated && Number.isFinite(materialId) && !lesson.data && !lesson.isPending) lesson.mutate({ materialId });
  }, [isAuthenticated, materialId, lesson]);

  const steps = (lesson.data?.steps ?? []) as LessonStep[];
  useEffect(() => {
    if (!steps.length) return;
    const firstOpen = steps.findIndex(step => !step.completedAt && !completedIds.has(step.id));
    setActiveIndex(firstOpen >= 0 ? firstOpen : steps.length - 1);
  }, [lesson.data]);
  const current = steps[activeIndex];
  const estimatedMinutes = Math.max(3, Math.round(steps.reduce((total, step) => total + (step.metadata?.estimatedMinutes ?? 0), 0)) || 3);
  const currentTheme = current ? stepTheme[current.stepType] : stepTheme.intro;
  const currentCards = useMemo(() => {
    const ids = current?.metadata?.flashcardIds ?? [];
    return (flashcards.data ?? []).filter(card => ids.includes(card.id));
  }, [current?.metadata?.flashcardIds, flashcards.data]);
  const currentCard = currentCards[Math.min(flashcardIndex, Math.max(currentCards.length - 1, 0))];
  const stepIsCompleted = current ? Boolean(current.completedAt || completedIds.has(current.id)) : false;

  useEffect(() => {
    setFlipped(false);
    setFlashcardIndex(0);
  }, [current?.id]);

  const markComplete = (understood?: boolean) => {
    if (!current || stepIsCompleted || complete.isPending) return;
    complete.mutate({ stepId: current.id, understood });
    setCompletedIds(previous => new Set([...Array.from(previous), current.id]));
  };
  const moveNext = () => {
    if (!current) return;
    if (activeIndex >= steps.length - 1) {
      setFinished(true);
      return;
    }
    setActiveIndex(index => Math.min(index + 1, steps.length - 1));
  };
  const primaryAction = () => {
    if (!current) return;
    if (current.stepType === "mcq" && !feedback[current.id]) return;
    if (!stepIsCompleted && current.stepType !== "mcq") markComplete(current.stepType === "worked" ? true : undefined);
    moveNext();
  };
  const selectAnswer = (choice: string) => {
    if (!current || feedback[current.id] || answerMcq.isPending) return;
    setSelectedAnswers(previous => ({ ...previous, [current.id]: choice }));
    answerMcq.mutate({ stepId: current.id, selectedAnswer: choice }, {
      onSuccess: result => {
        setFeedback(previous => ({ ...previous, [current.id]: result }));
        setCompletedIds(previous => new Set([...Array.from(previous), current.id]));
      },
    });
  };

  if (lesson.isError) return <main className="flex min-h-screen items-center justify-center bg-[#f8f7fb] p-5"><section className="max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(36,61,98,.12)] sm:p-12"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Lesson unavailable</p><h1 className="mt-3 font-display text-4xl tracking-[-.05em] text-slate-950">This revision lesson is not ready yet.</h1><p className="mt-4 leading-7 text-slate-600">Return to the material to check its source-backed concepts or choose another material.</p><Button className="mt-8" onClick={() => setLocation(`/materials/${materialId}`)}>Back to material</Button></section></main>;
  if (!isAuthenticated || lesson.isPending || !current) return <main className="min-h-screen bg-[#f8f7fb] p-5 sm:p-8"><div className="mx-auto max-w-4xl animate-pulse"><div className="h-5 w-40 rounded-full bg-slate-200" /><div className="mt-12 h-[520px] rounded-[2rem] bg-white shadow-sm" /></div></main>;
  if (finished) return <main className="flex min-h-screen items-center justify-center bg-[#f8f7fb] p-5"><motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-[0_24px_70px_rgba(36,61,98,.12)] sm:p-12"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700"><Check className="h-8 w-8" /></div><p className="mt-7 text-xs font-bold uppercase tracking-[.16em] text-emerald-700">Revision complete</p><h1 className="mt-3 font-display text-4xl tracking-[-.05em] text-slate-900">Nice work. You made the ideas active.</h1><p className="mt-4 leading-7 text-slate-600">Your answers now help ZhiyaAI choose what needs more attention in the next short lesson.</p><Button className="mt-8" onClick={() => setLocation(`/materials/${materialId}`)}>Back to material</Button></motion.section></main>;

  const Icon = currentTheme.icon;
  const progress = ((activeIndex + 1) / steps.length) * 100;
  const isMcq = current.stepType === "mcq";
  const isFlashcard = current.stepType === "flashcard";
  const isRecap = current.stepType === "note" || current.stepType === "recap";
  const answerFeedback = feedback[current.id];
  const direction = shouldReduceMotion ? { initial: false } : { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  return <main className="min-h-screen bg-[#f8f7fb] text-slate-900">
    <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-8 sm:py-7">
      <button type="button" onClick={() => setLocation(`/materials/${materialId}`)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900" aria-label="Close lesson"><X className="h-4 w-4" /></button>
      <div className="min-w-0 flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><motion.div className="h-full rounded-full bg-slate-900" animate={{ width: `${progress}%` }} transition={{ duration: shouldReduceMotion ? 0 : .35, ease: [0.23, 1, 0.32, 1] }} /></div><div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-[.14em] text-slate-500"><span>{estimatedMinutes}-minute revision</span><span>Step {activeIndex + 1} of {steps.length}</span></div></div>
      <div className="hidden gap-1 sm:flex"><button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex(index => Math.max(index - 1, 0))} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-35" aria-label="Previous step"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={activeIndex >= steps.length - 1} onClick={() => setActiveIndex(index => Math.min(index + 1, steps.length - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-35" aria-label="Next step"><ChevronRight className="h-4 w-4" /></button></div>
    </header>
    <section className="mx-auto flex min-h-[calc(100vh-155px)] max-w-5xl items-center px-4 pb-28 pt-4 sm:px-8 sm:pb-32">
      <AnimatePresence mode="wait"><motion.article key={current.id} {...direction} transition={{ duration: shouldReduceMotion ? 0 : .24, ease: [0.23, 1, 0.32, 1] }} className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_70px_rgba(36,61,98,.12)]">
        <div className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: currentTheme.surface }} />
        <div className="p-6 sm:p-10 md:p-12" style={{ backgroundColor: currentTheme.soft }}>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em]" style={{ backgroundColor: currentTheme.surface, color: currentTheme.ink }}><Icon className="h-3.5 w-3.5" />{currentTheme.label}</span><SourceChip label={current.metadata?.sourceLabel} /></div>
          <div className="mt-9">
            {current.stepType === "intro" ? <><p className="text-sm font-medium text-amber-800">Built from your upload</p><h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.02] tracking-[-.055em] text-slate-950 sm:text-5xl">A short path through what matters.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{current.content}</p></> : null}
            {current.stepType === "visual" ? <><h1 className="max-w-2xl font-display text-4xl leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">{current.content}</h1><VisualBlock visual={current.metadata?.visual} /></> : null}
            {current.stepType === "worked" ? <><h1 className="max-w-2xl font-display text-4xl leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">Make the connection.</h1><EvidenceExcerpt step={current} /><div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-950"><strong className="font-semibold">Why it matters:</strong> {current.checkPrompt}</div></> : null}
            {isMcq ? <><p className="text-sm font-semibold" style={{ color: currentTheme.ink }}>A quick material check</p><h1 className="mt-3 max-w-2xl font-display text-3xl leading-[1.1] tracking-[-.045em] text-slate-950 sm:text-4xl">{current.content}</h1><div className="mt-8 grid gap-3">{(current.metadata?.mcq?.choices ?? []).map((choice, index) => { const selected = selectedAnswers[current.id] === choice; const feedbackClass = answerFeedback ? choice === (answerFeedback.isCorrect ? selectedAnswers[current.id] : answerFeedback.correctAnswer) ? "border-emerald-300 bg-emerald-50 text-emerald-950" : selected ? "border-rose-300 bg-rose-50 text-rose-950" : "border-slate-200 bg-white text-slate-500" : selected ? "border-violet-300 bg-violet-50 text-violet-950" : "border-slate-200 bg-white text-slate-800 hover:border-violet-300 hover:bg-violet-50/40"; return <button key={choice} type="button" disabled={Boolean(answerFeedback) || answerMcq.isPending} onClick={() => selectAnswer(choice)} className={`flex min-h-16 items-center gap-4 rounded-2xl border px-5 py-4 text-left text-sm leading-6 transition ${feedbackClass}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 text-[11px] font-bold">{String.fromCharCode(65 + index)}</span><span>{choice}</span></button>; })}</div>{answerFeedback ? <div className={`mt-5 rounded-2xl border p-5 text-sm leading-6 ${answerFeedback.isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950"}`}><p className="font-semibold">{answerFeedback.isCorrect ? "Correct — keep that connection." : "Not quite — here is the source-grounded distinction."}</p><p className="mt-1">{answerFeedback.explanation}</p>{answerFeedback.correctAnswer ? <p className="mt-2 font-medium">Correct answer: {answerFeedback.correctAnswer}</p> : null}</div> : <p className="mt-5 text-xs text-slate-500">Choose the best explanation. A hint is not needed because the source evidence remains attached.</p>}</> : null}
            {isRecap ? <><h1 className="max-w-2xl font-display text-4xl leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">{current.content}</h1><NotePoints points={current.metadata?.recapPoints} /></> : null}
            {isFlashcard ? <><h1 className="max-w-xl font-display text-4xl leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">Bring it back from memory.</h1>{currentCard ? <button type="button" onClick={() => setFlipped(value => !value)} className="mt-8 block min-h-72 w-full rounded-[1.75rem] border border-violet-200 bg-white p-7 text-left shadow-[0_18px_42px_rgba(109,79,180,.12)] transition hover:-translate-y-0.5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">{flipped ? "Answer" : "Prompt"} · Card {flashcardIndex + 1} of {currentCards.length}</p><p className="mt-8 font-display text-3xl leading-tight text-slate-950">{flipped ? currentCard.back : currentCard.front}</p><p className="mt-8 text-xs text-slate-500">Tap to {flipped ? "return to prompt" : "flip and reveal"}</p></button> : <div className="mt-8 rounded-2xl border border-dashed border-violet-200 bg-white/70 p-6 text-sm leading-6 text-slate-600">Your source-backed cards are being prepared. You can continue with the recap now.</div>}{currentCards.length > 1 ? <div className="mt-4 flex justify-end"><button type="button" onClick={() => { setFlashcardIndex(index => (index + 1) % currentCards.length); setFlipped(false); }} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700">Next card <ArrowRight className="h-4 w-4" /></button></div> : null}</> : null}
            {current.stepType === "continuation" ? <><div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700"><Check className="h-8 w-8" /></div><h1 className="mt-7 max-w-2xl font-display text-4xl leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">A real understanding, not just a page completed.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{current.content}</p></> : null}
            {!["intro", "visual", "worked", "mcq", "note", "flashcard", "recap", "continuation"].includes(current.stepType) ? <><h1 className="font-display text-4xl">{current.content}</h1>{current.checkPrompt ? <p className="mt-5 text-slate-600">{current.checkPrompt}</p> : null}</> : null}
          </div>
        </div>
      </motion.article></AnimatePresence>
    </section>
    <footer className="fixed inset-x-0 bottom-0 border-t border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-md sm:px-8"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><Button variant="outline" className="bg-white" disabled={activeIndex === 0} onClick={() => setActiveIndex(index => Math.max(index - 1, 0))}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button><div className="flex items-center gap-2">{isFlashcard && currentCards.length > 1 ? <Button variant="ghost" onClick={() => moveNext()}>Skip</Button> : null}<Button disabled={complete.isPending || (isMcq && !answerFeedback)} onClick={primaryAction}>{activeIndex >= steps.length - 1 ? "Finish lesson" : isMcq ? "Continue" : current.stepType === "intro" ? "Begin lesson" : "Continue"}<ArrowRight className="ml-1.5 h-4 w-4" /></Button></div></div></footer>
  </main>;
}
