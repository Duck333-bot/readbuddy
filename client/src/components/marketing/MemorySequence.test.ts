import { describe, expect, it } from "vitest";
import { memorySequenceStages, stageIndexForProgress } from "./MemorySequence";

describe("ReadBuddy marketing memory sequence", () => {
  it("keeps the approved five-stage story in order", () => {
    expect(memorySequenceStages).toHaveLength(5);
    expect(memorySequenceStages.map((stage) => stage.eyebrow)).toEqual([
      "0% · The pause",
      "25% · The thread",
      "50% · The evidence",
      "75% · The context",
      "100% · Back to reading",
    ]);
  });

  it("maps scroll progress safely to a valid story stage", () => {
    expect(stageIndexForProgress(-0.2)).toBe(0);
    expect(stageIndexForProgress(0.21)).toBe(1);
    expect(stageIndexForProgress(0.58)).toBe(2);
    expect(stageIndexForProgress(0.99)).toBe(4);
    expect(stageIndexForProgress(4)).toBe(4);
  });
});
