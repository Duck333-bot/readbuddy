import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { extractCitedPages, parseEvidenceCitations } from "@/lib/evidenceParser";
import { Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Streamdown } from "streamdown";
import type { BuddyMode } from "./types";
import { EvidenceLink } from "./EvidenceLink";

function AnswerText({ text, onJump }: { text: string; onJump: (page: number) => void }) {
  const segments = parseEvidenceCitations(text);
  if (!segments.some(segment => segment.type === "citation")) return <Streamdown>{text}</Streamdown>;
  return <span>{segments.map((segment, index) => segment.type === "citation" ? <EvidenceLink key={index} page={segment.page} onJump={onJump} /> : <Streamdown key={index}>{segment.content}</Streamdown>)}</span>;
}

type InlineAnswerCardProps = {
  highlight: string; answer: string; mode: BuddyMode; isLoading: boolean; isSaved: boolean;
  onClose: () => void; onSave: () => void; onAskFollowUp: (question: string) => void; onSimpler: () => void; onMore: () => void; onJumpToPage: (page: number) => void;
};

export function InlineAnswerCard({ highlight, answer, mode, isLoading, isSaved, onClose, onSave, onAskFollowUp, onSimpler, onMore, onJumpToPage }: InlineAnswerCardProps) {
  const [followUp, setFollowUp] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const citedPages = extractCitedPages(answer);
  return <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="my-7 overflow-hidden rounded-2xl border border-[#8a85c9]/20 bg-card/90 shadow-[0_12px_35px_rgba(51,46,83,0.12)] backdrop-blur-sm">
    <div className="flex items-center justify-between border-b border-[#8a85c9]/12 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8a85c9]/12 text-[#6f6ab2]"><Sparkles className="h-3 w-3" /></span><p className="truncate text-xs italic text-muted-foreground">“{highlight.slice(0, 110)}{highlight.length > 110 ? "…" : ""}”</p></div><button onClick={onClose} aria-label="Close explanation" className="ml-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div>
    <div className="px-4 py-4">{isLoading ? <div className="space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-10/12" /><Skeleton className="h-3.5 w-4/5" /></div> : <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold"><AnswerText text={answer} onJump={onJumpToPage} /></div>}</div>
    {!isLoading && citedPages.length > 0 && <div className="border-t border-[#8a85c9]/12 bg-[#8a85c9]/[0.035] px-4 py-2.5"><div className="flex flex-wrap gap-1.5">{citedPages.map(page => <EvidenceLink key={page} page={page} onJump={onJumpToPage} />)}</div></div>}
    {!isLoading && <div className="flex flex-wrap items-center gap-1 border-t border-[#8a85c9]/12 px-3 py-2"><button onClick={onSimpler} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-[#8a85c9]/10 hover:text-foreground">{mode === "simplify" ? "Explain" : "Simpler"}</button><button onClick={onMore} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-[#8a85c9]/10 hover:text-foreground">More detail</button><button onClick={() => setShowFollowUp(value => !value)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-[#8a85c9]/10 hover:text-foreground">Ask</button><button onClick={onSave} disabled={isSaved} className="ml-auto rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#6f6ab2] hover:bg-[#8a85c9]/10 disabled:opacity-60">{isSaved ? "Saved" : "Save"}</button></div>}
    {showFollowUp && !isLoading && <form onSubmit={event => { event.preventDefault(); if (followUp.trim()) { onAskFollowUp(followUp.trim()); setFollowUp(""); setShowFollowUp(false); } }} className="flex gap-2 border-t border-[#8a85c9]/12 px-4 py-3"><Input value={followUp} onChange={event => setFollowUp(event.target.value)} placeholder="Ask about this passage…" className="h-8 text-xs" autoFocus /><Button type="submit" size="sm" className="h-8" disabled={!followUp.trim()}>Ask</Button></form>}
  </motion.section>;
}

