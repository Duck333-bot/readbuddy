import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

export function ResumeReadingCard({ recap, lastPage, pageCount, onDismiss, onContinue }: { recap: string; lastPage: number; pageCount: number; onDismiss: () => void; onContinue: () => void }) {
  return <motion.aside initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:bottom-6"><div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur"><div className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rb-evidence-surface)] text-[var(--rb-evidence)]"><Sparkles className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Welcome back</p><p className="mt-0.5 text-xs text-muted-foreground">You stopped on page {lastPage} of {pageCount}. Want a quick reminder?</p></div><button onClick={onDismiss} aria-label="Dismiss resume card" className="rounded-md p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button></div><div className="mt-4 text-sm leading-relaxed"><Streamdown>{recap}</Streamdown></div><div className="mt-4 flex gap-2"><Button size="sm" onClick={onContinue}>Continue reading</Button><Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button></div></div></motion.aside>;
}
