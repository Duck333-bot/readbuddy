import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "./db";

describe("normalizeDatabaseUrl", () => {
  it("repairs an SSL JSON option whose quotes were escaped by an environment import", () => {
    const input = 'mysql://reader:secret@db.example.com:4000/zhiya?ssl={\\"rejectUnauthorized\\":true}';
    const normalized = normalizeDatabaseUrl(input);

    expect(new URL(normalized).searchParams.get("ssl")).toBe('{"rejectUnauthorized":true}');
  });

  it("does not alter a normal database URL", () => {
    const input = "mysql://reader:secret@db.example.com:4000/zhiya";
    expect(normalizeDatabaseUrl(input)).toBe(input);
  });
});
