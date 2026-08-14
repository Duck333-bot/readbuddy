import { BrandWordmark as Wordmark } from "@/components/BrandWordmark";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Check, ChevronRight, Highlighter, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getFunnelVisitorId, markFunnelAuthIntent } from "@/lib/funnel";

export const zhiyaHomepagePillars = [
  "Keep your place",
  "Find earlier context",
  "Understand without spoilers",
] as const;

export default function Home() {
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();
  const sendPublicEvent = (event: "landing_view" | "landing_start_clicked") => {
    void fetch("/api/public/landing-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, visitorId: getFunnelVisitorId() }), keepalive: true }).catch(() => undefined);
  };
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/session", { credentials: "include" })
      .then(response => response.ok ? response.json() as Promise<{ authenticated?: boolean }> : null)
      .then(session => { if (!cancelled && session?.authenticated) navigate("/library"); else if (!cancelled) sendPublicEvent("landing_view"); })
      .catch(() => { if (!cancelled) sendPublicEvent("landing_view"); });
    return () => { cancelled = true; };
  }, [navigate]);
  const begin = (create = false) => { markFunnelAuthIntent(); sendPublicEvent("landing_start_clicked"); navigate(create ? "/create-account" : "/login"); };
  const reveal = reducedMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, ease: "circOut" as const } };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfbfe] text-[#18172b]">
      <div className="border-b border-[#7658e6]/10 bg-[#f0ecff] px-5 py-2 text-center text-[11px] font-medium text-[#5d4ac0] sm:px-8 sm:text-xs">For readers who want the whole picture—without skipping ahead.</div>
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center px-5 sm:px-8">
        <Wordmark className="text-[#17162a]" />
        <nav className="ml-auto flex items-center gap-1 sm:gap-3" aria-label="Primary navigation">
          <button className="hidden rounded-full px-4 py-2 text-sm text-[#5e5b73] hover:bg-white sm:block" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })}>How it works</button>
          <Button variant="ghost" className="h-10 rounded-full px-3 text-sm text-[#3c3954]" onClick={() => begin(false)}>Sign in</Button>
          <Button className="h-10 rounded-full bg-[#17162a] px-4 text-white shadow-[0_8px_20px_rgba(37,29,73,.16)] hover:bg-[#34304f]" onClick={() => begin(true)}>Get started <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
        </nav>
      </header>

      <section className="relative px-5 pb-20 pt-8 sm:px-8 sm:pb-28 sm:pt-14">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] overflow-hidden bg-[radial-gradient(circle_at_20%_18%,#d8ccff_0%,transparent_35%),radial-gradient(circle_at_78%_26%,#ffc9e1_0%,transparent_30%),radial-gradient(circle_at_54%_78%,#c8f2e8_0%,transparent_27%),linear-gradient(122deg,#fafbff_0%,#f3efff_47%,#fff8fd_100%)]" />
        <div className="pointer-events-none absolute -right-16 top-32 -z-10 h-80 w-80 rounded-full border-[42px] border-[#ffffff]/50" />
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:gap-16">
          <motion.div {...reveal}>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#8b73f8]/18 bg-white/65 px-3 py-1.5 text-xs font-semibold text-[#6552ca] shadow-sm"><Sparkles className="h-3.5 w-3.5" /> Your books, made easier to return to</p>
            <h1 className="mt-6 max-w-xl font-display text-5xl font-semibold leading-[.98] tracking-[-.055em] text-[#17162a] sm:text-7xl">Read deeper.<br />Remember <span className="text-[#7658e6]">more.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#5e5b73] sm:text-lg">ZhiyaAI is a reading companion for books that ask a lot of you. It keeps the context, so you can stay with the ideas.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4"><Button size="lg" className="h-12 rounded-xl bg-[#7658e6] px-6 font-semibold text-white shadow-[0_10px_24px_rgba(118,88,230,.28)] hover:bg-[#6245d1]" onClick={() => begin(true)}>Start with a book <ArrowRight className="ml-2 h-4 w-4" /></Button><span className="text-sm text-[#6c6881]">No credit card. Your reading stays private.</span></div>
            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#49465e]">{zhiyaHomepagePillars.map(item => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#7658e6]" />{item}</span>)}</div>
          </motion.div>

          <motion.div {...reveal} className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -left-5 top-16 h-32 w-32 rounded-[2rem] bg-[#bcebe4]/65 [transform:rotate(-13deg)]" />
            <div className="absolute -right-4 bottom-8 h-36 w-36 rounded-full bg-[#ffb4cc]/55 blur-[1px]" />
            <span className="absolute -left-4 top-4 z-10 rounded-full bg-[#fff7ca] px-3 py-1.5 text-[10px] font-semibold text-[#645930] shadow-[0_8px_20px_rgba(75,64,37,.13)]">Earlier page · p.47</span>
            <span className="absolute -right-2 top-[-.65rem] z-10 rounded-full bg-[#c7f1e7] px-3 py-1.5 text-[10px] font-semibold text-[#28635b] shadow-[0_8px_20px_rgba(30,92,81,.13)]">No spoilers</span>
            <div className="relative rounded-[1.75rem] border border-white/85 bg-white/90 p-4 shadow-[0_28px_60px_rgba(50,37,111,.17)] backdrop-blur sm:p-6">
              <div className="flex items-center justify-between border-b border-[#e9e7f2] pb-4"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#b9aaff]" /><span className="text-xs font-semibold text-[#5e5b73]">Reading with ZhiyaAI</span></div><span className="text-xs text-[#908da3]">Page 143</span></div>
              <div className="grid gap-4 pt-5 sm:grid-cols-[1.08fr_.92fr]">
                <article className="rounded-xl border border-[#ebe8f3] bg-[#fffefd] p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#7b62e7]">The page you are reading</p><p className="mt-5 font-reading text-xl leading-8 text-[#29263c]">“She understood then that the answer had been there long before the question.”</p><span className="mt-5 inline-flex rounded bg-[#f8e6a8]/75 px-1.5 py-0.5 font-reading text-sm text-[#474158]">had been there long before</span></article>
                <div className="space-y-3"><article className="rounded-xl bg-[#f3efff] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#725bd8]">Earlier context · p.47</p><p className="mt-2 font-reading text-sm leading-6 text-[#46405d]">“Some things only become clear when you have lived beyond them.”</p></article><article className="rounded-xl border border-[#ebe8f3] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-[#332f48]"><Highlighter className="h-4 w-4 text-[#7658e6]" /> Why this matters</p><p className="mt-2 text-sm leading-6 text-[#67637b]">ZhiyaAI connects the two moments without looking ahead.</p><button className="mt-3 inline-flex items-center text-xs font-semibold text-[#7658e6]">See the connection <ChevronRight className="h-3.5 w-3.5" /></button></article></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-[#e9e7f0] bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#7658e6]">A quieter way to get unstuck</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.045em] sm:text-5xl">The book stays at the center.</h2><p className="mt-4 text-base leading-7 text-[#67637b]">ZhiyaAI appears only when the page needs more context—then sends you back to reading.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[{ number: "01", title: "Bring in a book", copy: "Upload a text-based PDF and open the first readable page.", tint: "bg-[#f4f0ff]" }, { number: "02", title: "Keep your momentum", copy: "Ask for help where a sentence or name stops making sense.", tint: "bg-[#fff2f8]" }, { number: "03", title: "Return with context", copy: "See the earlier passage that makes the current page click.", tint: "bg-[#edfbf7]" }].map(item => <article key={item.number} className={`rounded-2xl border border-[#e9e7f0] ${item.tint} p-6`}><span className="text-sm font-semibold text-[#8f85b3]">{item.number}</span><h3 className="mt-9 font-display text-2xl font-semibold tracking-[-.03em]">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#69667d]">{item.copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-18 sm:px-8 sm:py-24"><div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#1d1938] p-8 text-white sm:flex-row sm:items-center sm:p-12"><div><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#c9bdff]">Start reading</p><h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Your next difficult book does not have to be lonely.</h2></div><Button size="lg" className="h-12 shrink-0 rounded-xl bg-white px-6 text-[#211c3b] hover:bg-[#eeeaff]" onClick={() => begin(true)}>Create an account <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>
      <footer className="border-t border-[#e9e7f0] px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm text-[#6b687e]"><Wordmark className="text-[#17162a]" /><span className="text-[#b0adbc]">·</span><span>A reading companion for difficult books.</span><span className="ml-auto text-xs">Private by default</span></div></footer>
    </main>
  );
}
