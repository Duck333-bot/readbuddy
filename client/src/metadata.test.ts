import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");

describe("public ReadBuddy metadata", () => {
  it("declares the ReadBuddy deployment as canonical instead of the unrelated Sleepline domain", () => {
    expect(indexHtml).toContain('<link rel="canonical" href="https://readbuddy-fqfwwm4a.manus.space/" />');
    expect(indexHtml).not.toContain('canonical" href="https://sleepline.icu/"');
  });
});
