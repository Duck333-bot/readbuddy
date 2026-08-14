import { describe, expect, it } from "vitest";
import { nextMasterySnapshot } from "./learnerIntelligence";

const blank = () => ({ masteryState: "new" as const, confidenceEvidence: 0, correctAnswers: 0, incorrectAnswers: 0, timesExplained: 0, simplifyRequests: 0, defineRequests: 0 });

describe("Learner Intelligence V1", () => {
  it("treats explanation requests as a gentle learning signal, not mastery", () => {
    const next = nextMasterySnapshot(blank(), "simplify");
    expect(next.masteryState).toBe("learning");
    expect(next.simplifyRequests).toBe(1);
    expect(next.timesExplained).toBe(1);
  });

  it("lowers an established state after an incorrect material-grounded check", () => {
    const next = nextMasterySnapshot({ ...blank(), masteryState: "familiar", confidenceEvidence: 4, correctAnswers: 2 }, "quiz_incorrect");
    expect(next.masteryState).toBe("learning");
    expect(next.incorrectAnswers).toBe(1);
    expect(next.confidenceEvidence).toBe(3);
  });

  it("requires repeated successful evidence before calling a concept strong", () => {
    let state = blank();
    for (let index = 0; index < 4; index += 1) state = nextMasterySnapshot(state, "lesson_correct");
    expect(state.masteryState).toBe("strong");
  });
});
