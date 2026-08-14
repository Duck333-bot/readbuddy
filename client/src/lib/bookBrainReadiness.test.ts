import { describe, expect, it } from "vitest";
import { getBookBrainPresentation, getBrainStepState, isBookBrainComplete, isReadyToRead } from "./bookBrainReadiness";

describe("Book Brain V2.1 readiness", () => {
  it("allows reading as soon as extraction/upload has completed", () => {
    expect(isReadyToRead(true)).toBe(true);
    expect(isReadyToRead(false)).toBe(false);
  });

  it("keeps Book Brain progressive without treating incomplete passes as a read blocker", () => {
    expect(isBookBrainComplete(0)).toBe(false);
    expect(isBookBrainComplete(3)).toBe(false);
    expect(isBookBrainComplete(4)).toBe(true);
    expect(getBrainStepState(1, 0)).toBe("complete");
    expect(getBrainStepState(1, 1)).toBe("active");
    expect(getBrainStepState(1, 2)).toBe("pending");
  });

  it("uses real pipeline stages for the Upload understanding narrative", () => {
    expect(getBookBrainPresentation({ passCompleted: 1, pipelineStage: "chunks" })).toMatchObject({ kind: "structure", activeIndex: 1 });
    expect(getBookBrainPresentation({ passCompleted: 2, pipelineStage: "synthesis" })).toMatchObject({ kind: "connections", activeIndex: 2 });
    expect(getBookBrainPresentation({ passCompleted: 3, pipelineStage: "embeddings" })).toMatchObject({ kind: "evidence", activeIndex: 3 });
    expect(getBookBrainPresentation({ passCompleted: 4, pipelineStage: "complete" })).toMatchObject({ kind: "complete", title: "I know this book now." });
  });
});
