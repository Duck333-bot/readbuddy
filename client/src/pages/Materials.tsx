import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, FileText, Layers3, LogOut, NotebookPen, Presentation, Search, Sparkles, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { BrandWordmark } from "@/components/BrandWordmark";
import UploadMaterialDialog from "@/components/UploadMaterialDialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const typeLabel: Record<string, string> = {
  document: "Document", slides: "Slides", lecture_notes: "Notes", book: "Book", textbook: "Textbook", research_paper: "Research paper", school_material: "School material", business_report: "Report",
};

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "there";
}

function StateChip({ state }: { state: string }) {
  const detail = state === "complete"
    ? { label: "Ready", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" }
    : state === "paused" || state === "failed"
      ? { label: "Needs attention", className: "bg-amber-50 text-amber-800 ring-amber-100" }
      : { label: "Understanding", className: "bg-sky-50 text-sky-700 ring-sky-100" };
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.11em] ring-1 ${detail.className}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{detail.label}</span>;
}

function MaterialGlyph({ materialType }: { materialType: string }) {
  const Icon = materialType === "slides" ? Presentation : materialType === "book" || materialType === "textbook" ? BookOpen : FileText;
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Icon className="h-5 w-5" strokeWidth={1.8} /></div>;
}

export default function Materials() {
  const { user, isAuthenticated, loading, logout } = useAuth({ redirectOnUnauthenticated: true });
  const materials = trpc.materials.list.useQuery(undefined, { enabled: isAuthenticated });
  const [location] = useLocation();
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const allMaterials = materials.data ?? [];
  const visibleMaterials = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allMaterials;
    return allMaterials.filter(material => `${material.title} ${typeLabel[material.materialType] ?? material.materialType}`.toLowerCase().includes(normalized));
  }, [allMaterials, query]);
  const featuredMaterial = allMaterials.find(material => material.processingState === "complete") ?? allMaterials[0];
  const navItems = [
    { href: "/materials", label: "Dashboard", icon: Layers3 },
    { href: "/library", label: "Reading library", icon: BookOpen },
    { href: "/notebook", label: "Notebook", icon: NotebookPen },
  ];

  return <AppShell bare><div className="min-h-screen bg-[#f8f8f7] text-[#25242a]">
    <div className="mx-auto flex min-h-screen max-w-[96rem]">
      <aside className={`sticky top-0 hidden h-screen shrink-0 border-r border-[#e5e4e3] bg-white px-3 py-5 transition-[width] duration-200 lg:flex lg:flex-col ${sidebarOpen ? "w-64" : "w-[5.4rem]"}`}>
        <div className={`flex h-10 items-center ${sidebarOpen ? "justify-between px-2" : "justify-center"}`}>
          {sidebarOpen && <Link href="/materials" className="text-[#25242a] no-underline"><BrandWordmark className="text-[1.06rem]" /></Link>}
          <button type="button" aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} onClick={() => setSidebarOpen(value => !value)} className="grid h-9 w-9 place-items-center rounded-lg text-[#77757d] transition hover:bg-[#f1f0f2] hover:text-[#29272e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7665ec]">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        <nav className="mt-7 grid gap-1" aria-label="Workspace navigation">
          {navItems.map(item => {
            const active = location === item.href || (item.href === "/materials" && location.startsWith("/materials"));
            return <Link key={item.href} href={item.href} title={!sidebarOpen ? item.label : undefined} className={`flex h-11 items-center rounded-xl no-underline transition ${sidebarOpen ? "gap-3 px-3" : "justify-center"} ${active ? "bg-[#f0eef3] text-[#302d36]" : "text-[#5e5b64] hover:bg-[#f7f6f7] hover:text-[#29272e]"}`}><item.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />{sidebarOpen && <span className="text-sm font-semibold">{item.label}</span>}</Link>;
          })}
        </nav>

        <div className="mt-auto border-t border-[#efeeee] pt-4">
          <div className={`flex items-center ${sidebarOpen ? "gap-3 px-2" : "justify-center"}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{firstName(user?.name).slice(0, 1).toUpperCase()}</div>
            {sidebarOpen && <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#38363d]">{user?.name ?? "ZhiyaAI reader"}</p><p className="truncate text-xs text-[#8b8991]">Private workspace</p></div>}
          </div>
          <button type="button" onClick={() => void logout()} title={!sidebarOpen ? "Sign out" : undefined} className={`mt-3 flex h-10 items-center rounded-xl text-sm font-medium text-[#726f78] transition hover:bg-[#f7f6f7] hover:text-[#2c2931] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7665ec] ${sidebarOpen ? "w-full gap-3 px-3" : "w-full justify-center"}`}><LogOut className="h-4 w-4" strokeWidth={1.8} />{sidebarOpen && "Sign out"}</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <header className="flex items-center justify-between gap-4 lg:hidden"><Link href="/materials" className="no-underline"><BrandWordmark className="text-[1.05rem]" /></Link><button type="button" onClick={() => void logout()} className="rounded-lg px-2 py-2 text-xs font-semibold text-[#6c6971] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7665ec]">Sign out</button></header>

        <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start lg:mt-0">
          <div><h1 className="text-4xl font-bold tracking-[-.055em] text-[#25242a] sm:text-[2.85rem]">Hi {firstName(user?.name)}</h1><p className="mt-1 text-base text-[#89868e]">Your materials, ready to learn from.</p></div>
          <label className="relative block w-full sm:mt-1 sm:max-w-[17rem]"><span className="sr-only">Search your materials</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#96939a]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your materials" className="h-11 w-full rounded-xl border border-[#dedddb] bg-white pl-10 pr-4 text-sm text-[#322f37] shadow-[0_2px_5px_rgba(36,33,42,.035)] outline-none placeholder:text-[#aaa7ae] focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
        </div>

        <section className="mt-7 grid gap-3 lg:grid-cols-2" aria-label="Material actions">
          <UploadMaterialDialog triggerLabel="Upload material" triggerClassName="h-auto min-h-20 w-full justify-start rounded-2xl border border-[#dedddb] bg-white px-5 py-4 text-left text-[#302d36] shadow-[0_3px_0_rgba(45,40,50,.11)] hover:bg-[#fbfaff] hover:text-[#302d36]" triggerContent={<><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Upload className="h-5 w-5" strokeWidth={1.8} /></span><span><span className="block text-[0.97rem] font-bold">Upload material</span><span className="mt-0.5 block text-sm font-normal text-[#8b8890]">PDF, Word, slides, text, or Markdown</span></span></>} />
          {featuredMaterial && <Link href={`/materials/${featuredMaterial.id}`} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-[#dedddb] bg-white px-5 py-4 no-underline shadow-[0_3px_0_rgba(45,40,50,.11)] transition hover:bg-[#fbfaff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7665ec]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" strokeWidth={1.8} /></span><span className="min-w-0 flex-1"><span className="block text-[0.97rem] font-bold text-[#302d36]">Continue learning</span><span className="mt-0.5 block truncate text-sm text-[#8b8890]">Open {featuredMaterial.title}</span></span><ArrowRight className="h-5 w-5 text-[#817d86] transition group-hover:translate-x-0.5" /></Link>}
        </section>

        {loading || materials.isLoading ? <section className="mt-10 space-y-3"><div className="h-5 w-28 animate-pulse rounded bg-[#e8e7e7]" />{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white" />)}</section> : allMaterials.length === 0 ? <section className="mt-10 rounded-2xl border border-dashed border-[#d7d5d6] bg-white px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-violet-100 text-violet-700"><Layers3 className="h-5 w-5" /></span><h2 className="mt-5 text-xl font-bold tracking-[-.03em]">Your dashboard is ready for the first material.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#817e87]">Upload a source you are genuinely studying. ZhiyaAI will keep it private and build study tools from its own content.</p></section> : <section className="mt-10"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#918e96]">Your materials</p><h2 className="mt-1 text-xl font-bold tracking-[-.035em] text-[#2b2930]">{query ? `${visibleMaterials.length} matching material${visibleMaterials.length === 1 ? "" : "s"}` : "Continue where you left off"}</h2></div><p className="hidden text-sm text-[#97939c] sm:block">{allMaterials.length} private material{allMaterials.length === 1 ? "" : "s"}</p></div>
          <div className="mt-4 space-y-3">{visibleMaterials.map(material => <article key={material.id} className="group flex min-h-[5.5rem] items-center gap-4 rounded-2xl border border-[#dfdedd] bg-white px-4 py-4 shadow-[0_3px_0_rgba(45,40,50,.06)] transition hover:border-[#cfcae8] hover:shadow-[0_8px_20px_rgba(53,44,76,.07)] sm:px-5"><MaterialGlyph materialType={material.materialType} /><Link href={`/materials/${material.id}`} className="min-w-0 flex-1 no-underline focus-visible:outline-none"><p className="truncate text-[1rem] font-bold text-[#302e34] transition group-hover:text-[#6353d9]">{material.title}</p><p className="mt-1 text-sm text-[#918e98]">{typeLabel[material.materialType] ?? "Material"} · {material.unitCount} unit{material.unitCount === 1 ? "" : "s"} · {material.processingState === "complete" ? "Study tools are ready" : material.processingState === "paused" || material.processingState === "failed" ? "Original source is still available" : "Understanding continues in the background"}</p></Link><div className="flex shrink-0 items-center gap-3"><StateChip state={material.processingState} /><Link href={material.processingState === "complete" ? `/materials/${material.id}/lesson` : `/materials/${material.id}`} className="hidden items-center gap-1.5 rounded-xl bg-[#f0edff] px-3 py-2 text-xs font-bold text-[#5949c9] no-underline transition hover:bg-[#e7e2ff] sm:inline-flex">{material.processingState === "complete" ? "Revise" : "Open"}<ArrowRight className="h-3.5 w-3.5" /></Link></div></article>)}
            {visibleMaterials.length === 0 && <div className="rounded-2xl border border-dashed border-[#d9d6dc] bg-white px-6 py-12 text-center"><p className="font-semibold text-[#4c4952]">No materials match “{query}”.</p><button type="button" onClick={() => setQuery("")} className="mt-3 text-sm font-semibold text-[#6353d9] underline underline-offset-4">Clear search</button></div>}
          </div>
        </section>}
      </main>
    </div>
  </div></AppShell>;
}
