import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import * as db from "../db";
import { parseMaterial, MaterialParseError, MAX_MATERIAL_BYTES, inferMimeType } from "../materials/parser";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { MATERIAL_TYPES } from "@shared/materials";
import { createHeartbeatJob, deleteHeartbeatJob } from "../_core/heartbeat";
import { ensureGroundedStudySet } from "../studyGeneration";
import { recordMasterySignal } from "../learnerIntelligence";
import { ensureAdaptiveLesson } from "../adaptiveLesson";
import { COOKIE_NAME } from "@shared/const";

const filenameSchema = z.string().trim().min(1).max(400);

async function ownMaterialOrThrow(materialId: number, userId: number) {
  const material = await db.getMaterialForUser(materialId, userId);
  if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "Material not found in your workspace." });
  return material;
}

export const materialsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listMaterialsForUser(ctx.user.id)),

  get: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    return ownMaterialOrThrow(input.materialId, ctx.user.id);
  }),

  units: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    return db.getMaterialUnits(input.materialId);
  }),

  overview: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const material = await ownMaterialOrThrow(input.materialId, ctx.user.id);
    const [intelligence, concepts, mastery, notes] = await Promise.all([
      db.getMaterialIntelligence(input.materialId),
      db.getConceptsForMaterial(input.materialId),
      db.getLearnerMastery(ctx.user.id, input.materialId),
      db.listMaterialNotes(ctx.user.id, input.materialId),
    ]);
    return { material, intelligence, concepts, mastery, notes };
  }),

  retryIntelligence: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const material = await ownMaterialOrThrow(input.materialId, ctx.user.id);
    const intelligence = await db.getMaterialIntelligence(material.id);
    if (!intelligence) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Understanding has not been prepared for this material yet." });
    if (intelligence.pipelineStage === "complete") return { scheduled: false, reason: "already-complete" as const };
    if (intelligence.jobTaskUid) {
      try { await deleteHeartbeatJob(intelligence.jobTaskUid, ""); } catch { /* A missing stale task is safe to replace. */ }
    }
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    const job = await createHeartbeatJob({
      name: `material-intelligence-${material.id}`,
      cron: "0 * * * * *",
      path: "/api/scheduled/materialIntelligence",
      payload: { materialId: material.id },
      description: `Material Intelligence retry for material ${material.id}`,
    }, sessionToken);
    await db.updateMaterialIntelligence(material.id, { jobTaskUid: job.taskUid, pipelineStage: "chunks", pipelineError: null, pipelineRetryAfter: null });
    await db.updateMaterialProcessing(material.id, { processingState: "ready", processingError: null, processingRetryAfter: null });
    return { scheduled: true, taskUid: job.taskUid };
  }),

  saveNote: protectedProcedure.input(z.object({
    materialId: z.number().int().positive(),
    noteId: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(512),
    content: z.string().trim().min(1).max(30000),
  })).mutation(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    if (input.noteId) {
      await db.updateMaterialNote(input.noteId, ctx.user.id, input.materialId, { title: input.title, content: input.content });
      return { noteId: input.noteId };
    }
    const noteId = await db.createMaterialNote({ userId: ctx.user.id, materialId: input.materialId, noteType: "personal", title: input.title, content: input.content, evidence: null });
    return { noteId };
  }),

  studySet: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    try {
      return await ensureGroundedStudySet(ctx.user.id, input.materialId);
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Study content is not ready yet." });
    }
  }),

  flashcards: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    return db.listFlashcards(ctx.user.id, input.materialId);
  }),

  rateFlashcard: protectedProcedure.input(z.object({ materialId: z.number().int().positive(), flashcardId: z.number().int().positive(), rating: z.enum(["again", "hard", "good"]) })).mutation(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    await db.updateFlashcardRating(input.flashcardId, ctx.user.id, input.materialId, input.rating);
    return { ok: true };
  }),

  quiz: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    const quiz = await db.getLatestStudyQuiz(ctx.user.id, input.materialId);
    return quiz ? { quiz, questions: await db.getQuizQuestions(quiz.id) } : { quiz: null, questions: [] };
  }),

  answerQuizQuestion: protectedProcedure.input(z.object({ questionId: z.number().int().positive(), selectedAnswer: z.string().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
    const row = await db.getQuizQuestionForUser(input.questionId, ctx.user.id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz question not found." });
    const isCorrect = row.question.answer.trim().toLocaleLowerCase() === input.selectedAnswer.trim().toLocaleLowerCase();
    await db.recordQuizAnswer({ questionId: row.question.id, userId: ctx.user.id, answer: input.selectedAnswer, isCorrect: isCorrect ? 1 : 0 });
    if (row.question.conceptId) {
      const concepts = await db.getConceptsForMaterial(row.quiz.materialId);
      const concept = concepts.find(item => item.id === row.question.conceptId);
      if (concept) await recordMasterySignal({ userId: ctx.user.id, materialId: row.quiz.materialId, conceptId: concept.id, normalizedConceptKey: concept.normalizedKey, signal: isCorrect ? "quiz_correct" : "quiz_incorrect" });
    }
    return { isCorrect, explanation: row.question.explanation, evidence: row.question.evidence };
  }),

  lesson: protectedProcedure.input(z.object({ materialId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await ownMaterialOrThrow(input.materialId, ctx.user.id);
    try {
      return await ensureAdaptiveLesson(ctx.user.id, input.materialId);
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Lesson is not ready yet." });
    }
  }),

  completeLessonStep: protectedProcedure.input(z.object({ stepId: z.number().int().positive(), understood: z.boolean().optional(), learnerAnswer: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const owned = await db.completeLessonStep(input.stepId, ctx.user.id, { learnerAnswer: input.learnerAnswer ?? null, isCorrect: input.understood === undefined ? null : input.understood ? 1 : 0 });
    if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson step not found." });
    if (owned.step.conceptId && input.understood !== undefined) {
      const concepts = await db.getConceptsForMaterial(owned.lesson.materialId);
      const concept = concepts.find(item => item.id === owned.step.conceptId);
      if (concept) await recordMasterySignal({ userId: ctx.user.id, materialId: owned.lesson.materialId, conceptId: concept.id, normalizedConceptKey: concept.normalizedKey, signal: input.understood ? "lesson_correct" : "lesson_incorrect" });
    }
    const lesson = await db.getActiveLesson(ctx.user.id, owned.lesson.materialId);
    if (lesson && lesson.steps.every(step => step.completedAt)) await db.completeLesson(lesson.lesson.id, ctx.user.id);
    return { ok: true };
  }),

  answerLessonMcq: protectedProcedure.input(z.object({ stepId: z.number().int().positive(), selectedAnswer: z.string().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
    const row = await db.getLessonStepForUser(input.stepId, ctx.user.id);
    if (!row || row.step.stepType !== "mcq" || !row.step.expectedAnswer) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson question not found." });
    const isCorrect = row.step.expectedAnswer.trim().toLocaleLowerCase() === input.selectedAnswer.trim().toLocaleLowerCase();
    const owned = await db.completeLessonStep(input.stepId, ctx.user.id, { learnerAnswer: input.selectedAnswer, isCorrect: isCorrect ? 1 : 0 });
    if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson question not found." });
    if (owned.step.conceptId) {
      const concepts = await db.getConceptsForMaterial(owned.lesson.materialId);
      const concept = concepts.find(item => item.id === owned.step.conceptId);
      if (concept) await recordMasterySignal({ userId: ctx.user.id, materialId: owned.lesson.materialId, conceptId: concept.id, normalizedConceptKey: concept.normalizedKey, signal: isCorrect ? "lesson_correct" : "lesson_incorrect" });
    }
    const lesson = await db.getActiveLesson(ctx.user.id, owned.lesson.materialId);
    if (lesson && lesson.steps.every(step => step.completedAt)) await db.completeLesson(lesson.lesson.id, ctx.user.id);
    return {
      isCorrect,
      explanation: row.step.metadata?.mcq?.explanation ?? row.step.content,
      correctAnswer: isCorrect ? null : row.step.expectedAnswer,
    };
  }),

  readerSignal: protectedProcedure.input(z.object({ bookId: z.number().int().positive(), mode: z.enum(["define", "simplify"]), highlight: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
    const material = await db.getMaterialForLegacyBook(input.bookId, ctx.user.id);
    if (!material) return { recorded: false };
    const text = input.highlight.toLocaleLowerCase();
    const concepts = await db.getConceptsForMaterial(material.id);
    const concept = concepts.filter(item => text.includes(item.canonicalName.toLocaleLowerCase())).sort((a, b) => b.canonicalName.length - a.canonicalName.length)[0];
    if (!concept) return { recorded: false };
    await recordMasterySignal({ userId: ctx.user.id, materialId: material.id, conceptId: concept.id, normalizedConceptKey: concept.normalizedKey, signal: input.mode === "simplify" ? "simplify" : "define" });
    return { recorded: true };
  }),

  upload: protectedProcedure
    .input(z.object({
      filename: filenameSchema,
      fileBase64: z.string().min(1),
      title: z.string().trim().min(1).max(400).optional(),
      mimeType: z.string().trim().max(160).optional(),
      materialType: z.enum(MATERIAL_TYPES).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.fileBase64, "base64");
      if (bytes.length > MAX_MATERIAL_BYTES) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Learning materials must be 40 MB or smaller." });
      }
      let parsed;
      try {
        parsed = await parseMaterial({ bytes, filename: input.filename, mimeType: input.mimeType, materialType: input.materialType });
      } catch (error) {
        const message = error instanceof MaterialParseError ? error.message : "This material could not be read.";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      const safeName = input.filename.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const stored = await storagePut(`materials/${ctx.user.id}/${safeName}`, bytes, input.mimeType || inferMimeType(parsed.fileType));
      const materialId = await db.createMaterial({
        userId: ctx.user.id,
        title: (input.title || parsed.title).slice(0, 512),
        source: parsed.source || null,
        materialType: parsed.materialType,
        fileType: parsed.fileType,
        mimeType: parsed.mimeType,
        originalFilename: input.filename,
        fileKey: stored.key,
        fileUrl: stored.url,
        unitCount: parsed.units.length,
        fileSize: bytes.length,
        processingState: "ready",
      });
      await db.insertMaterialUnits(materialId, parsed.units);
      await db.createMaterialIntelligence(materialId);
      try {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob({
          name: `material-intelligence-${materialId}`,
          cron: "0 * * * * *",
          path: "/api/scheduled/materialIntelligence",
          payload: { materialId },
          description: `Material Intelligence pipeline for material ${materialId}`,
      }, sessionToken);
        await db.updateMaterialIntelligence(materialId, { jobTaskUid: job.taskUid, pipelineStage: "chunks" });
      } catch (error) {
        // The material remains usable. A user-facing retry may be added later;
        // never claim completed understanding if scheduling is unavailable.
        console.warn("[materials.upload] could not schedule Material Intelligence:", error);
      }
      return { materialId, title: (input.title || parsed.title).slice(0, 512), unitCount: parsed.units.length, materialType: parsed.materialType, fileType: parsed.fileType };
    }),
});
