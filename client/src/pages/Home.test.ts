import { describe, expect, it } from "vitest";
import { zhiyaHomepagePillars } from "./Home";

describe("ZhiyaAI homepage", () => {
  it("keeps the public promise grounded in the reading product rather than fabricated social proof", () => {
    expect(zhiyaHomepagePillars).toEqual(["Keep your place", "Find earlier context", "Understand without spoilers"]);
  });
});
