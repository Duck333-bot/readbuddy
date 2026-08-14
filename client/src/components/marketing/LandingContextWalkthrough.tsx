import { ArrowLeft, CornerDownLeft, Highlighter, MousePointer2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const landingWalkthroughSteps = [
  "Current passage",
  "Sentence selected",
  "Context requested",
  "Earlier passage",
  "Evidence connection",
  "Return to reading",
] as const;

export function walkthroughStageLabel(stage: number) {
  return landingWalkthroughSteps[Math.min(Math.max(stage, 0), landingWalkthroughSteps.length - 1)];
}

const DELAYS = [650, 650, 700, 900, 1100];

export function LandingContextWalkthrough() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearSequence = () => {
    sequenceTimers.current.forEach(clearTimeout);
    sequenceTimers.current = [];
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  useEffect(() => clearSequence, []);

  const runDemo = () => {
    clearSequence();
    if (reducedMotion) {
      setStage(5);
      return;
    }
    setStage(0);
    setRunning(true);
    let elapsed = 0;
    DELAYS.forEach((delay, index) => {
      elapsed += delay;
      sequenceTimers.current.push(setTimeout(() => setStage(index + 1), elapsed));
    });
    sequenceTimers.current.push(setTimeout(() => setRunning(false), elapsed + 100));
  };

  const resetDemo = () => {
    clearSequence();
    setRunning(false);
    setStage(0);
  };

  const startLongPress = (pointerType: string) => {
    if (pointerType === "mouse") return;
    clearSequence();
    holdTimer.current = setTimeout(runDemo, 450);
  };

  const endLongPress = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const selected = stage >= 1;
  const askedContext = stage >= 2;
  const earlierVisible = stage >= 3;
  const understood = stage >= 4;
  const returned = stage >= 5;

  return (
    <section className="landing-walkthrough relative mx-auto w-full max-w-2xl" aria-label="Interactive ZhiyaAI context walkthrough">
      <div className="absolute -left-5 top-16 h-32 w-32 rounded-[2rem] bg-[#bcebe4]/65 [transform:rotate(-13deg)]" />
      <div className="absolute -right-4 bottom-8 h-36 w-36 rounded-full bg-[#ffb4cc]/55 blur-[1px]" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/85 bg-white/90 p-4 shadow-[0_28px_60px_rgba(50,37,111,.17)] backdrop-blur sm:p-6">
        <div className="flex items-center justify-between border-b border-[#e9e7f2] pb-4">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#b9aaff]" /><span className="text-xs font-semibold text-[#5e5b73]">Reading with ZhiyaAI</span></div>
          <span className="text-xs text-[#908da3]">Page 143</span>
        </div>

        <div className="relative pt-5">
          <article className="rounded-xl border border-[#ebe8f3] bg-[#fffefd] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#7b62e7]">The page you are reading</p>
            <p className="mt-5 font-reading text-xl leading-8 text-[#29263c]">“She understood then that the answer had been there <button type="button" onClick={runDemo} onPointerDown={event => startLongPress(event.pointerType)} onPointerUp={endLongPress} onPointerCancel={endLongPress} className={`relative inline rounded px-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7658e6] ${selected ? "bg-[#f8e6a8]" : "bg-transparent hover:bg-[#f8e6a8]/70"}`}>long before the question.</button>”</p>
            <p className="mt-4 text-[11px] text-[#7b778d] sm:hidden">Press and hold the highlighted sentence for context.</p>
          </article>

          <div className={`absolute left-7 top-[8.3rem] z-20 origin-left rounded-lg border border-[#dad3ef] bg-[#272243] p-1.5 shadow-lg transition-all duration-300 sm:left-10 ${selected ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            <button type="button" onClick={() => setStage(Math.max(stage, 3))} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white ${askedContext ? "bg-[#7658e6]" : "bg-transparent hover:bg-white/10"}`}><Highlighter className="h-3.5 w-3.5" /> Context</button>
          </div>

          <div className={`absolute right-0 top-[-.4rem] z-10 w-[13rem] rounded-xl border border-[#ddd4fb] bg-[#f3efff] p-4 shadow-[0_16px_28px_rgba(67,48,135,.13)] transition-all duration-500 sm:right-3 ${earlierVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#725bd8]">Earlier context · p.47</p>
            <p className="mt-2 font-reading text-sm leading-6 text-[#46405d]">“Some things only become clear when you have lived beyond them.”</p>
            <span className="mt-3 inline-flex text-[10px] font-semibold text-[#725bd8]">Evidence · p.47</span>
          </div>

          <svg className={`pointer-events-none absolute -right-1 top-[6.5rem] hidden h-40 w-56 overflow-visible transition-opacity duration-300 sm:block ${understood ? "opacity-100" : "opacity-0"}`} viewBox="0 0 230 150" fill="none" aria-hidden="true"><path d="M7 30 C110 20, 125 116, 218 120" stroke="#7658e6" strokeDasharray="3 4" strokeWidth="1.5" /><circle cx="7" cy="30" r="4" fill="#7658e6" /><circle cx="218" cy="120" r="4" fill="#7658e6" /></svg>

          <div className={`mt-4 overflow-hidden rounded-xl border border-[#ebe8f3] bg-[#fdfcff] transition-all duration-500 ${understood ? "max-h-40 p-4 opacity-100" : "max-h-0 border-transparent p-0 opacity-0"}`}>
            <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#7658e6]" /><div><p className="text-sm font-semibold text-[#332f48]">Why this matters</p><p className="mt-1 text-sm leading-6 text-[#67637b]">The earlier line shows that understanding arrives only after enough of the story has unfolded. This page is the moment that idea becomes clear.</p></div></div>
          </div>
        </div>

        <div className={`mt-4 flex min-h-9 items-center justify-between border-t border-[#e9e7f2] pt-3 text-xs transition-opacity duration-300 ${returned ? "opacity-100" : "opacity-0"}`}>
          <button type="button" onClick={resetDemo} className="inline-flex items-center gap-1.5 font-semibold text-[#5e5b73] hover:text-[#272243]"><ArrowLeft className="h-3.5 w-3.5" /> Return to your page</button>
          <button type="button" onClick={resetDemo} className="inline-flex items-center gap-1.5 text-[#7658e6] hover:text-[#6245d1]"><RotateCcw className="h-3.5 w-3.5" /> Replay</button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-[#77738a]" aria-live="polite"><CornerDownLeft className="h-3.5 w-3.5 text-[#7658e6]" /> {running ? walkthroughStageLabel(stage) : reducedMotion ? "Tap Context to reveal the connection" : "Click the sentence to watch the context flow"}</div>

        {!reducedMotion && <MousePointer2 className={`pointer-events-none absolute z-30 hidden h-5 w-5 fill-[#272243] text-white transition-transform duration-500 md:block ${stage === 0 ? "translate-x-[15rem] translate-y-[-6rem]" : stage === 1 ? "translate-x-[12rem] translate-y-[-3rem]" : stage === 2 ? "translate-x-[10rem] translate-y-[-1rem]" : stage === 3 ? "translate-x-[23rem] translate-y-[-6rem]" : "translate-x-[21rem] translate-y-[3.5rem]"}`} aria-hidden="true" />}
      </div>
    </section>
  );
}
