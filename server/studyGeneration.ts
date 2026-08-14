import * as db from "./db";
import type { MaterialEvidence } from "@shared/materials";

function conceptEvidence(value: unknown): MaterialEvidence[] {
  return Array.isArray(value) ? value as MaterialEvidence[] : [];
}

function distractorDefinitions(concepts: Awaited<ReturnType<typeof db.getConceptsForMaterial>>, conceptId: number, count = 3) {
  return concepts.filter(item => item.id !== conceptId).map(item => item.definition).filter(Boolean).slice(0, count);
}

/**
 * V1 study artifacts are deliberately deterministic from Material Intelligence
 * concepts and evidence. This makes them editable, stable, and grounded even
 * when a generation provider is temporarily unavailable.
 */
export async function ensureGroundedStudySet(userId: number, materialId: number) {
  const [material, concepts, existingCards, existingQuiz, notes] = await Promise.all([
    db.getMaterialForUser(materialId, userId),
    db.getConceptsForMaterial(materialId),
    db.listFlashcards(userId, materialId),
    db.getLatestStudyQuiz(userId, materialId),
    db.listMaterialNotes(userId, materialId),
  ]);
  if (!material) throw new Error("Material not found.");
  if (!concepts.length) throw new Error("Material Intelligence is still preparing source-backed concepts.");

  if (!existingCards.length) {
    await db.insertFlashcards(concepts.slice(0, 12).map(concept => ({
      userId,
      materialId,
      conceptId: concept.id,
      front: `What is ${concept.canonicalName}?`,
      back: concept.definition,
      evidence: conceptEvidence(concept.evidence),
      difficulty: concept.difficulty === "advanced" ? "hard" : concept.difficulty === "introductory" ? "easy" : "medium",
    })));
  }

  if (!notes.some(note => note.noteType === "generated")) {
    const content = concepts.slice(0, 8).map(concept => `• ${concept.canonicalName}: ${concept.definition}`).join("\n\n");
    await db.createMaterialNote({
      userId,
      materialId,
      noteType: "generated",
      title: `Key ideas: ${material.title}`,
      content,
      evidence: concepts.slice(0, 8).flatMap(concept => conceptEvidence(concept.evidence)).slice(0, 16),
    });
  }

  let quiz = existingQuiz;
  if (!quiz) {
    const quizId = await db.createStudyQuiz({ userId, materialId, title: `Concept check: ${material.title}`, status: "active" });
    const rows = concepts.slice(0, 6).map((concept, index) => {
      const choices = [concept.definition, ...distractorDefinitions(concepts, concept.id)].slice(0, 4);
      const orderedChoices = choices.sort((left, right) => `${concept.id}:${left}`.localeCompare(`${concept.id}:${right}`));
      return {
        quizId,
        conceptId: concept.id,
        questionType: "multiple_choice" as const,
        prompt: `Which explanation best captures ${concept.canonicalName} in this material?`,
        choices: orderedChoices,
        answer: concept.definition,
        explanation: concept.definition,
        evidence: conceptEvidence(concept.evidence),
        difficulty: concept.difficulty === "advanced" ? "hard" as const : concept.difficulty === "introductory" ? "easy" as const : "medium" as const,
        position: index + 1,
      };
    });
    await db.insertQuizQuestions(rows);
    quiz = await db.getLatestStudyQuiz(userId, materialId);
  }
  return { flashcards: await db.listFlashcards(userId, materialId), quiz, questions: quiz ? await db.getQuizQuestions(quiz.id) : [] };
}
