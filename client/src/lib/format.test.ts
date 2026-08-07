import { describe, expect, it } from "vitest";
import { formatBytes, progressPercent } from "./format";

describe("progressPercent", () => {
  it("returns 0 when the page count is unknown", () => {
    expect(progressPercent(5, 0)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
  });

  it("never exceeds 100", () => {
    expect(progressPercent(40, 10)).toBe(100);
  });
});

describe("formatBytes", () => {
  it("handles zero", () => {
    expect(formatBytes(0)).toBe("—");
  });

  it("formats kilobytes and megabytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

