import { FileText, Layers3, Sparkles } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import UploadMaterialDialog from "@/components/UploadMaterialDialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const typeLabel: Record<string, string> = { document: "Document", slides: "Slides", lecture_notes: "Notes", book: "Book", article: "Article", other: "Material" };

export default function Materials() {
  const { isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: true });
  const materials = trpc.materials.list.useQuery(undefined, { enabled: isAuthenticated });
  return <AppShell><div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Your learning materials</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.05em] sm:text-5xl">One place to understand what you study.</h1><p className="mt-3 max-w-2xl text-muted-foreground">Bring in class notes, slides, articles, or books. ZhiyaAI keeps the source attached to the learning.</p></div><UploadMaterialDialog /></div>
    {loading || materials.isLoading ? <div className="mt-12 text-sm text-muted-foreground">Opening your materials…</div> : (materials.data?.length ?? 0) === 0 ? <div className="mt-12 rounded-3xl border border-dashed border-border bg-card p-10 text-center"><Layers3 className="mx-auto h-7 w-7 text-primary" /><h2 className="mt-4 font-display text-2xl">Start with something you are already learning.</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">ZhiyaAI will preserve where every idea came from, then help you learn it.</p><div className="mt-5"><UploadMaterialDialog triggerLabel="Add your first material" /></div></div> : <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{materials.data?.map(material => <Link key={material.id} href={`/materials/${material.id}`} className="group rounded-2xl border border-border bg-card p-5 no-underline transition hover:-translate-y-0.5 hover:border-primary/35"><div className="flex items-start justify-between gap-3"><FileText className="h-5 w-5 text-primary" /><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">{typeLabel[material.materialType] ?? "Material"}</span></div><h2 className="mt-8 line-clamp-2 font-display text-xl font-semibold text-foreground">{material.title}</h2><p className="mt-2 text-sm text-muted-foreground">{material.unitCount} source unit{material.unitCount === 1 ? "" : "s"} · {material.processingState === "complete" ? "Understood" : material.processingState === "paused" ? "Needs attention" : "Preparing"}</p><p className="mt-5 flex items-center gap-1 text-xs font-medium text-primary">Open workspace <Sparkles className="h-3.5 w-3.5" /></p></Link>)}</div>}
  </div></AppShell>;
}
