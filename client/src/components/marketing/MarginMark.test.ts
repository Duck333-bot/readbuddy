import { describe, expect, it } from "vitest";
import { marginMarkKinds } from "./MarginMark";

describe("Margin Marks", () => {
  it("limits the branded icon family to reading-native actions", () => {
    expect(marginMarkKinds).toEqual(["memory", "context", "evidence", "spoiler", "return"]);
  });
});
