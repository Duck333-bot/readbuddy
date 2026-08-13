import { CornerDownLeft, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { MarginMark } from "./MarginMark";

export const memorySequenceStages = [
  {
    eyebrow: "Memory · current sentence",
    title: "A sentence stops you.",
    copy: "ReadBuddy begins with the exact line in front of you—not a detached chat window.",
  },
  {
    eyebrow: "Memory · earlier passage",
    title: "It finds the page that matters.",
    copy: "One small Page Shard brings forward the earlier passage you have already reached.",
  },
  {
    eyebrow: "Memory · visible connection",
    title: "The connection stays visible.",
    copy: "A single Margin Thread shows why these two moments belong together.",
  },
  {
    eyebrow: "Grounded understanding",
    title: "The book gives the evidence.",
    copy: "ReadBuddy separates the source from its short explanation, so you can check both.",
  },
  {
    eyebrow: "Return to reading",
    title: "Then the help gets out of the way.",
    copy: "A Return Tab carries the useful context back to the exact line you were reading.",
  },
] as const;

export function stageIndexForProgress(progress: number) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  return Math.min(memorySequenceStages.length - 1, Math.floor(safeProgress * memorySequenceStages.length));
}

function SequenceCanvas({ activeStage }: { activeStage: number }) {
  const showEarlier = activeStage >= 1;
  const showThread = activeStage >= 2;
  const showContext = activeStage >= 3;
  const showReturn = activeStage >= 4;

  return (
    <div className={`rb-memory-canvas stage-${activeStage} relative min-h-[32rem] overflow-hidden border border-[var(--rb-terrain-ink)]/10 bg-[var(--rb-terrain-paper)] p-5 shadow-[20px_28px_0_rgba(170,184,246,.36)] sm:min-h-[37rem] sm:p-8`}>
      <div className="absolute -left-16 top-0 h-48 w-48 bg-[var(--rb-terrain-powder)]/80 [clip-path:polygon(0_0,100%_0,74%_78%,0_100%)]" />
      <div className="absolute right-0 top-0 h-52 w-56 bg-[var(--rb-terrain-blush)]/80 [clip-path:polygon(0_0,100%_0,100%_100%,24%_72%)]" />
      <div className="absolute -bottom-12 right-10 h-44 w-48 bg-[var(--rb-terrain-mint)]/80 [clip-path:polygon(25%_0,100%_0,100%_100%,0_75%)]" />

      <div className="rb-memory-current relative z-10 mx-auto mt-14 max-w-[25rem] border border-[var(--rb-terrain-ink)]/10 bg-[#fffdf8] px-5 pb-7 pt-5 shadow-[0_16px_28px_rgba(24,33,61,.12)] sm:mt-16 sm:px-7">
        <div className="flex items-center justify-between border-b border-[var(--rb-terrain-ink)]/10 pb-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#68708a]">
          <span>Reading now</span><span>p.143</span>
        </div>
        <div className="space-y-2.5 pt-6 font-reading text-[.9rem] leading-6 text-[#3a4666] sm:text-[1rem] sm:leading-7">
          <p>He had expected the letter to explain everything.</p>
          <p className="relative -mx-1 px-1"><span className="relative z-10">But the silence around it made the truth harder to name.</span><span className="absolute inset-x-0 bottom-1 h-3 bg-[var(--rb-terrain-butter)]/70" /></p>
          <p>For the first time, he understood why it had been hidden.</p>
        </div>
        <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#68708a]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--rb-terrain-coral)]" /> Current sentence</div>
      </div>

      <svg className={`pointer-events-none absolute inset-0 h-full w-full rb-terrain-reveal ${showThread ? "opacity-100" : "opacity-0"}`} viewBox="0 0 600 580" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path className="rb-margin-thread rb-memory-thread-path" d="M376 292 C505 260, 505 148, 472 127" strokeWidth="1.6" />
        <circle cx="376" cy="292" r="5" fill="var(--rb-terrain-coral)" /><circle cx="472" cy="127" r="5" fill="var(--rb-terrain-coral)" />
      </svg>

      <div className={`rb-page-shard rb-memory-earlier absolute right-3 top-7 z-20 w-[11rem] border border-[var(--rb-terrain-ink)]/10 p-3 sm:right-7 sm:top-9 sm:w-[13rem] ${showEarlier ? "translate-y-0 opacity-100 shadow-[0_22px_32px_rgba(24,33,61,.16)]" : "translate-y-9 opacity-0"}`}>
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[.13em] text-[#68708a]"><span>Earlier page</span><span className="text-[var(--rb-terrain-coral)]">p.47</span></div>
        <div className="rb-evidence-bracket mt-3 pl-2 font-reading text-xs leading-5 text-[#394563]">“Some truths survive by being left unsaid.”</div>
        <div className="mt-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--rb-terrain-ink)]"><MapPin className="h-3 w-3 text-[var(--rb-terrain-coral)]" /> Evidence coordinate</div>
      </div>

      <div className={`rb-memory-connection absolute bottom-10 left-3 right-3 border border-[var(--rb-terrain-ink)]/10 bg-[#eef0ff] p-4 shadow-[0_14px_22px_rgba(24,33,61,.10)] sm:left-7 sm:right-7 sm:p-5 ${showContext ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-[.96] opacity-0"}`}>
        <div className="flex items-start gap-3"><MarginMark kind="evidence" className="mt-0.5 h-7 w-7 shrink-0 text-[var(--rb-terrain-coral)]" /><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--rb-terrain-ink)]">What this changes</p><p className="mt-2 text-sm leading-6 text-[#394563]">The earlier line shows that the silence is deliberate. This moment is not about missing information—it is about someone protecting it.</p></div></div>
      </div>

      <div className={`rb-return-tab absolute bottom-0 right-7 flex items-center gap-2 px-4 py-3 text-xs font-semibold text-[var(--rb-terrain-ink)] rb-terrain-reveal ${showReturn ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}><MarginMark kind="return" className="h-4 w-4 text-[var(--rb-terrain-coral)]" /> Return to p.143</div>
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
    <section ref={sectionRef} className="relative bg-[var(--rb-terrain-periwinkle)]/42 px-5 py-16 sm:px-8 sm:py-24 lg:min-h-[190vh] lg:py-0" aria-labelledby="memory-sequence-title">
      <div className="mx-auto max-w-7xl lg:sticky lg:top-[4.5rem] lg:flex lg:min-h-[calc(100vh-4.5rem)] lg:items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-terrain-ink)]">Memory</p>
            <h2 id="memory-sequence-title" className="mt-4 max-w-md font-display text-4xl font-semibold leading-[.98] tracking-[-.05em] text-[var(--rb-terrain-ink)] sm:text-6xl">The answer is useful. <em className="font-normal text-[var(--rb-terrain-coral)]">The path back is the magic.</em></h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[#44516f]">ReadBuddy finds the smallest earlier piece of the book that turns this sentence into something you can understand—and keeps that path visible.</p>
            <div className="mt-8 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible" role="tablist" aria-label="ReadBuddy memory sequence">
              {memorySequenceStages.map((item, index) => (
                <button key={item.eyebrow} type="button" role="tab" aria-selected={activeStage === index} onClick={() => setActiveStage(index)} className={`shrink-0 border px-3 py-2 text-left transition-colors lg:flex lg:w-full lg:items-center lg:gap-3 lg:px-4 ${activeStage === index ? "border-[var(--rb-terrain-ink)] bg-[var(--rb-terrain-paper)] text-[var(--rb-terrain-ink)]" : "border-transparent text-[#56617d] hover:border-[var(--rb-terrain-ink)]/15"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ${activeStage === index ? "bg-[var(--rb-terrain-coral)] text-white" : "border border-current"}`}>{index + 1}</span><span className="hidden text-sm lg:inline">{item.title}</span><span className="text-[10px] font-bold uppercase tracking-[.14em] lg:hidden">{index + 1}/5</span>
                </button>
              ))}
            </div>
            <div className="mt-8 border-l-2 border-[var(--rb-terrain-coral)] pl-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--rb-terrain-coral)]">{stage.eyebrow}</p><p className="mt-2 font-display text-2xl font-semibold leading-tight text-[var(--rb-terrain-ink)]">{stage.title}</p><p className="mt-2 max-w-md text-sm leading-6 text-[#44516f]">{stage.copy}</p></div>
          </div>
          <SequenceCanvas activeStage={activeStage} />
        </div>
      </div>
    </section>
  );
}

export function SpoilerBoundary() {
  return (
    <section className="relative overflow-hidden bg-[var(--rb-terrain-powder)]/62 px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="spoiler-title">
      <div className="absolute -left-10 bottom-0 h-40 w-56 bg-[var(--rb-terrain-blush)]/55 [clip-path:polygon(0_20%,88%_0,100%_100%,0_100%)]" />
      <div className="absolute right-0 top-0 h-44 w-48 bg-[var(--rb-terrain-butter)]/72 [clip-path:polygon(0_0,100%_0,100%_100%,35%_72%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-16">
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-terrain-ink)]">Spoiler awareness</p><h2 id="spoiler-title" className="mt-4 max-w-lg font-display text-4xl font-semibold leading-[.98] tracking-[-.05em] text-[var(--rb-terrain-ink)] sm:text-6xl">Only what <em className="font-normal text-[var(--rb-terrain-coral)]">you’ve reached.</em></h2><p className="mt-5 max-w-lg text-base leading-7 text-[#44516f]">ReadBuddy does not look through unread pages and promise not to spoil them. It leaves them outside the answer from the beginning.</p><div className="mt-7 flex items-center gap-3 text-sm text-[#33415f]"><MarginMark kind="spoiler" className="h-7 w-7 text-[var(--rb-terrain-coral)]" /><span>Future pages are unavailable, not merely hidden.</span></div></div>
        <div className="relative min-h-[25rem] border border-[var(--rb-terrain-ink)]/10 bg-[var(--rb-terrain-paper)] p-6 shadow-[18px_24px_0_rgba(183,226,204,.52)] sm:min-h-[29rem] sm:p-9" role="img" aria-label="Earlier and current passages are available while unread pages recede behind a paper veil">
          <div className="absolute right-4 top-5 w-[11rem] rotate-[6deg] border border-[var(--rb-terrain-ink)]/8 bg-[#fffdf8]/65 p-4 opacity-45 blur-[1.5px] sm:right-10 sm:top-8"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#68708a]">Unread · p.144+</p><div className="mt-4 space-y-2"><span className="block h-2 bg-[#d6d9e4]" /><span className="block h-2 w-4/5 bg-[#d6d9e4]" /><span className="block h-2 w-3/5 bg-[#d6d9e4]" /></div></div>
          <div className="absolute right-16 top-16 w-[11rem] rotate-[2deg] border border-[var(--rb-terrain-ink)]/8 bg-[#fffdf8]/75 p-4 opacity-55 blur-[.8px] sm:right-28 sm:top-20"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#68708a]">Unread · p.143</p><div className="mt-4 space-y-2"><span className="block h-2 bg-[#d6d9e4]" /><span className="block h-2 w-4/5 bg-[#d6d9e4]" /><span className="block h-2 w-3/5 bg-[#d6d9e4]" /></div></div>
          <div className="rb-page-shard relative z-10 max-w-[19rem] border border-[var(--rb-terrain-ink)]/10 p-5"><div className="flex items-center justify-between border-b border-[var(--rb-terrain-ink)]/10 pb-3 text-[9px] font-bold uppercase tracking-[.15em] text-[#68708a]"><span>Available context</span><span className="text-[var(--rb-terrain-coral)]">p.47</span></div><p className="mt-5 font-reading text-sm leading-7 text-[#3d4965]">“He learned early that silence could be an act of care.”</p><div className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-[var(--rb-terrain-ink)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--rb-terrain-mint)]" /> Reached by the reader</div></div>
          <div className="absolute bottom-6 left-6 right-6 border-l-2 border-[var(--rb-terrain-coral)] bg-[#fffdf8]/85 px-4 py-3 text-sm leading-6 text-[#3f4b68] sm:bottom-9 sm:left-9 sm:right-9">The useful earlier passage stays available. The unread pages recede before ReadBuddy answers.</div>
        </div>
      </div>
    </section>
  );
}

export function EvidenceMoment() {
  return (
    <section className="overflow-hidden bg-[var(--rb-terrain-paper)] px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="evidence-moment-title">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_.92fr] lg:items-center lg:gap-16">
        <div className="relative min-h-[26rem] overflow-hidden border border-[var(--rb-terrain-ink)]/10 bg-[var(--rb-terrain-mint)]/62 p-6 shadow-[18px_24px_0_rgba(243,190,201,.38)] sm:min-h-[30rem] sm:p-9">
          <div className="absolute right-0 top-0 h-40 w-40 bg-[var(--rb-terrain-butter)] [clip-path:polygon(0_0,100%_0,100%_100%,28%_68%)]" />
          <div className="rb-page-shard relative max-w-[19rem] border border-[var(--rb-terrain-ink)]/10 p-5"><div className="flex items-center justify-between border-b border-[var(--rb-terrain-ink)]/10 pb-3 text-[9px] font-bold uppercase tracking-[.15em] text-[#68708a]"><span>Earlier passage</span><span>p.47</span></div><p className="mt-5 font-reading text-sm leading-7 text-[#3d4965]">“He learned early that silence could be an act of care.”</p><div className="mt-5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-[var(--rb-terrain-ink)]"><MarginMark kind="memory" className="h-4 w-4 text-[var(--rb-terrain-coral)]" /> Page Shard</div></div>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 620 440" fill="none" preserveAspectRatio="none" aria-hidden="true"><path className="rb-margin-thread" d="M218 165 C350 185, 365 295, 458 305" strokeWidth="2" /><circle cx="218" cy="165" r="5" fill="var(--rb-terrain-coral)" /><circle cx="458" cy="305" r="5" fill="var(--rb-terrain-coral)" /></svg>
          <div className="absolute bottom-7 right-5 max-w-[16rem] border border-[var(--rb-terrain-ink)]/10 bg-[#fffdf8] p-4 shadow-[0_16px_28px_rgba(24,33,61,.14)] sm:bottom-9 sm:right-8"><div className="flex gap-3"><MarginMark kind="evidence" className="mt-0.5 h-7 w-7 shrink-0 text-[var(--rb-terrain-coral)]" /><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--rb-terrain-ink)]">Evidence bracket</p><p className="mt-2 text-xs leading-5 text-[#4a5570]">The book already gave the idea. ReadBuddy helps you see why it matters here.</p></div></div><div className="rb-return-tab mt-4 inline-flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-[var(--rb-terrain-ink)]"><MarginMark kind="return" className="h-3.5 w-3.5 text-[var(--rb-terrain-coral)]" /> Return to p.143</div></div>
        </div>
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-terrain-ink)]">Grounded understanding</p><h2 id="evidence-moment-title" className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.01] tracking-[-.05em] text-[var(--rb-terrain-ink)] sm:text-6xl">Understand <em className="font-normal text-[var(--rb-terrain-coral)]">with evidence.</em></h2><p className="mt-5 max-w-xl text-base leading-7 text-[#44516f]">ReadBuddy keeps the book’s own words close to every important connection. You can see the earlier passage, check its page, understand the link, and return to your place.</p><div className="mt-7 grid gap-3 text-sm text-[#33415f]"><div className="flex items-center gap-3"><MarginMark kind="context" className="h-6 w-6 text-[var(--rb-terrain-coral)]" />One Margin Thread follows one meaningful connection.</div><div className="flex items-center gap-3"><MarginMark kind="memory" className="h-6 w-6 text-[var(--rb-terrain-ink)]" />A Page Shard holds the earlier passage.</div><div className="flex items-center gap-3"><MarginMark kind="evidence" className="h-6 w-6 text-[var(--rb-terrain-periwinkle)]" />An Evidence Bracket separates source from help.</div><div className="flex items-center gap-3"><MarginMark kind="return" className="h-6 w-6 text-[var(--rb-terrain-ink)]" />A Return Tab gets out of the way.</div></div></div>
      </div>
    </section>
  );
}

export function HeroMemoryCanvas() {
  return (
    <div className="relative min-h-[28rem] overflow-hidden border border-[var(--rb-terrain-ink)]/10 bg-[var(--rb-terrain-paper)] p-4 shadow-[22px_30px_0_rgba(170,184,246,.34)] sm:min-h-[32rem] sm:p-7">
      <div className="absolute -left-16 bottom-0 h-48 w-48 bg-[var(--rb-terrain-periwinkle)]/72 [clip-path:polygon(0_0,100%_0,78%_82%,0_100%)]" /><div className="absolute right-0 top-0 h-52 w-52 bg-[var(--rb-terrain-blush)]/72 [clip-path:polygon(0_0,100%_0,100%_100%,28%_72%)]" /><div className="absolute bottom-4 right-7 h-24 w-24 bg-[var(--rb-terrain-mint)]/76 [clip-path:polygon(25%_0,100%_0,100%_100%,0_75%)]" />
      <div className="relative mx-auto mt-10 max-w-[22rem] border border-[var(--rb-terrain-ink)]/10 bg-[#fffdf8] px-5 pb-6 pt-4 shadow-[0_14px_28px_rgba(24,33,61,.14)] sm:mt-12 sm:px-6"><div className="flex justify-between border-b border-[var(--rb-terrain-ink)]/10 pb-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#68708a]"><span>Reading now</span><span>p.143</span></div><p className="mt-5 font-reading text-[.95rem] leading-7 text-[#3b4662]">But the silence around it made the truth harder to name.</p><div className="relative mt-3 font-reading text-[.95rem] leading-7 text-[#3b4662]"><span className="relative z-10">For the first time, he understood why it had been hidden.</span><span className="absolute inset-x-0 bottom-1 h-3 bg-[var(--rb-terrain-butter)]/75" /></div></div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 520" fill="none" preserveAspectRatio="none" aria-hidden="true"><path className="rb-margin-thread" d="M335 256 C475 243, 450 135, 465 118" strokeWidth="1.5" /><circle cx="335" cy="256" r="5" fill="var(--rb-terrain-coral)" /><circle cx="465" cy="118" r="5" fill="var(--rb-terrain-coral)" /></svg>
      <div className="rb-page-shard absolute right-3 top-5 w-[10.5rem] border border-[var(--rb-terrain-ink)]/10 p-3 sm:right-7 sm:top-7 sm:w-[12rem]"><div className="flex justify-between text-[8px] font-bold uppercase tracking-[.13em] text-[#68708a]"><span>Earlier page</span><span className="text-[var(--rb-terrain-coral)]">p.47</span></div><p className="rb-evidence-bracket mt-2 pl-2 font-reading text-xs leading-5 text-[#3a4666]">“Some truths survive by being left unsaid.”</p></div>
      <div className="absolute bottom-5 left-3 right-3 border border-[var(--rb-terrain-ink)]/10 bg-[#eef0ff] p-3 shadow-[0_12px_22px_rgba(24,33,61,.10)] sm:bottom-7 sm:left-7 sm:right-7 sm:p-4"><div className="flex items-start gap-3"><MarginMark kind="evidence" className="mt-0.5 h-6 w-6 shrink-0 text-[var(--rb-terrain-coral)]" /><div><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[var(--rb-terrain-ink)]">The connection</p><p className="mt-1 text-xs leading-5 text-[#3f4c69]">The earlier passage explains why the silence matters now.</p></div></div><div className="mt-3 flex items-center justify-between border-t border-[var(--rb-terrain-ink)]/10 pt-2 text-[10px] font-bold text-[var(--rb-terrain-ink)]"><span>Evidence · p.47</span><span className="inline-flex items-center gap-1 text-[var(--rb-terrain-coral)]"><MarginMark kind="return" className="h-3.5 w-3.5" /> Return</span></div></div>
    </div>
  );
}
