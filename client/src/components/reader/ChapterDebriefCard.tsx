import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

export function ChapterDebriefCard({ chapterNumber, debrief, onDismiss, onContinue }: { chapterNumber: number; debrief: string; onDismiss: () => void; onContinue: () => void }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mx-auto my-10 max-w-xl text-center"><p className="font-display text-2xl font-semibold">Chapter {chapterNumber}</p><p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[#6f6ab2]">Complete</p><div className="mt-6 rounded-2xl border border-[#8a85c9]/20 bg-card/90 p-5 text-left shadow-[0_12px_35px_rgba(51,46,83,0.1)]"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#6f6ab2]" /><h3 className="font-display text-lg font-semibold">What did I just read?</h3></div><button onClick={onDismiss} aria-label="Dismiss chapter debrief" className="rounded-md p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button></div><div className="prose prose-sm mt-4 max-w-none text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0"><Streamdown>{debrief}</Streamdown></div><Button size="sm" onClick={onContinue} className="mt-5">Continue reading</Button></div></motion.section>;
}

