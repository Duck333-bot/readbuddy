export type BuddyMode = "explain" | "simplify" | "context" | "who" | "why" | "translate" | "define" | "ask" | "word";

export type ReadingTheme = "light" | "sepia" | "dark";

export type PageAnnotation = {
  id: number;
  selectedText: string;
  startOffset: number | null;
  endOffset: number | null;
  color: string;
  note: string | null;
};

export type ReaderChapter = {
  chapter: number;
  title: string;
  summary: string;
  startPage: number;
  endPage?: number;
  authorDefined?: boolean;
};
