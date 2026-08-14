import { describe, expect, it } from "vitest";
import { landingWalkthroughSteps, walkthroughStageLabel } from "./LandingContextWalkthrough";

describe("LandingContextWalkthrough", () => {
  it("keeps the landing demo aligned to the real Context capability sequence", () => {
    expect(landingWalkthroughSteps).toEqual([
      "Current passage",
      "Sentence selected",
      "Context requested",
      "Earlier passage",
      "Evidence connection",
      "Return to reading",
    ]);
  });

  it("keeps stage labels within the supported walkthrough states", () => {
    expect(walkthroughStageLabel(-1)).toBe("Current passage");
    expect(walkthroughStageLabel(3)).toBe("Earlier passage");
    expect(walkthroughStageLabel(99)).toBe("Return to reading");
  });
});
