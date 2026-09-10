import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

describe("Vercel static security headers", () => {
  it("applies the baseline browser protections to static application routes", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as { headers: HeaderRule[] };
    const staticRule = config.headers.find(rule => rule.source === "/(.*)");
    const headers = new Map(staticRule?.headers.map(header => [header.key, header.value]));

    expect(headers).toMatchObject(new Map([
      ["X-Content-Type-Options", "nosniff"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
    ]));
  });
});
