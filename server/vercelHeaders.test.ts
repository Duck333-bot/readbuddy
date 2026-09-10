import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  rewrites: Array<{ source: string; destination: string }>;
};

describe("Vercel static security headers", () => {
  it("applies the baseline browser protections to static application routes", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as VercelConfig;
    const staticRule = config.headers.find(rule => rule.source === "/(.*)");
    const headers = new Map(staticRule?.headers.map(header => [header.key, header.value]));

    expect(headers).toMatchObject(new Map([
      ["X-Content-Type-Options", "nosniff"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
    ]));
  });

  it("sends private storage paths to the authenticated Express proxy before SPA fallback", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as VercelConfig;

    expect(config.rewrites).toContainEqual({
      source: "/manus-storage/(.*)",
      destination: "/api/index",
    });
    expect(config.rewrites.findIndex(rule => rule.source === "/manus-storage/(.*)"))
      .toBeLessThan(config.rewrites.findIndex(rule => rule.source === "/(.*)"));
  });
});
