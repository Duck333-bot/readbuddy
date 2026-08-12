import { ExternalLink } from "lucide-react";

export function EvidenceLink({ page, onJump }: { page: number; onJump: (page: number) => void }) {
  return <button onClick={() => onJump(page)} className="inline-flex items-center gap-1 rounded-md border border-border bg-[var(--rb-evidence-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--rb-evidence)] transition-colors hover:opacity-80"><ExternalLink className="h-3 w-3" /> p.{page}</button>;
}
