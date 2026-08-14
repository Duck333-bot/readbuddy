import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");

describe("ZhiyaAI public brand configuration", () => {
  it("aligns the managed application title with visible document metadata", () => {
    expect(process.env.VITE_APP_TITLE).toBe("ZhiyaAI");
    expect(indexHtml).toContain("<title>ZhiyaAI</title>");
  });

  it("keeps the public canonical identity off the unrelated Sleepline domain", () => {
    expect(indexHtml).toContain('<link rel="canonical" href="https://readbuddy-fqfwwm4a.manus.space/" />');
    expect(indexHtml).not.toContain('canonical" href="https://sleepline.icu/"');
  });
});
