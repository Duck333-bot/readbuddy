import * as db from "./db";
import { ensureGroundedStudySet } from "./studyGeneration";
import type { LessonStepMetadata, MaterialEvidence, MaterialLessonPlan } from "@shared/materials";

const MICRO_LESSON_VERSION = 9;
type Concept = Awaited<ReturnType<typeof db.getConceptsForMaterial>>[number];

function evidenceList(value: unknown): MaterialEvidence[] {
  return Array.isArray(value) ? value as MaterialEvidence[] : [];
}

function evidenceText(value: unknown) {
  return evidenceList(value)[0]?.excerpt?.trim() || null;
}

function sourceLabel(concept: Concept) {
  const source = evidenceList(concept.evidence)[0]?.source;
  if (!source) return "Your uploaded material";
  return `${source.unitType === "slide" ? "Slide" : source.unitType === "page" ? "Page" : "Section"} ${source.unitIndex}`;
}

function pickLessonConcepts(concepts: Concept[], mastery: Awaited<ReturnType<typeof db.getLearnerMastery>>) {
  const masteryByConcept = new Map(mastery.map(item => [item.conceptId, item]));
  const priority = (conceptId: number) => {
    const state = masteryByConcept.get(conceptId)?.masteryState ?? "new";
    return state === "learning" ? 0 : state === "new" ? 1 : state === "familiar" ? 2 : 3;
  };
  return [...concepts]
    .sort((left, right) => priority(left.id) - priority(right.id) || right.importance - left.importance)
    .slice(0, Math.min(4, Math.max(3, concepts.length)));
}

function storedPlan(value: unknown): MaterialLessonPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const plan = (value as Record<string, unknown>).lessonPlan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const candidate = plan as Partial<MaterialLessonPlan>;
  if (typeof candidate.centralQuestion !== "string" || typeof candidate.narrative !== "string" || !Array.isArray(candidate.conceptNames)) return null;
  return candidate as MaterialLessonPlan;
}

function fallbackPlan(materialTitle: string, chosen: Concept[]): MaterialLessonPlan {
  const names = chosen.slice(0, 3).map(concept => concept.canonicalName);
  return {
    centralQuestion: `How do ${names.join(", ")} explain the main idea in ${materialTitle}?`,
    narrative: "Connect the ideas in the source before trying to recall their definitions.",
    conceptNames: names,
    checks: [],
    estimatedMinutes: Math.min(6, Math.max(3, chosen.length + 2)),
  };
}

function choosePlanConcepts(plan: MaterialLessonPlan, concepts: Concept[], mastery: Awaited<ReturnType<typeof db.getLearnerMastery>>) {
  const byName = new Map(concepts.map(concept => [concept.canonicalName.toLowerCase(), concept]));
  const planned = plan.conceptNames.map(name => byName.get(name.toLowerCase())).filter((concept): concept is Concept => Boolean(concept));
  return planned.length ? planned.slice(0, 5) : pickLessonConcepts(concepts, mastery);
}

function visualFromPlan(plan: MaterialLessonPlan, concepts: Concept[]): LessonStepMetadata["visual"] | undefined {
  if (!plan.visual) return undefined;
  const items = plan.visual.conceptNames
    .map(name => concepts.find(concept => concept.canonicalName.toLowerCase() === name.toLowerCase()))
    .filter((concept): concept is Concept => Boolean(concept))
    .map(concept => ({ label: concept.canonicalName, detail: concept.definition }));
  if (items.length < 2) return undefined;
  return { kind: plan.visual.kind, title: plan.visual.title, caption: plan.visual.caption, items };
}

/**
 * Assemble a short, source-backed revision flow from Material Intelligence's
 * validated plan. The plan decides whether a visual or a check earns its place;
 * the UI no longer forces every upload through the same nine cards.
 */
export async function ensureAdaptiveLesson(userId: number, materialId: number) {
  const existing = await db.getActiveLesson(userId, materialId);
  if ((existing?.lesson.lessonVersion ?? 1) >= MICRO_LESSON_VERSION) return existing;
  if (existing) await db.abandonLesson(existing.lesson.id, userId);

  const [material, concepts, mastery, intelligence] = await Promise.all([
    db.getMaterialForUser(materialId, userId),
    db.getConceptsForMaterial(materialId),
    db.getLearnerMastery(userId, materialId),
    db.getMaterialIntelligence(materialId),
  ]);
  if (!material) throw new Error("Material not found.");
  if (!concepts.length) throw new Error("Material Intelligence is still preparing source-backed concepts.");

  const defaultConcepts = pickLessonConcepts(concepts, mastery);
  const plan = storedPlan(intelligence?.structuredSummary) ?? fallbackPlan(material.title, defaultConcepts);
  const chosen = choosePlanConcepts(plan, concepts, mastery);
  const primary = chosen[0];
  if (!primary) throw new Error("Material Intelligence is still preparing source-backed concepts.");

  const studySet = await ensureGroundedStudySet(userId, materialId);
  const cards = studySet.flashcards.filter(card => chosen.some(concept => concept.id === card.conceptId)).slice(0, 4);
  const visual = visualFromPlan(plan, chosen);
  const steps: Omit<typeof import("../drizzle/schema").lessonSteps.$inferInsert, "lessonId">[] = [];
  const addStep = (step: Omit<typeof steps[number], "position">) => steps.push({ ...step, position: steps.length + 1 });
  const primaryEvidence = evidenceList(primary.evidence);
  const plannedChecks = plan.checks.filter(check => chosen.some(concept => concept.canonicalName.toLowerCase() === check.conceptName.toLowerCase()));

  addStep({
    conceptId: primary.id,
    stepType: "intro",
    content: `In about ${plan.estimatedMinutes} minutes, you will answer: ${plan.centralQuestion} ${plan.narrative}`,
    evidence: primaryEvidence,
    metadata: { sourceLabel: sourceLabel(primary), estimatedMinutes: plan.estimatedMinutes },
  });
  if (visual) addStep({
    conceptId: primary.id,
    stepType: "visual",
    content: visual.title,
    evidence: chosen.flatMap(concept => evidenceList(concept.evidence)).slice(0, 4),
    metadata: { sourceLabel: sourceLabel(primary), visual, estimatedMinutes: 0 },
  });
  addStep({
    conceptId: primary.id,
    stepType: "worked",
    content: evidenceText(primary.examples) || evidenceText(primary.evidence) || primary.definition,
    checkPrompt: plan.narrative,
    evidence: primaryEvidence,
    metadata: { sourceLabel: sourceLabel(primary), estimatedMinutes: 0 },
  });

  for (const check of plannedChecks) {
    const concept = chosen.find(item => item.canonicalName.toLowerCase() === check.conceptName.toLowerCase()) ?? primary;
    addStep({
      conceptId: concept.id,
      stepType: "mcq",
      content: check.prompt,
      expectedAnswer: check.answer,
      evidence: evidenceList(concept.evidence),
      metadata: {
        sourceLabel: sourceLabel(concept),
        mcq: { choices: check.choices, explanation: check.explanation },
        estimatedMinutes: 0,
      },
    });
  }

  const reminderConcepts = chosen.slice(0, 3);
  addStep({
    conceptId: primary.id,
    stepType: "note",
    content: `Keep these source-backed reminders nearby as you revise ${material.title}.`,
    evidence: reminderConcepts.flatMap(concept => evidenceList(concept.evidence)).slice(0, 6),
    metadata: { sourceLabel: sourceLabel(primary), recapPoints: reminderConcepts.map(concept => `${concept.canonicalName}: ${concept.definition}`), estimatedMinutes: 0 },
  });
  if (cards.length) addStep({
    conceptId: primary.id,
    stepType: "flashcard",
    content: "Use these cards only for the source ideas worth bringing back from memory.",
    evidence: cards.flatMap(card => evidenceList(card.evidence)).slice(0, 6),
    metadata: { flashcardIds: cards.map(card => card.id), estimatedMinutes: 0 },
  });
  addStep({
    conceptId: primary.id,
    stepType: "recap",
    content: `You can now answer the lesson question: ${plan.centralQuestion}`,
    evidence: reminderConcepts.flatMap(concept => evidenceList(concept.evidence)).slice(0, 6),
    metadata: { recapPoints: reminderConcepts.map(concept => `${concept.canonicalName}: ${concept.definition}`), estimatedMinutes: 0 },
  });
  addStep({
    conceptId: primary.id,
    stepType: "continuation",
    content: "Lesson complete. Your next revision can prioritise ideas you found difficult and move to another source-backed connection.",
    evidence: primaryEvidence,
    metadata: { estimatedMinutes: 0 },
  });

  const lessonId = await db.createLesson({
    userId,
    materialId,
    title: `${plan.estimatedMinutes}-minute revision: ${material.title}`,
    lessonVersion: MICRO_LESSON_VERSION,
    status: "active",
    currentStepIndex: 0,
  }, steps);
  const created = await db.getActiveLesson(userId, materialId);
  if (!created || created.lesson.id !== lessonId) throw new Error("Lesson could not be created.");
  return created;
}
