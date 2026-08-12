import { describe, expect, it } from "vitest";
import { memoryVisibleAtPage } from "./readerMemoryVisibility";

describe("spoiler-safe Reader Memory", () => {
  const items = [{ word: "runt", pageFirstAsked: 7 }, { word: "Charlotte", pageFirstAsked: 60 }];

  it("does not inject help first learned on a future page in safe mode", () => {
    expect(memoryVisibleAtPage(items, 7, "safe")).toEqual([{ word: "runt", pageFirstAsked: 7 }]);
  });

  it("keeps the full reader history available in whole-book mode", () => {
    expect(memoryVisibleAtPage(items, 7, "full")).toEqual(items);
  });
});
