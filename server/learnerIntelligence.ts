import * as db from "./db";
import type { LearnerMasteryState } from "@shared/materials";

export type LearnerSignalType = "define" | "simplify" | "exposure" | "quiz_correct" | "quiz_incorrect" | "lesson_correct" | "lesson_incorrect";

export type MasterySnapshot = {
  masteryState: LearnerMasteryState;
  confidenceEvidence: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timesExplained: number;
  simplifyRequests: number;
  defineRequests: number;
};

export function nextMasterySnapshot(previous: MasterySnapshot, signal: LearnerSignalType): MasterySnapshot {
  const next = { ...previous };
  if (signal === "define") {
    next.defineRequests += 1;
    next.timesExplained += 1;
    next.masteryState = "learning";
  } else if (signal === "simplify") {
    next.simplifyRequests += 1;
    next.timesExplained += 1;
    next.masteryState = "learning";
  } else if (signal === "exposure") {
    next.confidenceEvidence += 1;
    if (next.masteryState === "new") next.masteryState = "learning";
  } else if (signal === "quiz_incorrect" || signal === "lesson_incorrect") {
    next.incorrectAnswers += 1;
    next.confidenceEvidence = Math.max(0, next.confidenceEvidence - 1);
    next.masteryState = "learning";
  } else {
    next.correctAnswers += 1;
    next.confidenceEvidence += 2;
    if (next.correctAnswers >= 4 && next.confidenceEvidence >= 7 && next.incorrectAnswers <= 1) {
      next.masteryState = "strong";
    } else if (next.correctAnswers >= 2 && next.confidenceEvidence >= 3) {
      next.masteryState = "familiar";
    } else {
      next.masteryState = "learning";
    }
  }
  return next;
}

export async function recordMasterySignal(input: {
  userId: number;
  materialId: number;
  conceptId: number;
  normalizedConceptKey: string;
  signal: LearnerSignalType;
}) {
  const current = await db.getLearnerMasteryForConcept(input.userId, input.conceptId);
  const previous: MasterySnapshot = current
    ? {
        masteryState: current.masteryState,
        confidenceEvidence: current.confidenceEvidence,
        correctAnswers: current.correctAnswers,
        incorrectAnswers: current.incorrectAnswers,
        timesExplained: current.timesExplained,
        simplifyRequests: current.simplifyRequests,
        defineRequests: current.defineRequests,
      }
    : { masteryState: "new", confidenceEvidence: 0, correctAnswers: 0, incorrectAnswers: 0, timesExplained: 0, simplifyRequests: 0, defineRequests: 0 };
  const next = nextMasterySnapshot(previous, input.signal);
  const now = new Date();
  await db.upsertLearnerMastery({
    userId: input.userId,
    materialId: input.materialId,
    conceptId: input.conceptId,
    normalizedConceptKey: input.normalizedConceptKey,
    ...next,
    lastSeenAt: now,
    lastPracticedAt: input.signal.includes("quiz") || input.signal.includes("lesson") ? now : null,
  });
  await db.recordLearnerSignal({ userId: input.userId, materialId: input.materialId, conceptId: input.conceptId, signalType: input.signal });
  return next;
}
