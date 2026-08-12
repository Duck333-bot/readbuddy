import { describe, expect, it } from "vitest";
import { BOOK_BRAIN_VERSION, needsBookBrainRebuild, shouldInitialiseBookBrainStage } from "./bookBrain";

describe("Book Brain versioning", () => {
  it("rebuilds a completed analysis from an older version", () => {
    expect(needsBookBrainRebuild(BOOK_BRAIN_VERSION - 1, 4)).toBe(true);
  });

  it("does not rebuild a completed current analysis", () => {
    expect(needsBookBrainRebuild(BOOK_BRAIN_VERSION, 4)).toBe(false);
  });

  it("rebuilds incomplete analyses even when their version number is current", () => {
    expect(needsBookBrainRebuild(BOOK_BRAIN_VERSION, 3)).toBe(true);
  });

  it("continues a staged long-book rebuild instead of deleting its partial chunks", () => {
    expect(shouldInitialiseBookBrainStage(BOOK_BRAIN_VERSION, "chunks")).toBe(false);
    expect(shouldInitialiseBookBrainStage(BOOK_BRAIN_VERSION, "synthesis")).toBe(false);
    expect(shouldInitialiseBookBrainStage(BOOK_BRAIN_VERSION, "embeddings")).toBe(false);
  });

  it("starts a fresh stage only for an older pipeline or an explicit idle state", () => {
    expect(shouldInitialiseBookBrainStage(BOOK_BRAIN_VERSION - 1, "chunks")).toBe(true);
    expect(shouldInitialiseBookBrainStage(BOOK_BRAIN_VERSION, "idle")).toBe(true);
  });
});
