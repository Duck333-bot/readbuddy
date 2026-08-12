import { describe, expect, it } from "vitest";
import { getBrainStepState, isBookBrainComplete, isReadyToRead } from "./bookBrainReadiness";

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
});
