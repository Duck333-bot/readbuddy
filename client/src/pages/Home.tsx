import { useAuth } from "@/_core/hooks/useAuth";
import { Wordmark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowRight, BookOpen, BrainCircuit, ChevronDown, Compass, Highlighter, LibraryBig, Sparkles, Star, Upload } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useLocation } from "wouter";

const heroWorld = "/manus-storage/readbuddy-hero-world_c6d8d3c6.png";

const intelligenceSteps = [
  { icon: BookOpen, label: "Your book", text: "Every page becomes part of the story." },
  { icon: LibraryBig, label: "Its chapters", text: "ReadBuddy notices the shape of the argument." },
  { icon: Sparkles, label: "Its ideas", text: "Characters, concepts, and important moments stay connected." },
  { icon: Compass, label: "Your reading", text: "Help appears exactly where you are — without spoilers." },
  { icon: Star, label: "What you know", text: "The buddy remembers what has helped you before." },
];

const reveal = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/library");
  }, [isAuthenticated, loading, navigate]);

  const transition = reducedMotion ? { duration: 0 } : { duration: 0.55, ease: "circOut" as const };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf1] text-[#17213e]">
      <header className="relative z-20 border-b border-[#18243d]/10 bg-[#fffaf1]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8">
          <Wordmark className="text-[#17213e]" />
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" className="text-sm font-medium text-[#31405d] hover:bg-[#716cc0]/10 hover:text-[#514b9c]" onClick={() => startLogin()}>Sign in</Button>
            <Button className="hidden rounded-full bg-[#17213e] px-4 text-sm text-white shadow-[0_8px_20px_rgba(23,33,62,.18)] hover:bg-[#26355a] sm:inline-flex" onClick={() => startLogin()}>Start reading <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-[#18243d] pb-20 pt-16 text-[#fffaf1] sm:pb-28 sm:pt-24">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 12% 18%, rgba(130,196,230,.35), transparent 26%), radial-gradient(circle at 87% 17%, rgba(229,127,115,.28), transparent 22%), radial-gradient(circle at 58% 88%, rgba(139,122,216,.26), transparent 24%)" }} />
        <div className="absolute -right-24 top-12 h-72 w-72 rounded-full border border-[#f7d77e]/20" />
        <div className="absolute -right-8 top-28 h-48 w-48 rounded-full border border-[#f7d77e]/15" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-16">
          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reducedMotion ? 0 : .1 } } }}>
            <motion.p variants={reveal} transition={transition} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-[#f7d77e]"><Sparkles className="h-3.5 w-3.5" /> A reading companion with a memory</motion.p>
            <motion.h1 variants={reveal} transition={transition} className="mt-6 max-w-xl font-display text-5xl font-semibold leading-[.98] tracking-[-.045em] sm:text-7xl">Read difficult books with an AI that has <em className="font-normal text-[#f6c5bb]">already read</em> the whole book.</motion.h1>
            <motion.p variants={reveal} transition={transition} className="mt-6 max-w-xl text-base leading-relaxed text-[#dae1ee] sm:text-lg">Highlight a sentence, and ReadBuddy understands the page, the earlier ideas that matter, and where you are in the story. Then it gives you just enough help to continue.</motion.p>
            <motion.div variants={reveal} transition={transition} className="mt-8 flex flex-wrap items-center gap-3"><Button size="lg" className="h-12 rounded-full bg-[#f7d77e] px-6 text-[15px] font-semibold text-[#1a2440] shadow-[0_10px_24px_rgba(0,0,0,.2)] hover:bg-[#ffe596]" onClick={() => startLogin()}>Bring a book <ArrowRight className="ml-1.5 h-4 w-4" /></Button><span className="text-sm text-[#b8c4db]">Private library · spoiler-aware help</span></motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: reducedMotion ? 1 : .96, y: reducedMotion ? 0 : 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...transition, delay: reducedMotion ? 0 : .15 }} className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -inset-8 rounded-[3rem] bg-[#8b7ad8]/25 blur-3xl" />
            <img src={heroWorld} alt="An open book becoming a constellation of connected ideas" className="relative w-full rounded-[2rem] border border-white/15 object-cover shadow-[0_30px_70px_rgba(0,0,0,.32)]" />
            <motion.div animate={reducedMotion ? undefined : { y: [0, -7, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} className="absolute -left-2 bottom-8 max-w-[13rem] rounded-2xl border border-[#f1d8cb]/45 bg-[#fffaf1]/95 p-3.5 text-[#17213e] shadow-[0_14px_30px_rgba(0,0,0,.22)] sm:-left-10 sm:p-4"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#7b70bd]"><Highlighter className="h-3 w-3" /> You highlight</p><p className="mt-2 font-reading text-sm leading-snug">“What does this mean?”</p><div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[#5d579f]"><span className="h-1.5 w-1.5 rounded-full bg-[#e07f73]" /> ReadBuddy remembers p.47</div></motion.div>
            <motion.div animate={reducedMotion ? undefined : { y: [0, 6, 0] }} transition={{ duration: 5.3, repeat: Infinity, ease: "easeInOut", delay: .3 }} className="absolute -right-3 top-8 rounded-2xl border border-[#bae1ee]/35 bg-[#24345a]/90 px-4 py-3 text-xs text-[#fffaf1] shadow-[0_16px_32px_rgba(0,0,0,.2)] sm:-right-7"><p className="font-semibold text-[#9fd9f0]">Context found</p><p className="mt-1 text-[#dce4f4]">Earlier passage · p.47</p></motion.div>
          </motion.div>
        </div>
        <div className="relative mx-auto mt-14 flex max-w-7xl items-center gap-3 px-5 text-xs text-[#b8c4db] sm:px-8"><span className="h-px flex-1 bg-white/15" /><ChevronDown className="h-4 w-4 animate-bounce text-[#f7d77e]" /><span className="h-px flex-1 bg-white/15" /></div>
      </section>

      <section className="relative bg-[#fffaf1] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: .3 }} variants={reveal} transition={transition} className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#716cc0]">The quiet magic</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.035em] text-[#17213e] sm:text-5xl">Every book is a world. <em className="font-normal text-[#ce756b]">ReadBuddy helps you navigate it.</em></h2><p className="mt-5 text-lg leading-relaxed text-[#5c6780]">You do not need to learn a new system. You just read. Behind the scenes, ReadBuddy connects the pieces that make a hard book difficult.</p></motion.div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{intelligenceSteps.map((step, index) => <motion.div key={step.label} initial="hidden" whileInView="show" viewport={{ once: true, amount: .2 }} variants={reveal} transition={{ ...transition, delay: reducedMotion ? 0 : index * .06 }} className="group relative min-h-52 overflow-hidden rounded-3xl border border-[#17213e]/8 bg-white p-5 shadow-[0_12px_30px_rgba(42,52,80,.05)] transition-transform duration-300 hover:-translate-y-1"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eeeafd] text-[#625cad]"><step.icon className="h-5 w-5" /></div><p className="mt-10 font-display text-xl font-semibold text-[#17213e]">{step.label}</p><p className="mt-2 text-sm leading-relaxed text-[#61708b]">{step.text}</p><span className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-[#f5d4c8]/45 transition-transform duration-500 group-hover:scale-150" /></motion.div>)}</div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#eeeafd] py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: .25 }} variants={reveal} transition={transition} className="relative mx-auto w-full max-w-xl rounded-[2rem] border border-[#17213e]/10 bg-[#fffdf8] p-7 shadow-[0_22px_50px_rgba(49,42,91,.15)] sm:p-10"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.16em] text-[#717a93]"><span>Chapter Three</span><span>143</span></div><p className="mt-10 font-reading text-lg leading-[2] text-[#283149] sm:text-xl">Winston had dreamed of his mother again. It must, he supposed, be ten or eleven years since…</p><div className="my-5 h-0.5 w-12 bg-[#f2cf77]" /><p className="font-reading text-lg leading-[2] text-[#283149] sm:text-xl">The memory had returned with a feeling he could not quite name.</p><div className="mt-8 rounded-2xl border border-[#8077c7]/25 bg-[#f4f1ff] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#716cc0]">✦ You’ve seen this before</p><p className="mt-2 text-sm leading-relaxed text-[#4e5670]">This idea first appeared in Chapter 2. Here, the author applies it to memory rather than fear.</p><button className="mt-3 text-xs font-semibold text-[#5d579f]">View earlier passage →</button></div></motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: .25 }} variants={reveal} transition={transition}><p className="text-xs font-bold uppercase tracking-[.18em] text-[#716cc0]">When it is time to read</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.035em] text-[#17213e] sm:text-5xl">The interface <em className="font-normal text-[#ce756b]">gets out of the way.</em></h2><p className="mt-5 max-w-xl text-lg leading-relaxed text-[#5c6780]">No permanent AI sidebar. No noisy dashboard. The book is the visual hero. ReadBuddy appears only when a sentence needs company.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/65 p-4"><Highlighter className="h-5 w-5 text-[#ce756b]" /><p className="mt-3 text-sm font-semibold">Highlight to ask</p><p className="mt-1 text-xs leading-relaxed text-[#66718a]">Explain, simplify, find context, or remember a character.</p></div><div className="rounded-2xl bg-white/65 p-4"><BrainCircuit className="h-5 w-5 text-[#716cc0]" /><p className="mt-3 text-sm font-semibold">Memory when it matters</p><p className="mt-1 text-xs leading-relaxed text-[#66718a]">A small hint connects what you already know.</p></div></div></motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#efc9bc] py-20 sm:py-24"><div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 15% 30%, rgba(255,255,255,.85), transparent 22%), radial-gradient(circle at 82% 68%, rgba(139,122,216,.32), transparent 24%)" }} /><div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#965044]">Your next reading world is waiting</p><h2 className="mt-5 font-display text-4xl font-semibold tracking-[-.04em] text-[#17213e] sm:text-6xl">Bring the book you have been putting off.</h2><p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#4f5263]">ReadBuddy keeps your library private and gives you a calmer way through difficult pages.</p><Button size="lg" className="mt-8 h-12 rounded-full bg-[#17213e] px-7 text-[15px] text-white shadow-[0_10px_22px_rgba(23,33,62,.2)] hover:bg-[#2b3a60]" onClick={() => startLogin()}>Start reading <ArrowRight className="ml-1.5 h-4 w-4" /></Button></div></section>

      <footer className="bg-[#fffaf1] py-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 text-sm text-[#66718a] sm:px-8"><Wordmark className="text-[#17213e]" /><span className="text-[#c6b9aa]">·</span><span>A reading companion for difficult books.</span><span className="ml-auto text-xs">Private by default</span></div></footer>
    </main>
  );
}
