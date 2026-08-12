import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

export function LostButton({ onClick }: { onClick: () => void }) {
  return <div className="fixed bottom-4 right-3 z-40 sm:bottom-6 sm:right-6"><Tooltip><TooltipTrigger asChild><button onClick={onClick} className="flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card/90 px-3 text-xs font-medium text-muted-foreground shadow-md backdrop-blur transition-all hover:border-[var(--rb-evidence)] hover:text-[var(--rb-evidence)] active:scale-95" aria-label="I’m lost — help me understand where I am"><HelpCircle className="h-4 w-4" /><span>I’m lost</span></button></TooltipTrigger><TooltipContent side="left">Get a quick orientation</TooltipContent></Tooltip></div>;
}

export function LostReaderCard({ answer, isLoading, onClose }: { answer: string; isLoading: boolean; onClose: () => void }) {
  return <motion.aside initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-8 rounded-2xl border border-border bg-card/90 shadow-lift backdrop-blur-sm"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-evidence)]"><Sparkles className="h-3.5 w-3.5" /> Here’s what matters right now</div><button onClick={onClose} aria-label="Close recap" className="rounded-md p-1 text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button></div><div className="px-4 py-4">{isLoading ? <div className="space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-10/12" /><Skeleton className="h-3.5 w-4/5" /></div> : <div className="prose prose-sm max-w-none text-sm leading-relaxed"><Streamdown>{answer}</Streamdown></div>}</div></motion.aside>;
}
