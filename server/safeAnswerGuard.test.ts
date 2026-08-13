import { describe, expect, it } from "vitest";
import { findUnsupportedSafeProperTerms, safeEvidenceFallback, safeExtractiveBookAnswer } from "./safeAnswerGuard";

describe("safe answer grounding guard", () => {
  it("flags book knowledge whose proper names are absent from supplied evidence", () => {
    const source = "Paul is in bed while Jessica speaks to an old woman.";
    expect(findUnsupportedSafeProperTerms("Duke Leto will take Paul to Arrakis.", source)).toEqual(
      expect.arrayContaining(["duke leto", "arrakis"]),
    );
  });

  it("keeps source-backed names and produces a current-page-only fallback", () => {
    const source = "Paul is in bed while Jessica speaks to an old woman.";
    expect(findUnsupportedSafeProperTerms("Paul and Jessica are in this scene.", source)).toEqual([]);
    expect(safeEvidenceFallback("Paul", 12)).toContain("[[p.12]]");
  });

  it("answers safe whole-book questions using only extractive reached-page evidence", () => {
    const answer = safeExtractiveBookAnswer({
      question: "Who is Paul?",
      highlight: "Paul",
      pageContext: "Paul lies in bed while an old woman looks at him.",
      evidencePassages: "[p.11]\nJessica speaks while Paul is discussed as a fifteen-year-old boy.",
      pageNumber: 12,
    });
    expect(answer).toContain("[[p.11]]");
    expect(answer).toContain("fifteen-year-old boy");
    expect(answer).not.toContain("Arrakis");
  });
});
