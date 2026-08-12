import { ExternalLink } from "lucide-react";

export function EvidenceLink({ page, onJump }: { page: number; onJump: (page: number) => void }) {
  return <button onClick={() => onJump(page)} className="inline-flex items-center gap-1 rounded-md border border-[#8a85c9]/25 bg-[#8a85c9]/[0.08] px-2.5 py-1 text-[11px] font-semibold text-[#6f6ab2] transition-colors hover:bg-[#8a85c9]/15"><ExternalLink className="h-3 w-3" /> p.{page}</button>;
}

