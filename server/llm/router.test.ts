import { describe, expect, it } from "vitest";
import { getProviderName } from "./router";

describe("LLM task routing", () => {
  it("uses the configured DeepSeek provider for every Book Brain analysis stage", () => {
    expect(getProviderName("chunk_analysis")).toBe("deepseek");
    expect(getProviderName("chapter_synthesis")).toBe("deepseek");
    expect(getProviderName("book_synthesis")).toBe("deepseek");
  });
});
