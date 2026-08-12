import { Wordmark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowRight, ChevronDown, Highlighter, LibraryBig, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

function ThreadProof() {
  return (
    <div className="relative mx-auto w-full max-w-[39rem] rounded-[1.125rem] border border-white/12 bg-[#101d3b] p-5 shadow-[18px_22px_0_rgba(255,210,105,.12)] sm:p-7">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 text-[10px] font-bold uppercase tracking-[.18em] text-[#b8c4db]"><span>Chapter 7</span><span>Page 143</span></div>
      <p className="mt-7 font-reading text-[1.05rem] leading-8 text-[#f9f5ed] sm:text-lg sm:leading-9">The memory returned not as an image, but as an obligation—something he could no longer avoid understanding.</p>
      <div className="relative mt-5 border-b border-[#ffd269]/75 pb-1 font-reading text-[1.05rem] leading-8 text-[#fffdf8] sm:text-lg sm:leading-9">He had felt this before, long before he knew its name.</div>
      <div className="relative mt-7 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="max-w-[18rem] border-l-2 border-[#6557e8] pl-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9bbdf1]">ReadBuddy remembers</p><p className="mt-2 text-sm leading-relaxed text-[#dce4f4]">This connects to an idea you saw earlier about memory and responsibility.</p></div>
        <div className="relative flex min-h-20 items-end justify-end pr-1"><span className="rb-thread absolute bottom-5 right-7 h-16" /><span className="rb-thread-node absolute right-[0.34rem] top-0" /><span className="text-xs font-semibold text-[#9bbdf1]">p.47</span></div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/library");
  }, [isAuthenticated, loading, navigate]);

  const transition = reducedMotion ? { duration: 0 } : { duration: 0.5, ease: "circOut" as const };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95">
        <nav className="mx-auto flex h-[4.5rem] max-w-7xl items-center px-5 sm:px-8">
          <Wordmark className="text-foreground" />
          <div className="ml-auto flex items-center gap-2"><Button variant="ghost" className="h-10 px-3 text-sm" onClick={() => startLogin()}>Sign in</Button><Button className="hidden h-10 rounded-xl bg-[var(--rb-ink)] px-4 text-[var(--rb-paper)] hover:bg-[#24335e] sm:inline-flex" onClick={() => startLogin()}>Start reading <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div>
        </nav>
      </header>

      <section className="overflow-hidden bg-[var(--rb-night)] px-5 py-14 text-[var(--rb-paper)] sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-16">
          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reducedMotion ? 0 : 0.09 } } }}>
            <motion.p variants={fadeUp} transition={transition} className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-sun)]">A reading companion with a memory</motion.p>
            <motion.h1 variants={fadeUp} transition={transition} className="mt-5 max-w-xl font-display text-5xl font-semibold leading-[.96] tracking-[-.06em] sm:text-7xl">Read difficult books without getting lost.</motion.h1>
            <motion.p variants={fadeUp} transition={transition} className="mt-6 max-w-lg text-base leading-relaxed text-[#c9d3ed] sm:text-lg">ReadBuddy understands the whole book, remembers what you’ve read, and never spoils ahead.</motion.p>
            <motion.div variants={fadeUp} transition={transition} className="mt-8 flex flex-wrap items-center gap-4"><Button size="lg" className="h-12 rounded-xl bg-[var(--rb-sun)] px-6 font-semibold text-[var(--rb-night)] hover:bg-[#ffe396]" onClick={() => startLogin()}>Start reading <ArrowRight className="ml-2 h-4 w-4" /></Button><span className="text-sm text-[#aeb8ce]">Private library · grounded answers</span></motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reducedMotion ? 0 : .12 }}><ThreadProof /></motion.div>
        </div>
        <div className="mx-auto mt-14 flex max-w-7xl items-center gap-3 text-[#9bbdf1]"><span className="h-px flex-1 bg-white/15" /><ChevronDown className="h-4 w-4" /><span className="h-px flex-1 bg-white/15" /></div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-violet)]">One connection at a time</p><div className="mt-5 grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><h2 className="max-w-xl font-display text-4xl font-semibold leading-tight tracking-[-.05em] sm:text-6xl">Every book is full of connections. <em className="font-normal text-[var(--rb-coral)]">ReadBuddy remembers the ones that matter.</em></h2><div className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">You read normally. When a difficult moment needs context, ReadBuddy can trace one grounded path to the earlier idea, character, or passage that makes it clear.</div></div>
          <div className="mt-16 grid gap-12 border-y border-border py-10 md:grid-cols-3 md:gap-8"><div><Highlighter className="h-5 w-5 text-[var(--rb-coral)]" /><p className="mt-5 font-display text-2xl font-semibold">Highlight</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ask only when a sentence needs help.</p></div><div className="relative"><span className="rb-thread absolute -left-6 top-0 hidden h-10 md:block" /><LibraryBig className="h-5 w-5 text-[var(--rb-violet)]" /><p className="mt-5 font-display text-2xl font-semibold">Follow the thread</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">See exactly which earlier passage matters and why.</p></div><div><ShieldCheck className="h-5 w-5 text-[var(--rb-mint)]" /><p className="mt-5 font-display text-2xl font-semibold">Keep reading</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Spoiler boundaries protect the story ahead.</p></div></div>
        </div>
      </section>

      <section className="bg-[#f2ecdf] px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div className="rounded-[1.125rem] bg-[var(--rb-ink)] p-8 text-[var(--rb-paper)] sm:p-12"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--rb-sun)]">The book becomes known</p><p className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-.05em]">Bring a book. Begin reading as soon as it is ready.</p><div className="mt-10 space-y-4 text-sm text-[#c9d3ed]"><p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[var(--rb-sun)]" />Text and structure ready <span className="ml-auto text-[var(--rb-paper)]">Start reading →</span></p><p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[var(--rb-violet)]" />Chapters and characters continue forming</p><p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[var(--rb-sky)]" />Important ideas and distant moments connect</p></div></div><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-violet)]">Reading first. AI second.</p><h2 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-.05em] text-[var(--rb-ink)]">The book stays at the center.</h2><p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">No permanent chatbot. No generic dashboard. Only a calm book surface and help that appears at the right moment, grounded in what you have already read.</p><Button className="mt-7 h-11 rounded-xl bg-[var(--rb-ink)] px-5 text-[var(--rb-paper)] hover:bg-[#24335e]" onClick={() => startLogin()}>Bring a book <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div></section>

      <footer className="border-t border-border bg-background py-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 text-sm text-muted-foreground sm:px-8"><Wordmark className="text-foreground" /><span className="text-border">·</span><span>A reading companion for difficult books.</span><span className="ml-auto text-xs">Private by default</span></div></footer>
    </main>
  );
}
