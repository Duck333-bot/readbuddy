import { describe, expect, it } from "vitest";
import { selectionActionLabels } from "./SelectionToolbar";

describe("Reader Design selection toolbar", () => {
  it("keeps the default action set compact", () => {
    expect(selectionActionLabels(false)).toEqual(["Explain", "Simpler", "Context"]);
  });

  it("adds Who? only when the selected name is a known entity", () => {
    expect(selectionActionLabels(true)).toEqual(["Explain", "Simpler", "Context", "Who?"]);
  });
});
