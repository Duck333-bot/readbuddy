import { ArrowRight, BookOpen, ChevronRight, CornerDownLeft, FileText, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const memorySequenceStages = [
  {
    eyebrow: "0% · The pause",
    title: "A sentence stops you.",
    copy: "ReadBuddy starts with the exact line in front of you—not a detached chat window.",
  },
  {
    eyebrow: "25% · The thread",
    title: "It looks backward, carefully.",
    copy: "One Margin Thread follows the smallest useful path through pages you have already reached.",
  },
  {
    eyebrow: "50% · The evidence",
    title: "The earlier page arrives with its place intact.",
    copy: "A Page Shard preserves the passage and its page coordinate, so the connection is checkable.",
  },
  {
    eyebrow: "75% · The context",
    title: "The connection becomes clear.",
    copy: "An Evidence Bracket separates what the book says from the short help that makes it click.",
  },
  {
    eyebrow: "100% · Back to reading",
    title: "Then ReadBuddy gets out of the way.",
    copy: "A Return Tab brings you to the sentence, carrying only the context you needed.",
  },
] as const;

export function stageIndexForProgress(progress: number) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  return Math.min(memorySequenceStages.length - 1, Math.floor(safeProgress * memorySequenceStages.length));
}

function SequenceCanvas({ activeStage }: { activeStage: number }) {
  const showThread = activeStage >= 1;
  const showEvidence = activeStage >= 2;
  const showContext = activeStage >= 3;
  const showReturn = activeStage >= 4;

  return (
    <div className="relative min-h-[31rem] overflow-hidden border border-[#131c38]/10 bg-[#fffaf2] p-5 shadow-[20px_26px_0_rgba(104,101,232,.10)] sm:min-h-[36rem] sm:p-8">
      <div className="absolute -left-20 top-0 h-44 w-44 rounded-full bg-[#aebdf4]/55" />
      <div className="absolute right-0 top-0 h-48 w-48 rounded-bl-[8rem] bg-[#ffa181]/55" />
      <div className="absolute -bottom-12 right-12 h-40 w-40 rounded-full bg-[#b9ead7]/65" />

      <div className="relative mx-auto mt-14 max-w-[25rem] border border-[#131c38]/10 bg-[#fffdf8] px-5 pb-7 pt-5 shadow-[0_16px_28px_rgba(19,28,56,.12)] sm:mt-16 sm:px-7">
        <div className="flex items-center justify-between border-b border-[#131c38]/10 pb-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#68708a]">
          <span>Reading now</span><span>p.143</span>
        </div>
        <div className="space-y-2.5 pt-6 font-reading text-[.9rem] leading-6 text-[#3a4666] sm:text-[1rem] sm:leading-7">
          <p>He had expected the letter to explain everything.</p>
          <p className="relative -mx-1 px-1"><span className="relative z-10">But the silence around it made the truth harder to name.</span><span className="absolute inset-x-0 bottom-1 h-3 bg-[#c8cdf8]" /></p>
          <p>For the first time, he understood why it had been hidden.</p>
        </div>
        <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#68708a]"><span className="h-1.5 w-1.5 rounded-full bg-[#f26f35]" /> Current sentence</div>
      </div>

      <svg className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${showThread ? "opacity-100" : "opacity-0"}`} viewBox="0 0 600 580" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path d="M376 292 C505 260, 505 148, 472 127" stroke="#F26F35" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 6" />
        <circle cx="376" cy="292" r="5" fill="#F26F35" /><circle cx="472" cy="127" r="5" fill="#F26F35" />
      </svg>

      <div className={`absolute right-3 top-7 w-[11rem] border border-[#131c38]/10 bg-[#fffdf8] p-3 shadow-[0_14px_22px_rgba(19,28,56,.12)] transition-all duration-300 sm:right-7 sm:top-9 sm:w-[13rem] ${showEvidence ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[.13em] text-[#68708a]"><span>Earlier page</span><span className="text-[#f26f35]">p.47</span></div>
        <div className="mt-3 border-l-2 border-[#6557e8] pl-2 font-reading text-xs leading-5 text-[#394563]">“Some truths survive by being left unsaid.”</div>
        <div className="mt-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#6557e8]"><MapPin className="h-3 w-3" /> Evidence coordinate</div>
      </div>

      <div className={`absolute bottom-9 left-3 right-3 border border-[#131c38]/10 bg-[#eff0ff] p-4 shadow-[0_14px_22px_rgba(19,28,56,.10)] transition-all duration-300 sm:bottom-10 sm:left-7 sm:right-7 sm:p-5 ${showContext ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <div className="flex items-start gap-3"><span className="mt-1 block h-8 border-l-2 border-[#6557e8]" /><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#6557e8]">What this changes</p><p className="mt-2 text-sm leading-6 text-[#394563]">The earlier line shows that the silence is deliberate. This moment is not about missing information—it is about someone protecting it.</p></div></div>
      </div>

      <div className={`absolute bottom-0 right-7 flex items-center gap-2 bg-[#131c38] px-4 py-3 text-xs font-semibold text-[#fff9ef] shadow-[0_10px_18px_rgba(19,28,56,.16)] transition-all duration-300 ${showReturn ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}><CornerDownLeft className="h-3.5 w-3.5 text-[#ffd269]" /> Return to p.143</div>
    </div>
  );
}

export function MemorySequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const updateStage = () => {
      const element = sectionRef.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      const availableDistance = Math.max(1, element.offsetHeight - window.innerHeight);
      setActiveStage(stageIndexForProgress((window.scrollY - top) / availableDistance));
    };
    updateStage();
    window.addEventListener("scroll", updateStage, { passive: true });
    window.addEventListener("resize", updateStage);
    return () => { window.removeEventListener("scroll", updateStage); window.removeEventListener("resize", updateStage); };
  }, [reducedMotion]);

  const stage = memorySequenceStages[activeStage];
  return (
    <section ref={sectionRef} className="relative bg-[#e9edff] px-5 py-16 sm:px-8 sm:py-24 lg:min-h-[190vh] lg:py-0" aria-labelledby="memory-sequence-title">
      <div className="mx-auto max-w-7xl lg:sticky lg:top-[4.5rem] lg:flex lg:min-h-[calc(100vh-4.5rem)] lg:items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#6557e8]">A book can remember with you</p>
            <h2 id="memory-sequence-title" className="mt-4 max-w-md font-display text-4xl font-semibold leading-[.98] tracking-[-.05em] text-[#131c38] sm:text-6xl">The answer is useful. <em className="font-normal text-[#f26f35]">The path back is the magic.</em></h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[#53607d]">ReadBuddy does not hand you a summary from nowhere. It finds the smallest earlier piece of the book that turns this sentence into something you can understand.</p>
            <div className="mt-8 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible" role="tablist" aria-label="ReadBuddy memory sequence">
              {memorySequenceStages.map((item, index) => (
                <button key={item.eyebrow} type="button" role="tab" aria-selected={activeStage === index} onClick={() => setActiveStage(index)} className={`shrink-0 border px-3 py-2 text-left transition-colors lg:flex lg:w-full lg:items-center lg:gap-3 lg:px-4 ${activeStage === index ? "border-[#131c38] bg-[#fff9ef] text-[#131c38]" : "border-transparent text-[#697391] hover:border-[#131c38]/15"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ${activeStage === index ? "bg-[#f26f35] text-white" : "border border-current"}`}>{index + 1}</span><span className="text-[10px] font-bold uppercase tracking-[.14em]">{item.eyebrow.split(" · ")[0]}</span><span className="hidden text-sm lg:inline">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="mt-8 border-l-2 border-[#f26f35] pl-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#f26f35]">{stage.eyebrow}</p><p className="mt-2 font-display text-2xl font-semibold leading-tight text-[#131c38]">{stage.title}</p><p className="mt-2 max-w-md text-sm leading-6 text-[#53607d]">{stage.copy}</p></div>
          </div>
          <SequenceCanvas activeStage={activeStage} />
        </div>
      </div>
    </section>
  );
}

export function EvidenceMoment() {
  return (
    <section className="overflow-hidden bg-[#fff9ef] px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="evidence-moment-title">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_.92fr] lg:items-center lg:gap-16">
        <div className="relative min-h-[25rem] border border-[#131c38]/10 bg-[#d9e4ff] p-6 sm:min-h-[29rem] sm:p-9">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-[7rem] bg-[#ffc6b5]" />
          <div className="relative max-w-[19rem] bg-[#fffdf8] p-5 shadow-[0_16px_28px_rgba(19,28,56,.14)]"><div className="flex items-center justify-between border-b border-[#131c38]/10 pb-3 text-[9px] font-bold uppercase tracking-[.15em] text-[#68708a]"><span>Earlier passage</span><span>p.47</span></div><p className="mt-5 font-reading text-sm leading-7 text-[#3d4965]">“He learned early that silence could be an act of care.”</p><div className="mt-5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.13em] text-[#6557e8]"><FileText className="h-3 w-3" /> Page shard</div></div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 440" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M218 165 C350 185, 365 295, 458 305" stroke="#F26F35" strokeWidth="2" strokeLinecap="round" /><circle cx="218" cy="165" r="5" fill="#F26F35" /><circle cx="458" cy="305" r="5" fill="#F26F35" /></svg>
          <div className="absolute bottom-7 right-5 max-w-[16rem] border border-[#131c38]/10 bg-[#fffdf8] p-4 shadow-[0_16px_28px_rgba(19,28,56,.14)] sm:bottom-9 sm:right-8"><div className="flex gap-3"><span className="mt-1 block h-8 border-l-2 border-[#6557e8]" /><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#6557e8]">Evidence bracket</p><p className="mt-2 text-xs leading-5 text-[#4a5570]">The book already gave the idea. ReadBuddy helps you see why it matters here.</p></div></div><div className="mt-3 border-t border-[#131c38]/10 pt-3 text-[10px] font-bold text-[#131c38]"><span className="mr-1 text-[#f26f35]">↵</span> Return to reading</div></div>
        </div>
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#6557e8]">Evidence before confidence</p><h2 id="evidence-moment-title" className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.01] tracking-[-.05em] text-[#131c38] sm:text-6xl">Not just an answer. <em className="font-normal text-[#6557e8]">A reason to trust it.</em></h2><p className="mt-5 max-w-xl text-base leading-7 text-[#53607d]">ReadBuddy keeps the book’s own words close to every important connection. You can see the earlier passage, check its page, understand the link, and return to your place.</p><div className="mt-7 grid gap-3 text-sm text-[#33415f]"><div className="flex items-center gap-3"><span className="h-px w-8 bg-[#f26f35]" />Margin Thread follows one meaningful connection.</div><div className="flex items-center gap-3"><span className="h-px w-8 bg-[#6557e8]" />Page Shard holds the earlier passage.</div><div className="flex items-center gap-3"><span className="h-px w-8 bg-[#131c38]" />Evidence Bracket separates source from help.</div><div className="flex items-center gap-3"><span className="h-px w-8 bg-[#b9b3a8]" />Return Tab gets out of the way.</div></div></div>
      </div>
    </section>
  );
}

export function HeroMemoryCanvas() {
  return (
    <div className="relative min-h-[28rem] overflow-hidden border border-[#131c38]/10 bg-[#fffaf2] p-4 shadow-[22px_28px_0_rgba(104,101,232,.12)] sm:min-h-[32rem] sm:p-7">
      <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[#aebdf4]/70" /><div className="absolute right-0 top-0 h-52 w-52 rounded-bl-[9rem] bg-[#ffa181]/65" /><div className="absolute bottom-4 right-7 h-24 w-24 rounded-full bg-[#b9ead7]/65" />
      <div className="relative mx-auto mt-10 max-w-[22rem] border border-[#131c38]/10 bg-[#fffdf8] px-5 pb-6 pt-4 shadow-[0_14px_28px_rgba(19,28,56,.14)] sm:mt-12 sm:px-6"><div className="flex justify-between border-b border-[#131c38]/10 pb-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#68708a]"><span>Reading now</span><span>p.143</span></div><p className="mt-5 font-reading text-[.95rem] leading-7 text-[#3b4662]">But the silence around it made the truth harder to name.</p><div className="relative mt-3 font-reading text-[.95rem] leading-7 text-[#3b4662]"><span className="relative z-10">For the first time, he understood why it had been hidden.</span><span className="absolute inset-x-0 bottom-1 h-3 bg-[#c8cdf8]" /></div></div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 520" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M335 256 C475 243, 450 135, 465 118" stroke="#F26F35" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 6" /><circle cx="335" cy="256" r="5" fill="#F26F35" /><circle cx="465" cy="118" r="5" fill="#F26F35" /></svg>
      <div className="absolute right-3 top-5 w-[10.5rem] border border-[#131c38]/10 bg-[#fffdf8] p-3 shadow-[0_12px_22px_rgba(19,28,56,.12)] sm:right-7 sm:top-7 sm:w-[12rem]"><div className="flex justify-between text-[8px] font-bold uppercase tracking-[.13em] text-[#68708a]"><span>Earlier page</span><span className="text-[#f26f35]">p.47</span></div><p className="mt-2 border-l-2 border-[#6557e8] pl-2 font-reading text-xs leading-5 text-[#3a4666]">“Some truths survive by being left unsaid.”</p></div>
      <div className="absolute bottom-5 left-3 right-3 border border-[#131c38]/10 bg-[#eff0ff] p-3 shadow-[0_12px_22px_rgba(19,28,56,.10)] sm:bottom-7 sm:left-7 sm:right-7 sm:p-4"><div className="flex items-start gap-3"><span className="mt-1 block h-7 border-l-2 border-[#6557e8]" /><div><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#6557e8]">The connection</p><p className="mt-1 text-xs leading-5 text-[#3f4c69]">The earlier passage explains why the silence matters now.</p></div></div><div className="mt-3 flex items-center justify-between border-t border-[#131c38]/10 pt-2 text-[10px] font-bold text-[#131c38]"><span>Evidence · p.47</span><span className="inline-flex items-center gap-1 text-[#6557e8]">Return <CornerDownLeft className="h-3 w-3" /></span></div></div>
    </div>
  );
}
