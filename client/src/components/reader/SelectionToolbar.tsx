import { Highlighter, MoreHorizontal, StickyNote, X } from "lucide-react";
import { motion } from "framer-motion";
import type { ReaderSelection } from "@/lib/selection";
import type { BuddyMode } from "./types";
import { useState } from "react";

type SelectionToolbarProps = {
  selection: ReaderSelection;
  showWho: boolean;
  isSavingHighlight?: boolean;
  onAction: (mode: BuddyMode) => void;
  onHighlight: () => void;
  onNote: () => void;
  onDismiss: () => void;
};

export function selectionActionLabels(showWho: boolean, isSingleWord = false) {
  if (isSingleWord) return ["Define", "Translate", "Explain"];
  return showWho ? ["Explain", "Simpler", "Context", "Who?"] : ["Explain", "Simpler", "Context"];
}

function modeForLabel(label: string): BuddyMode {
  if (label === "Define") return "word";
  if (label === "Translate") return "translate";
  if (label === "Explain") return "explain";
  if (label === "Simpler") return "simplify";
  if (label === "Context") return "context";
  return "who";
}

export function SelectionToolbar({ selection, showWho, isSavingHighlight, onAction, onHighlight, onNote, onDismiss }: SelectionToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isSingleWord = /^\S+$/.test(selection.text.trim());
  const primaryActions = selectionActionLabels(showWho, isSingleWord);
  const secondaryActions: { label: string; mode: BuddyMode }[] = isSingleWord
    ? []
    : [
        { label: "Define", mode: "define" },
        { label: "Translate", mode: "translate" },
      ];
  return (
    <>
      <motion.div
        data-selection-actions
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="fixed z-50 hidden sm:block"
        style={{ left: Math.max(8, selection.x - 80), top: selection.y - 8 }}>
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-card/95 px-1.5 py-1 shadow-lift backdrop-blur-md">
          {primaryActions.map(label => {
            const mode = modeForLabel(label);
            return <button key={mode} onMouseDown={event => event.preventDefault()} onClick={() => onAction(mode)} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--rb-evidence-surface)] ${mode === "who" ? "text-[var(--rb-evidence)]" : "text-foreground"}`}>{label}</button>;
          })}
          <div className="ml-0.5 hidden items-center gap-0.5 border-l border-border/60 pl-1 sm:flex">
            <button onMouseDown={event => event.preventDefault()} onClick={onHighlight} disabled={isSavingHighlight} aria-label="Highlight" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-[var(--rb-sun)]/20 hover:text-foreground disabled:opacity-50"><Highlighter className="h-3.25 w-3.25" /></button>
            <button onMouseDown={event => event.preventDefault()} onClick={onNote} aria-label="Add note" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><StickyNote className="h-3.25 w-3.25" /></button>
            {secondaryActions.length > 0 && <button onMouseDown={event => event.preventDefault()} onClick={() => setMoreOpen(open => !open)} aria-label="More selection actions" aria-expanded={moreOpen} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-3.25 w-3.25" /></button>}
          </div>
          <button onMouseDown={event => event.preventDefault()} onClick={onDismiss} aria-label="Dismiss selection actions" className="ml-0.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><X className="h-3.25 w-3.25" /></button>
        </div>
        {moreOpen && secondaryActions.length > 0 && <div className="absolute right-0 top-[calc(100%+0.5rem)] flex min-w-28 flex-col rounded-xl border border-border bg-card p-1 shadow-lift"><span className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">More help</span>{secondaryActions.map(action => <button key={action.mode} onMouseDown={event => event.preventDefault()} onClick={() => onAction(action.mode)} className="rounded-lg px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-[var(--rb-evidence-surface)]">{action.label}</button>)}</div>}
      </motion.div>
      <motion.div data-selection-actions initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="fixed inset-x-0 bottom-0 z-50 p-3 sm:hidden">
        <div className="rounded-2xl border border-border bg-card/95 p-2 shadow-lift backdrop-blur-xl">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-1.5">
            {primaryActions.map(label => {
              const mode = modeForLabel(label);
              return <button key={mode} onClick={() => onAction(mode)} className={`min-h-11 rounded-xl bg-[var(--rb-evidence-surface)] px-3 text-left text-sm font-medium ${mode === "who" ? "text-[var(--rb-evidence)]" : "text-foreground"}`}>{label}</button>;
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5 border-t border-border pt-2"><button onClick={onHighlight} disabled={isSavingHighlight} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-muted-foreground"><Highlighter className="h-3.5 w-3.5" /> Highlight</button><button onClick={onNote} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-muted-foreground"><StickyNote className="h-3.5 w-3.5" /> Add note</button>{secondaryActions.length > 0 && <button onClick={() => setMoreOpen(open => !open)} className="rounded-xl px-3 text-xs font-medium text-muted-foreground">More</button>}<button onClick={onDismiss} aria-label="Dismiss selection actions" className="rounded-xl px-3 text-muted-foreground"><X className="h-4 w-4" /></button></div>
          {moreOpen && secondaryActions.length > 0 && <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-border pt-2">{secondaryActions.map(action => <button key={action.mode} onClick={() => onAction(action.mode)} className="min-h-10 rounded-xl bg-muted/60 px-3 text-left text-xs font-medium text-foreground">{action.label}</button>)}</div>}
        </div>
      </motion.div>
    </>
  );
}
