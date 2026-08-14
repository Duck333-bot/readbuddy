export type BrainStepState = "complete" | "active" | "pending";
export type BookBrainPipelineStage = "idle" | "chunks" | "synthesis" | "embeddings" | "complete" | "paused" | "failed";
export type BookBrainPresentation = {
  kind: "text" | "structure" | "connections" | "evidence" | "complete" | "paused" | "failed";
  eyebrow: string;
  title: string;
  detail: string;
  activeIndex: number;
};

/**
 * V2.1 product rule: a book can be read immediately after extraction.
 * Deep Book Brain work is a progressive enhancement, never a gate.
 */
export function isReadyToRead(uploadCompleted: boolean) {
  return uploadCompleted;
}

export function getBrainStepState(passCompleted: number, index: number): BrainStepState {
  if (index < passCompleted) return "complete";
  if (index === passCompleted && passCompleted < 4) return "active";
  return "pending";
}

export function isBookBrainComplete(passCompleted: number) {
  return passCompleted >= 4;
}

/**
 * Reader-facing Book Brain language, mapped only to stored pipeline state.
 * It deliberately contains no count or percentage that the backend does not expose.
 */
export function getBookBrainPresentation({
  passCompleted,
  pipelineStage,
}: {
  passCompleted: number;
  pipelineStage?: BookBrainPipelineStage | null;
}): BookBrainPresentation {
  if (pipelineStage === "failed") {
    return {
      kind: "failed",
      eyebrow: "Book Brain paused",
      title: "Your book is still ready to read.",
      detail: "ZhiyaAI will keep the work that is already finished and continue when it can.",
      activeIndex: Math.max(0, Math.min(passCompleted, 3)),
    };
  }
  if (pipelineStage === "paused") {
    return {
      kind: "paused",
      eyebrow: "Book Brain will continue",
      title: "Nothing you have reached is lost.",
      detail: "The book stays ready while ZhiyaAI waits to continue its background work.",
      activeIndex: Math.max(0, Math.min(passCompleted, 3)),
    };
  }
  if (pipelineStage === "complete" || isBookBrainComplete(passCompleted)) {
    return {
      kind: "complete",
      eyebrow: "Book Brain complete",
      title: "I know this book now.",
      detail: "Earlier pages, people, ideas, and evidence are ready when they help your reading.",
      activeIndex: 3,
    };
  }
  if (pipelineStage === "embeddings") {
    return {
      kind: "evidence",
      eyebrow: "Background understanding",
      title: "Making earlier pages easy to find.",
      detail: "ZhiyaAI is preparing the evidence paths that can bring you back to the right page.",
      activeIndex: 3,
    };
  }
  if (pipelineStage === "synthesis") {
    return {
      kind: "connections",
      eyebrow: "Background understanding",
      title: "Connecting the ideas that matter.",
      detail: "The book’s parts are being brought together while you can already begin reading.",
      activeIndex: 2,
    };
  }
  if (pipelineStage === "chunks") {
    return {
      kind: "structure",
      eyebrow: "Background understanding",
      title: "Finding structure, people, and ideas.",
      detail: "ZhiyaAI is learning the people and concepts inside this book, not learning about you.",
      activeIndex: 1,
    };
  }
  return {
    kind: "text",
    eyebrow: "Background understanding",
    title: "Text and reading structure are ready.",
    detail: "You can begin reading now while ZhiyaAI starts getting to know the rest of the book.",
    activeIndex: 0,
  };
}
