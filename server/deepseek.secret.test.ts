import { describe, expect, it } from "vitest";
import { deepseekProvider } from "./llm/deepseek";

describe("DeepSeek credential", () => {
  it("accepts a lightweight server-side completion request", async () => {
    const response = await deepseekProvider.call({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      temperature: 0,
      max_tokens: 4,
    });
    expect(response.text.trim().length).toBeGreaterThan(0);
  }, 30_000);
});
