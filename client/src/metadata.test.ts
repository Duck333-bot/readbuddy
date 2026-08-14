import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");

describe("public ZhiyaAI metadata", () => {
  it("declares the ZhiyaAI deployment as canonical instead of the unrelated Sleepline domain", () => {
    expect(indexHtml).toContain('<link rel="canonical" href="https://readbuddy-fqfwwm4a.manus.space/" />');
    expect(indexHtml).not.toContain('canonical" href="https://sleepline.icu/"');
  });

  it("keeps the managed public title and document title aligned to ZhiyaAI", () => {
    expect(process.env.VITE_APP_TITLE).toBe("ZhiyaAI");
    expect(indexHtml).toContain("<title>ZhiyaAI</title>");
  });
});
