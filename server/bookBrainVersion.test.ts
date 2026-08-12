import { describe, expect, it } from "vitest";
import { BOOK_BRAIN_VERSION, needsBookBrainRebuild } from "./bookBrain";

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
});
