import { describe, expect, it } from "vitest";
import { RESUME_RECAP_MIN_AWAY_MS, shouldOfferResumeRecap } from "./routers/reader";

describe("resume recap timing", () => {
  it("does not offer a recap after a brief 40-second absence", () => {
    const now = Date.UTC(2026, 7, 12, 12, 0, 0);
    expect(shouldOfferResumeRecap(new Date(now - 40_000), now)).toBe(false);
  });

  it("offers a recap after a meaningful return interval", () => {
    const now = Date.UTC(2026, 7, 12, 12, 0, 0);
    expect(shouldOfferResumeRecap(new Date(now - RESUME_RECAP_MIN_AWAY_MS), now)).toBe(true);
  });
});
