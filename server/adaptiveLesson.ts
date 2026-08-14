import * as db from "./db";

function evidenceText(value: unknown) {
  const evidence = Array.isArray(value) ? value as { excerpt?: string }[] : [];
  return evidence[0]?.excerpt?.trim() || null;
}

/** Build a small, resumable first lesson using the learner's weakest/newest concepts first. */
export async function ensureAdaptiveLesson(userId: number, materialId: number) {
  const existing = await db.getActiveLesson(userId, materialId);
  if (existing) return existing;
  const [material, concepts, mastery] = await Promise.all([
    db.getMaterialForUser(materialId, userId),
    db.getConceptsForMaterial(materialId),
    db.getLearnerMastery(userId, materialId),
  ]);
  if (!material) throw new Error("Material not found.");
  if (!concepts.length) throw new Error("Material Intelligence is still preparing source-backed concepts.");
  const masteryByConcept = new Map(mastery.map(item => [item.conceptId, item]));
  const priority = (conceptId: number) => {
    const state = masteryByConcept.get(conceptId)?.masteryState ?? "new";
    return state === "learning" ? 0 : state === "new" ? 1 : state === "familiar" ? 2 : 3;
  };
  const chosen = [...concepts].sort((left, right) => priority(left.id) - priority(right.id) || right.importance - left.importance).slice(0, 3);
  const steps: Omit<typeof import("../drizzle/schema").lessonSteps.$inferInsert, "lessonId">[] = [];
  for (const concept of chosen) {
    const sourceExcerpt = evidenceText(concept.evidence);
    steps.push({ conceptId: concept.id, position: steps.length + 1, stepType: "explain", content: concept.definition, evidence: concept.evidence });
    steps.push({ conceptId: concept.id, position: steps.length + 1, stepType: "example", content: concept.examples?.[0]?.excerpt || sourceExcerpt || `Find where ${concept.canonicalName} appears in the source material.`, evidence: concept.evidence });
    steps.push({ conceptId: concept.id, position: steps.length + 1, stepType: "check", content: `Check your understanding of ${concept.canonicalName}.`, checkPrompt: `Can you explain ${concept.canonicalName} in your own words?`, expectedAnswer: concept.definition, evidence: concept.evidence });
    steps.push({ conceptId: concept.id, position: steps.length + 1, stepType: "adapt", content: `If this still feels unclear, ask ZhiyaAI to make ${concept.canonicalName} simpler. The next lesson will keep it near the front.`, evidence: concept.evidence });
  }
  const lessonId = await db.createLesson({ userId, materialId, title: `Learn: ${material.title}`, status: "active", currentStepIndex: 0 }, steps);
  const created = await db.getActiveLesson(userId, materialId);
  if (!created || created.lesson.id !== lessonId) throw new Error("Lesson could not be created.");
  return created;
}
