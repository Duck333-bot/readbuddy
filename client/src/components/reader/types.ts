export type BuddyMode = "explain" | "simplify" | "context" | "who" | "why" | "translate" | "define" | "ask";

export type ReadingTheme = "light" | "sepia" | "dark";

export type PageAnnotation = {
  id: number;
  selectedText: string;
  color: string;
  note: string | null;
};

export type ReaderChapter = {
  chapter: number;
  title: string;
  summary: string;
  startPage: number;
};

