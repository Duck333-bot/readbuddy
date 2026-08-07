import { useAuth } from "@/_core/hooks/useAuth";
import { Wordmark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import {
  ArrowRight,
  BookOpen,
  Languages,
  Lightbulb,
  NotebookPen,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const steps = [
  {
    icon: Upload,
    title: "Upload the PDF",
    body: "Drop in any book, paper, or textbook. ReadBuddy pulls out the text page by page and keeps the original file in your private library.",
  },
  {
    icon: BookOpen,
    title: "Read without clutter",
    body: "One page at a time, set in a typeface built for long reading. No sidebars fighting for attention, no infinite scroll.",
  },
  {
    icon: Sparkles,
    title: "Highlight what confuses you",
    body: "Select a sentence and your reading buddy appears. Ask for a plain-English explanation, a simpler rewrite, a translation, or a definition.",
  },
  {
    icon: NotebookPen,
    title: "Keep what you learned",
    body: "Save any answer to your notebook with the sentence that prompted it, then jump straight back to that page later.",
  },
];

const modes = [
  { icon: Lightbulb, label: "Explain", copy: "What it means and why it matters here." },
  { icon: Sparkles, label: "Simplify", copy: "The same sentence, in easier words." },
  { icon: Languages, label: "Translate", copy: "Into any language you choose." },
  { icon: BookOpen, label: "Define", copy: "Key terms, as used in this passage." },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/library");
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <span className="text-lg">
            <Wordmark />
          </span>
          <Button
            variant="ghost"
            className="ml-auto text-sm"
            onClick={() => startLogin()}>
            Sign in
          </Button>
        </div>
      </header>

      {/* Hero — asymmetric: copy left, sample page right */}
      <section className="paper-grain relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" strokeWidth={2} />
              Read with a buddy
            </p>
            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.06] tracking-tight text-foreground sm:text-6xl">
              Never get stuck on a
              <br />
              <span className="italic text-primary">sentence</span> again.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Upload a book as a PDF and read it in a calm, focused reader. The
              moment a sentence stops making sense, highlight it — your reading
              buddy explains it in plain language, using the surrounding page as
              context.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-12 gap-2 px-6 text-[15px] shadow-book"
                onClick={() => startLogin()}>
                Start reading
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
              <span className="text-sm text-muted-foreground">
                Free to try · your library stays private
              </span>
            </div>
          </div>

          {/* Sample reading page with a highlight and buddy answer */}
          <div className="relative">
            <div className="absolute -inset-3 rotate-[1.4deg] rounded-2xl border border-border/70 bg-card/40" />
            <div className="relative rounded-2xl border border-border/80 bg-paper p-7 shadow-lift sm:p-9">
              <div className="mb-5 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <span>The Wealth of Nations</span>
                <span>p. 14</span>
              </div>
              <p className="font-reading text-[1.06rem] leading-[1.85] text-foreground">
                The greatest improvement in the productive powers of labour, and
                the greater part of the skill,{" "}
                <span className="mark-highlight">
                  dexterity, and judgment with which it is anywhere directed,
                </span>{" "}
                seem to have been the effects of the division of labour.
              </p>

              <div className="mt-7 rounded-xl border border-primary/25 bg-primary/[0.055] p-5">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
                    <Sparkles className="h-3 w-3 text-primary" strokeWidth={2.2} />
                  </span>
                  <span className="text-xs font-medium tracking-wide text-primary">
                    Reading buddy · Explain
                  </span>
                </div>
                <p className="text-[0.94rem] leading-relaxed text-foreground/85">
                  He means the <strong>skill</strong>, <strong>speed</strong>, and{" "}
                  <strong>good decisions</strong> that workers apply to a job.
                  Smith's claim is that these improve most when work is split
                  into specialised parts — one person doing one thing very well
                  beats one person doing everything adequately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Four modes */}
      <section className="border-b border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Four ways to ask
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every answer is grounded in the page you are reading — not in a
            generic summary of the book.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modes.map(mode => (
              <div
                key={mode.label}
                className="rounded-xl border border-border/80 bg-background p-5 transition-shadow duration-200 hover:shadow-book">
                <mode.icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                <h3 className="mt-3.5 font-display text-lg font-semibold">{mode.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {mode.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                    <step.icon className="h-4 w-4 text-primary" strokeWidth={1.9} />
                  </span>
                  {index < steps.length - 1 && (
                    <span className="mt-2 hidden w-px flex-1 bg-border sm:block" />
                  )}
                </div>
                <div className="pb-1">
                  <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 max-w-md text-[0.94rem] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-border/80 bg-card/60 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold">
                Bring the book you have been putting off.
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in and upload your first PDF in under a minute.
              </p>
            </div>
            <Button size="lg" className="gap-2 shadow-book" onClick={() => startLogin()}>
              Start reading
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-7 text-sm text-muted-foreground sm:px-6">
          <Wordmark className="text-foreground" />
          <span className="text-border">·</span>
          <span>A calmer way to read hard books.</span>
          <span className="ml-auto text-xs">
            Text-based PDFs only — scanned books are not supported yet.
          </span>
        </div>
      </footer>
    </div>
  );
}
