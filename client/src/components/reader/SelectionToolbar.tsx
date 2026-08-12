import { Highlighter, MoreHorizontal, StickyNote, X } from "lucide-react";
import { motion } from "framer-motion";
import type { ReaderSelection } from "@/lib/selection";
import type { BuddyMode } from "./types";

type SelectionToolbarProps = {
  selection: ReaderSelection;
  showWho: boolean;
  isSavingHighlight?: boolean;
  onAction: (mode: BuddyMode) => void;
  onHighlight: () => void;
  onNote: () => void;
  onDismiss: () => void;
};

export function selectionActionLabels(showWho: boolean) {
  return showWho ? ["Explain", "Simpler", "Context", "Who?"] : ["Explain", "Simpler", "Context"];
}

export function SelectionToolbar({ selection, showWho, isSavingHighlight, onAction, onHighlight, onNote, onDismiss }: SelectionToolbarProps) {
  const primaryActions = selectionActionLabels(showWho);
  return (
    <>
      <motion.div
        data-selection-actions
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="fixed z-50 hidden sm:block"
        style={{ left: Math.max(8, selection.x - 80), top: selection.y - 8 }}>
        <div className="flex items-center gap-0.5 rounded-full border border-[#8a85c9]/20 bg-card/95 px-1.5 py-1 shadow-[0_12px_30px_rgba(50,45,75,0.16)] backdrop-blur-md">
        {primaryActions.map(label => { const mode = label === "Explain" ? "explain" : label === "Simpler" ? "simplify" : label === "Context" ? "context" : "who"; return <button key={mode} onMouseDown={event => event.preventDefault()} onClick={() => onAction(mode)} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-[#8a85c9]/10 ${mode === "who" ? "text-[#6f6ab2]" : "text-foreground"}`}>{label}</button>; })}
        <div className="ml-0.5 hidden items-center gap-0.5 border-l border-border/60 pl-1 sm:flex">
          <button onMouseDown={event => event.preventDefault()} onClick={onHighlight} disabled={isSavingHighlight} aria-label="Highlight" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-amber-100 hover:text-amber-900 disabled:opacity-50"><Highlighter className="h-3.25 w-3.25" /></button>
          <button onMouseDown={event => event.preventDefault()} onClick={onNote} aria-label="Add note" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><StickyNote className="h-3.25 w-3.25" /></button>
          <button onMouseDown={event => event.preventDefault()} onClick={onDismiss} aria-label="More selection actions" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-3.25 w-3.25" /></button>
        </div>
        <button onMouseDown={event => event.preventDefault()} onClick={onDismiss} aria-label="Dismiss selection actions" className="ml-0.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><X className="h-3.25 w-3.25" /></button>
        </div>
      </motion.div>
      <motion.div data-selection-actions initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="fixed inset-x-0 bottom-0 z-50 p-3 sm:hidden">
        <div className="rounded-2xl border border-[#8a85c9]/18 bg-card/95 p-2 shadow-[0_-10px_35px_rgba(50,45,75,0.16)] backdrop-blur-xl">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-1.5">
            {primaryActions.map(label => { const mode = label === "Explain" ? "explain" : label === "Simpler" ? "simplify" : label === "Context" ? "context" : "who"; return <button key={mode} onClick={() => onAction(mode)} className={`min-h-11 rounded-xl bg-[#8a85c9]/[0.07] px-3 text-left text-sm font-medium ${mode === "who" ? "text-[#6f6ab2]" : "text-foreground"}`}>{label}</button>; })}
          </div>
          <div className="mt-1.5 flex gap-1.5 border-t border-[#8a85c9]/12 pt-2"><button onClick={onHighlight} disabled={isSavingHighlight} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-muted-foreground"><Highlighter className="h-3.5 w-3.5" /> Highlight</button><button onClick={onNote} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-muted-foreground"><StickyNote className="h-3.5 w-3.5" /> Add note</button><button onClick={onDismiss} aria-label="Dismiss selection actions" className="rounded-xl px-3 text-muted-foreground"><X className="h-4 w-4" /></button></div>
        </div>
      </motion.div>
    </>
  );
}
