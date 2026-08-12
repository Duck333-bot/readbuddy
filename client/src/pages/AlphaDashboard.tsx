import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Activity, BookOpen, BrainCircuit, MousePointerClick, Users } from "lucide-react";

function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
        {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

const labelOf: Record<string, string> = {
  highlight_action: "Explain / selection actions",
  simpler_after_explain: "Simpler after Explain",
  evidence_tap: "Evidence taps",
  lost_open: "I’m Lost",
  notebook_save: "AI answer saves",
  chapter_debrief_open: "Chapter debrief opens",
  chapter_debrief_dismiss: "Chapter debrief dismisses",
  book_question_open: "Ask-this-book opens",
  book_question_submit: "Ask-this-book questions",
};

const funnelLabel: Record<string, string> = {
  landing_view: "Landing viewed", landing_start_clicked: "Start reading clicked", auth_completed: "Account created",
  library_reached: "Library reached", upload_opened: "Upload opened", pdf_selected: "PDF selected",
  upload_started: "Upload started", ready_to_read: "Ready to read", start_reading_clicked: "Start reading from upload",
  reader_opened: "Reader opened", meaningful_reading_session: "Meaningful reading session", highlight_action: "First highlight",
  ai_answer_received: "First AI answer", evidence_tap: "Evidence clicked", reading_continued: "Reader continued", return_to_book: "Returned to book",
};

export default function AlphaDashboard() {
  const dashboard = trpc.analytics.dashboard.useQuery();
  if (dashboard.isLoading) {
    return <AppShell><div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></AppShell>;
  }
  if (dashboard.error || !dashboard.data) {
    return <AppShell><div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl font-semibold">Private Alpha</h1><p className="mt-3 text-sm text-muted-foreground">This page is available only to the ReadBuddy owner.</p></div></AppShell>;
  }
  const data = dashboard.data;
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Private Alpha</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Are readers coming back?</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">A deliberately small dashboard using only real interaction events from the last {data.windowDays} days. The north-star signal is readers reopening and continuing books.</p>
        </div>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Active readers today" value={data.activeReaders} note="Opened a book in the last 24 hours" />
          <Metric label="Readers this week" value={data.weekReaders} note="Opened a book in the last 7 days" />
          <Metric label="Reading sessions" value={data.readingSessions} note="Book openings in 7 days" />
          <Metric label="Books opened today" value={data.booksOpened} note="Distinct books" />
        </section>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-primary" /> AI reading behavior</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(data.actionCounts).map(([event, value]) => <div key={event} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0"><span className="text-sm text-muted-foreground">{labelOf[event] ?? event}</span><span className="text-sm font-semibold tabular-nums">{value}</span></div>)}
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Metric label="Evidence click rate" value={data.evidenceClickRate === null ? "—" : `${data.evidenceClickRate}%`} note="Evidence taps ÷ selection actions" />
            <Metric label="Save rate" value={data.saveRate === null ? "—" : `${data.saveRate}%`} note="Saved AI answers ÷ selection actions" />
            <Card className="border-border/70 shadow-sm"><CardContent className="p-4"><div className="flex items-start gap-3"><Activity className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Quality and cost</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Latency, AI errors, Book Brain failures, and cost remain intentionally blank until server-side timing and provider-cost instrumentation is added. This dashboard never estimates them.</p></div></div></CardContent></Card>
          </div>
        </div>
        <Card className="mt-8 border-border/70 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> First-reading funnel</CardTitle><p className="text-xs text-muted-foreground">Each percentage uses unique visitors who viewed the landing during the same seven-day window. No book text or questions are retained.</p></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left text-sm"><thead className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3">Step</th><th className="pb-3 text-right">Entered</th><th className="pb-3 text-right">Completed</th><th className="pb-3 text-right">Conversion</th></tr></thead><tbody>{data.funnel.map(step => <tr key={step.event} className="border-b border-border/50 last:border-0"><td className="py-3 text-foreground">{funnelLabel[step.event] ?? step.event}</td><td className="py-3 text-right tabular-nums text-muted-foreground">{step.entered}</td><td className="py-3 text-right tabular-nums font-medium">{step.completed}</td><td className="py-3 text-right tabular-nums">{step.conversionPercent === null ? "—" : `${step.conversionPercent}%`}</td></tr>)}</tbody></table>
          </CardContent>
        </Card>
        <p className="mt-8 flex items-center gap-2 text-[11px] text-muted-foreground"><MousePointerClick className="h-3.5 w-3.5" /> No passages, questions, or AI answers are collected here — only privacy-minimal interaction metadata.</p>
      </div>
    </AppShell>
  );
}
