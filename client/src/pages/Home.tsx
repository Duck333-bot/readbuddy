import { Wordmark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, CornerDownLeft, Highlighter, Languages, Quote, Search, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getFunnelVisitorId, markFunnelAuthIntent } from "@/lib/funnel";
import { trpc } from "@/lib/trpc";
import { EvidenceMoment, HeroMemoryCanvas, MemorySequence, SpoilerBoundary } from "@/components/marketing/MemorySequence";

const moments = [
  { icon: Highlighter, label: "When a sentence stops you", title: "Highlight it. Stay in the book.", copy: "Ask for a clearer explanation where you are, without opening a chat window or losing your place.", sample: "“What does this actually mean?”" },
  { icon: Search, label: "When the name feels familiar", title: "You forgot who Thomas is. ReadBuddy didn’t.", copy: "A quiet reminder shows only what the reader has reached, with the pages where that person appeared.", sample: "First seen p.18 · Last seen p.86" },
  { icon: Quote, label: "When an earlier page matters", title: "See the connection, not just the answer.", copy: "ReadBuddy traces the smallest useful path back to the earlier passage that makes this moment click.", sample: "Earlier connection → p.47" },
  { icon: ShieldCheck, label: "When you need to ask safely", title: "Ask without learning what happens next.", copy: "Unread pages are excluded before ReadBuddy answers. Spoiler protection is part of how it looks for evidence.", sample: "Only pages you’ve reached" },
] as const;

const stages = [
  ["1", "Text and structure are ready", "Start reading immediately."],
  ["2", "ReadBuddy gets to know the book", "Chapters, people, and ideas keep forming in the background."],
  ["3", "Connections appear when they help", "No study dashboard. Just better reading."],
] as const;

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();
  const visitorTracking = trpc.analytics.trackVisitor.useMutation();
  useEffect(() => { if (!loading && isAuthenticated) navigate("/library"); }, [isAuthenticated, loading, navigate]);
  useEffect(() => { if (!isAuthenticated) visitorTracking.mutate({ event: "landing_view", visitorId: getFunnelVisitorId() }); }, [isAuthenticated]);
  const begin = (create = false) => { markFunnelAuthIntent(); visitorTracking.mutate({ event: "landing_start_clicked", visitorId: getFunnelVisitorId() }); navigate(create ? "/create-account" : "/login"); };
  const motionProps = reducedMotion ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: .46, ease: "circOut" as const } };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff9ef] text-[#131c38]">
      <header className="sticky top-0 z-20 border-b border-[#0e1838]/10 bg-[#fbf8f0]/92 backdrop-blur-sm">
        <nav className="mx-auto flex h-[4.5rem] max-w-7xl items-center px-5 sm:px-8">
          <Wordmark className="text-[#0e1838]" />
          <div className="ml-auto flex items-center gap-2"><Button variant="ghost" className="h-10 px-3 text-sm" onClick={() => begin(false)}>Log in</Button><Button className="h-10 rounded-full bg-[#0e1838] px-4 text-[#fbf8f0] hover:bg-[#1b2c61]" onClick={() => begin(true)}>Begin reading <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div>
        </nav>
      </header>
      <section className="relative overflow-hidden bg-[var(--rb-terrain-paper)] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-24">
        <div className="absolute -left-28 bottom-0 h-72 w-72 bg-[var(--rb-terrain-periwinkle)]/66 [clip-path:polygon(0_0,100%_0,76%_82%,0_100%)]" /><div className="absolute right-0 top-0 h-[30rem] w-[31rem] bg-[var(--rb-terrain-blush)]/62 [clip-path:polygon(0_0,100%_0,100%_100%,33%_76%)]" /><div className="absolute right-[28%] top-5 h-28 w-28 bg-[var(--rb-terrain-mint)]/64 [clip-path:polygon(25%_0,100%_0,100%_100%,0_75%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:gap-16">
          <motion.div {...motionProps}>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--rb-terrain-ink)]">Memory · no spoilers · evidence</p>
            <h1 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-[.93] tracking-[-.06em] text-[var(--rb-terrain-ink)] sm:text-7xl">A book that <em className="font-normal text-[var(--rb-terrain-coral)]">remembers with you.</em></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#4d5974] sm:text-lg">ReadBuddy remembers what you have reached, finds the earlier page that matters, and helps at the exact moment something stops making sense.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4"><Button size="lg" className="h-12 rounded-full bg-[#131c38] px-6 font-semibold text-[#fff9ef] hover:bg-[#24335e]" onClick={() => begin(true)}>Bring your next book <ArrowRight className="ml-2 h-4 w-4" /></Button><span className="text-sm text-[#59657f]">Your books and reading stay private.</span></div>
          </motion.div>
          <motion.div {...motionProps}><HeroMemoryCanvas /></motion.div>
        </div>
      </section>
      <MemorySequence />
      <SpoilerBoundary />
      <EvidenceMoment />
      <section className="px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-7xl">
        <div className="grid gap-7 border-b border-[#0e1838]/12 pb-10 lg:grid-cols-[.9fr_1.1fr] lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#7565e8]">The difference is context</p><h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-[-.045em] sm:text-6xl">You remember the sentence. <em className="font-normal text-[#7565e8]">ReadBuddy remembers where it came from.</em></h2></div><p className="max-w-xl text-base leading-7 text-[#666b7c]">Kindle holds the page. ChatGPT answers a question. ReadBuddy keeps the connection between this line, earlier evidence, and your own reading history visible.</p></div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[1.25rem] border border-[#0e1838]/12 bg-[#0e1838]/12 md:grid-cols-2">{moments.map((moment, index) => { const Icon = moment.icon; return <article key={moment.title} className="bg-[#fbf8f0] p-6 transition hover:bg-[#f3efff] sm:p-8"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#7565e8]" /><span className="font-mono text-[10px] text-[#8a8d9b]">0{index + 1}</span></div><p className="mt-8 text-[10px] font-bold uppercase tracking-[.16em] text-[#7565e8]">{moment.label}</p><h3 className="mt-3 max-w-sm font-display text-2xl font-semibold leading-tight">{moment.title}</h3><p className="mt-3 max-w-sm text-sm leading-6 text-[#666b7c]">{moment.copy}</p><p className="mt-7 inline-flex border-b border-[#7565e8]/45 pb-1 font-reading text-sm italic text-[#0e1838]">{moment.sample}</p></article>; })}</div>
      </div></section>
      <section className="bg-[#eeeafb] px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.06fr_.94fr] lg:items-center">
        <div className="rounded-[1.5rem] bg-[#fbf8f0] p-6 shadow-[14px_18px_0_rgba(117,101,232,.13)] sm:p-9"><div className="flex items-center justify-between border-b border-[#0e1838]/10 pb-4"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7565e8]">A book becomes known</span><BookOpen className="h-4 w-4 text-[#7565e8]" /></div><div className="mt-7 space-y-5">{stages.map(([number, title, copy], i) => <div key={number} className="flex items-center gap-4"><span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-[#0e1838] text-[#f2c65b]" : "border border-[#7565e8] text-[#7565e8]"}`}>{number}</span><div><p className="font-medium">{title}</p><p className="text-sm text-[#727687]">{copy}</p></div></div>)}</div></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#7565e8]">Reading first. AI second.</p><h2 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-.045em] sm:text-5xl">Give ReadBuddy a book. It will earn its place in the margin.</h2><p className="mt-5 max-w-xl text-base leading-7 text-[#606577]">Upload a PDF, open the first readable page, and ask for help only when you need it. The Book Brain continues quietly, so the book never has to wait for the AI.</p><Button className="mt-7 h-11 rounded-full bg-[#0e1838] px-5 text-[#fbf8f0] hover:bg-[#1b2c61]" onClick={() => begin(true)}>Start with a book <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
      </div></section>
      <section className="px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-4xl text-center"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#7565e8]">A private place to think</p><h2 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-.05em] sm:text-6xl">Not a book chatbot. <em className="font-normal text-[#7565e8]">Your reading life, remembered.</em></h2><p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#666b7c]">Your highlights, questions, vocabulary, and notes stay connected to the pages that made them matter.</p><div className="mt-9 flex flex-wrap justify-center gap-3 text-sm"><span className="inline-flex items-center gap-2 rounded-full border border-[#0e1838]/12 px-4 py-2"><ShieldCheck className="h-4 w-4 text-[#7565e8]" /> Evidence before claims</span><span className="inline-flex items-center gap-2 rounded-full border border-[#0e1838]/12 px-4 py-2"><Languages className="h-4 w-4 text-[#7565e8]" /> Help in your language</span><span className="inline-flex items-center gap-2 rounded-full border border-[#0e1838]/12 px-4 py-2"><CornerDownLeft className="h-4 w-4 text-[#7565e8]" /> Return to the exact page</span></div><Button size="lg" className="mt-9 h-12 rounded-full bg-[#7565e8] px-7 text-white hover:bg-[#6150cf]" onClick={() => begin(true)}>Create your reading space <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>
      <footer className="border-t border-[#0e1838]/10 px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm text-[#686d7c]"><Wordmark className="text-[#0e1838]" /><span className="text-[#b3b1aa]">·</span><span>A reading companion for difficult books.</span><span className="ml-auto text-xs">Private by default</span></div></footer>
    </main>
  );
}
