import { describe, expect, it } from "vitest";
import { shouldOfferResumeRecap } from "./readerResume";

describe("resume recap routing", () => {
  it("does not show a stale saved-progress recap for an explicit page link", () => {
    expect(shouldOfferResumeRecap("?page=12", true)).toBe(false);
  });

  it("still offers a recap when a reader genuinely returns to saved progress", () => {
    expect(shouldOfferResumeRecap("", true)).toBe(true);
  });
});
