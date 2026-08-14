import * as db from "./db";
import { ensureGroundedStudySet } from "./studyGeneration";
import type { LessonStepMetadata, MaterialEvidence } from "@shared/materials";

const MICRO_LESSON_VERSION = 2;
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

function visualFor(primary: Concept, comparison?: Concept): LessonStepMetadata["visual"] {
  const primaryExcerpt = evidenceText(primary.evidence) || primary.definition;
  if (comparison) {
    return {
      kind: "comparison",
      title: "Two ideas to keep apart",
      caption: `Both ideas appear in ${sourceLabel(primary).toLowerCase()} and the surrounding material.`,
      items: [
        { label: primary.canonicalName, detail: primary.definition },
        { label: comparison.canonicalName, detail: comparison.definition },
      ],
    };
  }
  return {
    kind: "evidence_bridge",
    title: "From the source to the idea",
    caption: `This reading aid is based only on ${sourceLabel(primary).toLowerCase()}.`,
    items: [
      { label: "What the material says", detail: primaryExcerpt },
      { label: primary.canonicalName, detail: primary.definition },
    ],
  };
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

/**
 * Create a deterministic, source-backed revision flow. This deliberately avoids
 * an LLM at lesson time: claims, diagrams, MCQs and cards stay traceable to the
 * uploaded material even when a model provider is unavailable.
 */
export async function ensureAdaptiveLesson(userId: number, materialId: number) {
  const existing = await db.getActiveLesson(userId, materialId);
  if ((existing?.lesson.lessonVersion ?? 1) >= MICRO_LESSON_VERSION) return existing;
  if (existing) await db.abandonLesson(existing.lesson.id, userId);

  const [material, concepts, mastery] = await Promise.all([
    db.getMaterialForUser(materialId, userId),
    db.getConceptsForMaterial(materialId),
    db.getLearnerMastery(userId, materialId),
  ]);
  if (!material) throw new Error("Material not found.");
  if (!concepts.length) throw new Error("Material Intelligence is still preparing source-backed concepts.");

  const chosen = pickLessonConcepts(concepts, mastery);
  const primary = chosen[0];
  if (!primary) throw new Error("Material Intelligence is still preparing source-backed concepts.");

  const studySet = await ensureGroundedStudySet(userId, materialId);
  const cards = studySet.flashcards.filter(card => chosen.some(concept => concept.id === card.conceptId)).slice(0, 4);
  const questions = studySet.questions.filter(question => chosen.some(concept => concept.id === question.conceptId)).slice(0, 2);
  const steps: Omit<typeof import("../drizzle/schema").lessonSteps.$inferInsert, "lessonId">[] = [];
  const addStep = (step: Omit<typeof steps[number], "position">) => steps.push({ ...step, position: steps.length + 1 });
  const primaryEvidence = evidenceList(primary.evidence);
  const secondary = chosen[1];

  addStep({
    conceptId: primary.id,
    stepType: "intro",
    content: `In about seven minutes, you will revise ${chosen.map(concept => concept.canonicalName).join(", ")} from ${material.title}. Start with ${primary.canonicalName}: ${primary.definition}`,
    evidence: primaryEvidence,
    metadata: { sourceLabel: sourceLabel(primary), estimatedMinutes: 1 },
  });
  addStep({
    conceptId: primary.id,
    stepType: "visual",
    content: `See the source-backed shape of ${primary.canonicalName}.`,
    evidence: [...primaryEvidence, ...evidenceList(secondary?.evidence)].slice(0, 4),
    metadata: { sourceLabel: sourceLabel(primary), visual: visualFor(primary, secondary), estimatedMinutes: 1 },
  });
  addStep({
    conceptId: primary.id,
    stepType: "worked",
    content: evidenceText(primary.examples) || evidenceText(primary.evidence) || primary.definition,
    checkPrompt: `Notice how this source passage supports the meaning of ${primary.canonicalName}.`,
    evidence: primaryEvidence,
    metadata: { sourceLabel: sourceLabel(primary), estimatedMinutes: 1 },
  });

  for (const question of questions) {
    const concept = chosen.find(item => item.id === question.conceptId) ?? primary;
    addStep({
      conceptId: concept.id,
      stepType: "mcq",
      content: question.prompt,
      expectedAnswer: question.answer,
      evidence: evidenceList(question.evidence),
      metadata: {
        sourceLabel: sourceLabel(concept),
        mcq: { questionId: question.id, choices: Array.isArray(question.choices) ? question.choices : [], explanation: question.explanation },
        estimatedMinutes: 1,
      },
    });
  }

  const reminderConcepts = chosen.slice(0, 3);
  addStep({
    conceptId: primary.id,
    stepType: "note",
    content: `Keep these source-backed reminders nearby as you revise ${material.title}.`,
    evidence: reminderConcepts.flatMap(concept => evidenceList(concept.evidence)).slice(0, 6),
    metadata: {
      sourceLabel: sourceLabel(primary),
      recapPoints: reminderConcepts.map(concept => `${concept.canonicalName}: ${concept.definition}`),
      estimatedMinutes: 1,
    },
  });
  if (cards.length) {
    addStep({
      conceptId: primary.id,
      stepType: "flashcard",
      content: "Use these cards to bring the key ideas back from memory.",
      evidence: cards.flatMap(card => evidenceList(card.evidence)).slice(0, 6),
      metadata: { flashcardIds: cards.map(card => card.id), estimatedMinutes: 1 },
    });
  }
  addStep({
    conceptId: primary.id,
    stepType: "recap",
    content: `You have now met the central ideas from ${material.title}. Before you continue, keep the following points in mind.`,
    evidence: reminderConcepts.flatMap(concept => evidenceList(concept.evidence)).slice(0, 6),
    metadata: { recapPoints: reminderConcepts.map(concept => `${concept.canonicalName}: ${concept.definition}`), estimatedMinutes: 1 },
  });
  addStep({
    conceptId: primary.id,
    stepType: "continuation",
    content: "Lesson complete. Your next revision lesson will prioritise anything you marked as difficult and bring forward another source-backed idea from this material.",
    evidence: primaryEvidence,
    metadata: { estimatedMinutes: 0 },
  });

  const lessonId = await db.createLesson({
    userId,
    materialId,
    title: `7-minute revision: ${material.title}`,
    lessonVersion: MICRO_LESSON_VERSION,
    status: "active",
    currentStepIndex: 0,
  }, steps);
  const created = await db.getActiveLesson(userId, materialId);
  if (!created || created.lesson.id !== lessonId) throw new Error("Lesson could not be created.");
  return created;
}
