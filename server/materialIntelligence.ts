import { z } from "zod";
import * as db from "./db";
import { llmCall, llmEmbed } from "./llm/router";
import type { InsertConcept, InsertMaterialChunk } from "../drizzle/schema";
import type { MaterialEvidence, MaterialLessonPlan, SourceRef } from "@shared/materials";

export const MATERIAL_INTELLIGENCE_VERSION = 2;
const MAX_CHUNK_CHARS = 6000;
const MAX_CONCEPT_SOURCE_CHARS = 42000;

const materialConceptSchema = z.object({
  name: z.string().trim().min(2).max(180),
  definition: z.string().trim().min(1).max(1000).optional(),
  description: z.string().trim().min(1).max(1000).optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  importance: z.coerce.number().int().min(1).max(5).default(3),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).optional(),
  example: z.string().trim().min(1).max(800).optional(),
  evidenceChunk: z.number().int().min(1),
});

const materialLessonCheckSchema = z.object({
  conceptName: z.string().trim().min(2).max(180),
  kind: z.enum(["application", "distinction", "definition"]),
  prompt: z.string().trim().min(12).max(520),
  choices: z.array(z.string().trim().min(2).max(500)).min(2).max(4),
  answer: z.string().trim().min(2).max(500),
  explanation: z.string().trim().min(2).max(700),
  evidenceChunk: z.number().int().min(1),
});

const materialLessonPlanSchema = z.object({
  centralQuestion: z.string().trim().min(12).max(420),
  narrative: z.string().trim().min(20).max(900),
  conceptNames: z.array(z.string().trim().min(2).max(180)).min(1).max(5),
  visual: z.object({
    kind: z.enum(["comparison", "sequence"]),
    title: z.string().trim().min(3).max(180),
    caption: z.string().trim().min(3).max(500).optional(),
    conceptNames: z.array(z.string().trim().min(2).max(180)).min(2).max(4),
    evidenceChunk: z.number().int().min(1),
  }).optional(),
  checks: z.array(materialLessonCheckSchema).max(2).default([]),
  estimatedMinutes: z.coerce.number().int().min(3).max(8),
});

const materialAnalysisSchema = z.object({
  overview: z.string().trim().min(1).max(2500),
  learningObjectives: z.array(z.string().trim().min(1).max(400)).max(12),
  keyIdeas: z.array(z.string().trim().min(1).max(400)).max(16),
  concepts: z.array(materialConceptSchema).min(1).max(24),
  lessonPlan: materialLessonPlanSchema.optional(),
});

const boilerplatePattern = /\b(provided proper attribution|all rights reserved|proprietary and confidential|copyright|©\s*\d{2,4}|arxiv:\s*\d{4}|doi:\s*\S+|http[s]?:\/\/|www\.)\b/i;
const emailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const agendaPattern = /^(what will we cover|agenda|table of contents|contents)\b/i;

function normalizeConceptKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 255);
}

function jsonFromModel(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Material analysis did not return a JSON object.");
  return JSON.parse(fenced.slice(start, end + 1));
}

function sourceChunkNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.trunc(value));
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) return Math.max(1, Number.parseInt(match[0], 10));
  }
  // When a provider omits or labels the source position non-numerically, bind
  // the concept to the first supplied chunk rather than inventing an external
  // citation or failing the entire material. The later chunk lookup remains
  // the proof boundary.
  return 1;
}

export function parseMaterialAnalysis(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return materialAnalysisSchema.parse(raw);
  const input = raw as Record<string, unknown>;
  const concepts = Array.isArray(input.concepts)
    ? input.concepts.map(concept => {
      if (!concept || typeof concept !== "object" || Array.isArray(concept)) return concept;
      const row = concept as Record<string, unknown>;
      return {
        ...row,
        definition: row.definition ?? row.description ?? row.summary,
        evidenceChunk: sourceChunkNumber(row.evidenceChunk ?? row.evidence_chunk ?? row.sourceChunk ?? row.evidence),
      };
    })
    : input.concepts;
  const rawPlan = input.lessonPlan;
  const lessonPlan = rawPlan && typeof rawPlan === "object" && !Array.isArray(rawPlan)
    ? (() => {
      const plan = rawPlan as Record<string, unknown>;
      const visual = plan.visual && typeof plan.visual === "object" && !Array.isArray(plan.visual)
        ? { ...(plan.visual as Record<string, unknown>), evidenceChunk: sourceChunkNumber((plan.visual as Record<string, unknown>).evidenceChunk ?? (plan.visual as Record<string, unknown>).evidence) }
        : plan.visual;
      const checks = Array.isArray(plan.checks)
        ? plan.checks.map(check => check && typeof check === "object" && !Array.isArray(check)
          ? { ...(check as Record<string, unknown>), evidenceChunk: sourceChunkNumber((check as Record<string, unknown>).evidenceChunk ?? (check as Record<string, unknown>).evidence) }
          : check)
        : plan.checks;
      return { ...plan, visual, checks };
    })()
    : rawPlan;
  const validatedPlan = lessonPlan === undefined || lessonPlan === null
    ? undefined
    : materialLessonPlanSchema.safeParse(lessonPlan).data;
  return materialAnalysisSchema.parse({ ...input, concepts, lessonPlan: validatedPlan });
}

/**
 * Produces a learning-safe copy of a source unit. The original uploaded text is
 * kept untouched; this removes only obvious non-teaching boilerplate before it
 * is allowed into Material Intelligence concepts and lesson evidence.
 */
export function cleanLearningText(value: string) {
  const withoutInlineBoilerplate = value
    .replace(/\r/g, "")
    .replace(/^[A-Z][A-Za-z&\- ]{3,90}(?:presentation|presentations|report|lecture notes)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s*\d{4}\s*/i, "")
    .replace(/(?:what will we cover today|agenda|table of contents)\?\s*[\s\S]{0,520}?(?=(?:[A-Z][A-Za-z ]{2,70}\s(?:is|are|was|were|can|will|should|must)\b)|$)/gi, "")
    .replace(/(?:©|copyright)\s*\d{2,4}[\s\S]{0,180}?(?:all rights reserved\.?|proprietary and confidential\.?)/gi, "")
    .replace(/\bproprietary and confidential\b\.?/gi, "");
  let lines = withoutInlineBoilerplate
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line && !boilerplatePattern.test(line) && (line.match(emailPattern) ?? []).length < 2 && !/^\d{1,3}$/.test(line))
    .filter(line => !/^[-*]\s+(?:describe|explain|differentiate|compare(?:\s+and\s+contrast)?|understand|discuss|identify|define)\b/i.test(line));
  const abstractIndex = lines.findIndex(line => /^abstract\b/i.test(line));
  if (abstractIndex > 0) {
    lines = lines.slice(abstractIndex);
    lines[0] = lines[0].replace(/^abstract\s*[:.\-]?\s*/i, "");
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function isLowInformationUnit(text: string) {
  const normalized = text.trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length < 14 || agendaPattern.test(normalized) || /^.{0,80}(presentation|report|lecture notes)\s*$/i.test(normalized);
}

function cleanTeachingStatement(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = cleanLearningText(value);
  if (cleaned.length < 12 || cleaned.length > maxLength || boilerplatePattern.test(cleaned) || emailPattern.test(cleaned)) return null;
  return cleaned;
}

/** Chooses a compact source sentence related to the named concept instead of a chunk's arbitrary opening. */
export function selectEvidenceExcerpt(text: string, conceptName?: string) {
  const cleaned = cleanLearningText(text);
  const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(sentence => sentence.trim()).filter(sentence => sentence.length >= 24);
  const terms = (conceptName ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 2);
  const scored = sentences.map((sentence, index) => ({
    index,
    score: terms.reduce((total, term) => total + (sentence.toLowerCase().includes(term) ? 1 : 0), 0),
  })).sort((left, right) => right.score - left.score || left.index - right.index);
  const start = scored[0]?.score ? scored[0].index : 0;
  return sentences.slice(start, start + 2).join(" ").slice(0, 500) || cleaned.slice(0, 500);
}

export function buildMaterialChunks(units: Awaited<ReturnType<typeof db.getMaterialUnits>>): InsertMaterialChunk[] {
  const rows: InsertMaterialChunk[] = [];
  let buffer: string[] = [];
  let refs: SourceRef[] = [];
  let startUnit = 0;
  const flush = () => {
    const text = buffer.join("\n\n").trim();
    if (!text) return;
    rows.push({
      materialId: units[0]?.materialId ?? 0,
      chunkSequence: rows.length + 1,
      startUnitIndex: startUnit,
      endUnitIndex: refs[refs.length - 1]?.unitIndex ?? startUnit,
      text,
      sourceRefs: refs,
      analysisVersion: MATERIAL_INTELLIGENCE_VERSION,
    });
    buffer = [];
    refs = [];
    startUnit = 0;
  };
  const cleanedUnits = units.map(unit => ({ unit, text: cleanLearningText(unit.content) })).filter(item => item.text);
  const substantiveUnits = cleanedUnits.filter(item => !isLowInformationUnit(item.text));
  for (const { unit, text } of (substantiveUnits.length ? substantiveUnits : cleanedUnits)) {
    if (!text) continue;
    if (buffer.length && buffer.join("\n\n").length + text.length > MAX_CHUNK_CHARS) flush();
    if (!startUnit) startUnit = unit.unitIndex;
    buffer.push(text);
    refs.push(unit.sourceRef as SourceRef);
  }
  flush();
  return rows;
}

function evidenceForChunk(chunk: { sourceRefs: SourceRef[]; text: string }, conceptName?: string): MaterialEvidence[] {
  const excerpt = selectEvidenceExcerpt(chunk.text, conceptName);
  return chunk.sourceRefs.length ? [{ source: chunk.sourceRefs[0], excerpt }] : [];
}

const evidenceStopWords = new Set(["about", "after", "before", "between", "cell", "cells", "component", "components", "different", "explain", "from", "function", "functions", "including", "material", "materials", "membrane", "movement", "protein", "proteins", "substances", "that", "the", "this", "through", "transport", "using", "with"]);

function conceptEvidenceTerms(conceptName: string, definition?: string) {
  return `${conceptName} ${definition ?? ""}`.toLowerCase().match(/[a-z0-9]+/g)?.filter(term => term.length > 2 && !evidenceStopWords.has(term)) ?? [];
}

/** Prefer the exact source unit that supports a concept, not the first unit of a broad chunk. */
export function evidenceForRelevantUnit(
  units: Array<{ content: string; sourceRef: SourceRef }>,
  fallbackChunk: { sourceRefs: SourceRef[]; text: string },
  conceptName: string,
  definition?: string,
): MaterialEvidence[] {
  const normalizedName = conceptName.toLowerCase();
  const terms = conceptEvidenceTerms(conceptName, definition);
  const best = units
    .map(unit => {
      const text = cleanLearningText(unit.content);
      const lower = text.toLowerCase();
      const exact = lower.includes(normalizedName) ? 12 : 0;
      const score = exact + terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
      return { unit, text, score };
    })
    .sort((left, right) => right.score - left.score || left.unit.sourceRef.unitIndex - right.unit.sourceRef.unitIndex)[0];
  if (best && best.score >= 3 && best.text) {
    return [{ source: best.unit.sourceRef, excerpt: selectEvidenceExcerpt(best.text, conceptName) }];
  }
  return evidenceForChunk(fallbackChunk, conceptName);
}

function materialEvidenceList(value: unknown): MaterialEvidence[] {
  return Array.isArray(value) ? value as MaterialEvidence[] : [];
}

function validateLessonPlan(raw: z.infer<typeof materialLessonPlanSchema> | undefined, concepts: InsertConcept[], chunks: InsertMaterialChunk[]): MaterialLessonPlan | null {
  if (!raw) return null;
  const knownConcepts = new Map(concepts.map(concept => [normalizeConceptKey(concept.canonicalName), concept.canonicalName]));
  const knownName = (name: string) => knownConcepts.get(normalizeConceptKey(name)) ?? null;
  const conceptNames = raw.conceptNames.map(knownName).filter((name): name is string => Boolean(name));
  const centralQuestion = cleanTeachingStatement(raw.centralQuestion, 420);
  const narrative = cleanTeachingStatement(raw.narrative, 900);
  if (!centralQuestion || !narrative || !conceptNames.length) return null;
  const hasChunk = (reference: number) => chunks.some(chunk => chunk.chunkSequence === reference || (chunk.startUnitIndex <= reference && reference <= chunk.endUnitIndex));
  const visual = raw.visual && hasChunk(raw.visual.evidenceChunk)
    ? (() => {
      const names = raw.visual.conceptNames.map(knownName).filter((name): name is string => Boolean(name));
      const title = cleanTeachingStatement(raw.visual.title, 180);
      const caption = raw.visual.caption ? cleanTeachingStatement(raw.visual.caption, 500) ?? undefined : undefined;
      return names.length >= 2 && title ? { kind: raw.visual.kind, title, caption, conceptNames: names, evidenceChunk: raw.visual.evidenceChunk } : undefined;
    })()
    : undefined;
  const checks = raw.checks.flatMap(check => {
    const conceptName = knownName(check.conceptName);
    const prompt = cleanTeachingStatement(check.prompt, 520);
    const answer = cleanTeachingStatement(check.answer, 500);
    const explanation = cleanTeachingStatement(check.explanation, 700);
    const choices = check.choices.map(choice => cleanTeachingStatement(choice, 500)).filter((choice): choice is string => Boolean(choice));
    if (!conceptName || !prompt || !answer || !explanation || !hasChunk(check.evidenceChunk) || choices.length < 2 || !choices.includes(answer)) return [];
    return [{ conceptName, kind: check.kind, prompt, choices: Array.from(new Set(choices)), answer, explanation, evidenceChunk: check.evidenceChunk }];
  });
  return { centralQuestion, narrative, conceptNames: Array.from(new Set(conceptNames)).slice(0, 5), visual, checks: checks.slice(0, 2), estimatedMinutes: raw.estimatedMinutes };
}

function parseDedicatedLessonPlan(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const visualInput = input.visual && typeof input.visual === "object" && !Array.isArray(input.visual) ? input.visual as Record<string, unknown> : null;
  const visual = visualInput ? {
    ...visualInput,
    conceptNames: visualInput.conceptNames ?? visualInput.concepts,
    evidenceChunk: sourceChunkNumber(visualInput.evidenceChunk ?? visualInput.evidence),
  } : undefined;
  const checks = Array.isArray(input.checks) ? input.checks.map(check => {
    if (!check || typeof check !== "object" || Array.isArray(check)) return check;
    const row = check as Record<string, unknown>;
    return {
      ...row,
      conceptName: row.conceptName ?? row.concept ?? row.name,
      kind: row.kind ?? row.type ?? "application",
      prompt: row.prompt ?? row.question,
      answer: row.answer ?? row.correctAnswer,
      explanation: row.explanation ?? row.rationale ?? row.answer ?? row.correctAnswer,
      evidenceChunk: sourceChunkNumber(row.evidenceChunk ?? row.evidence),
    };
  }) : [];
  const planInput = {
    ...input,
    visual,
    checks,
    estimatedMinutes: input.estimatedMinutes ?? 6,
  };
  const parsed = materialLessonPlanSchema.safeParse(planInput);
  if (parsed.success) return parsed.data;
  // A planner can identify a useful central question and strong checks without
  // finding a genuine multi-concept visual. Do not discard the whole plan for
  // that optional rendering choice.
  const withoutVisual = materialLessonPlanSchema.safeParse({ ...planInput, visual: undefined });
  return withoutVisual.success ? withoutVisual.data : undefined;
}

async function createDedicatedLessonPlan(material: { title: string; materialType: string }, concepts: InsertConcept[], chunks: InsertMaterialChunk[]) {
  const conceptSource = concepts.map((concept, index) => {
    const evidence = materialEvidenceList(concept.evidence)[0];
    const evidenceChunk = chunks.find(chunk => chunk.sourceRefs.some(source => source.unitIndex === evidence?.source.unitIndex))?.chunkSequence ?? 1;
    return `${index + 1}. Name: ${concept.canonicalName}\nDefinition: ${concept.definition}\nEvidence chunk: ${evidenceChunk}\nExcerpt: ${evidence?.excerpt ?? ""}`;
  }).join("\n\n");
  const source = chunks.slice(0, 8).map(chunk => `[Chunk ${chunk.chunkSequence}; source units ${chunk.startUnitIndex}-${chunk.endUnitIndex}]\n${chunk.text.slice(0, 1800)}`).join("\n\n");
  try {
    const response = await llmCall("lesson_planning", {
      temperature: 0.1,
      max_tokens: 2200,
      messages: [
        {
          role: "system",
          content: "You are ZhiyaAI's lesson planner. Return one strict JSON object only. Build a short learning plan from the supplied cleaned source and validated concepts. The centralQuestion must teach the source's mechanism, argument, or decision—not a list of headings. Use exact concept names from the supplied list. Include visual only if the source proves a meaningful sequence or comparison. Include up to two checks only if each tests interpretation, distinction, or a source-grounded decision; do not ask learners to identify a copied definition. Each check must include concise choices and its answer exactly among choices. Use a named source evidenceChunk. If the material cannot support a visual or check, return null visual and an empty checks array. Never use author names, copyright text, slide agenda text, or outside knowledge.",
        },
        {
          role: "user",
          content: `Material title: ${material.title}\nMaterial type: ${material.materialType}\n\nValidated concepts:\n${conceptSource}\n\nClean source chunks:\n${source}\n\nReturn this exact shape:\n{"centralQuestion":"...","narrative":"...","conceptNames":["exact concept name"],"visual":null or {"kind":"comparison or sequence","title":"...","caption":"...","conceptNames":["exact concept name","exact concept name"],"evidenceChunk":1},"checks":[{"conceptName":"exact concept name","kind":"application or distinction or definition","prompt":"...","choices":["...","..."],"answer":"one exact choice","explanation":"...","evidenceChunk":1}],"estimatedMinutes":3 to 8}`,
        },
      ],
    });
    return parseDedicatedLessonPlan(jsonFromModel(response.text));
  } catch {
    return undefined;
  }
}

/** Rebuilds only the short teaching plan from existing clean concepts and chunks. */
export async function refreshMaterialLessonPlan(materialId: number) {
  const [material, concepts, chunks, intelligence] = await Promise.all([
    db.getMaterialById(materialId),
    db.getConceptsForMaterial(materialId),
    db.getMaterialChunks(materialId),
    db.getMaterialIntelligence(materialId),
  ]);
  if (!material || !concepts.length || !chunks.length) return null;
  const plan = validateLessonPlan(await createDedicatedLessonPlan(material, concepts, chunks), concepts, chunks);
  const previousSummary = intelligence?.structuredSummary && typeof intelligence.structuredSummary === "object" && !Array.isArray(intelligence.structuredSummary)
    ? intelligence.structuredSummary
    : {};
  await db.updateMaterialIntelligence(materialId, { structuredSummary: { ...previousSummary, conceptCount: concepts.length, lessonPlan: plan } });
  return plan;
}

async function analyzeMaterial(materialId: number) {
  const material = await db.getMaterialById(materialId);
  if (!material) throw new Error("Material not found.");
  const units = await db.getMaterialUnits(materialId);
  if (units.length === 0) throw new Error("Material has no normalized source units.");

  const chunks = buildMaterialChunks(units);
  if (chunks.length === 0) throw new Error("Material has no readable chunks.");
  await db.replaceMaterialChunks(materialId, chunks);
  await db.updateMaterialIntelligence(materialId, { pipelineStage: "synthesis", passCompleted: 1, pipelineError: null, pipelineRetryAfter: null });

  const source = chunks
    .slice(0, 12)
    .map(chunk => `[Chunk ${chunk.chunkSequence}; source units ${chunk.startUnitIndex}-${chunk.endUnitIndex}]\n${chunk.text}`)
    .join("\n\n")
    .slice(0, MAX_CONCEPT_SOURCE_CHARS);
  const response = await llmCall("material_analysis", {
    temperature: 0.2,
    max_tokens: 4500,
    messages: [
      {
        role: "system",
        content: "You are ZhiyaAI Material Intelligence. Analyze only the supplied cleaned source material. Return strict JSON with overview, learningObjectives, keyIdeas, concepts, and an optional lessonPlan. Every concept and lessonPlan relationship must be directly supported by a named evidenceChunk. Definitions must be short, readable explanations in your own words based only on the evidence—not copied headers, author lists, notices, or a large source excerpt. The lessonPlan must identify one centralQuestion, a short narrative, 1–5 conceptNames, an optional comparison or sequence visual only when the source proves a useful relationship, and up to two application, distinction, or definition checks. A check's choices and answer must be concise, source-supported, and the answer must appear exactly in choices. Do not introduce outside knowledge, invent formulas, or claim a source position not supplied.",
      },
      {
        role: "user",
        content: `Material title: ${material.title}\nMaterial type: ${material.materialType}\n\n${source}`,
      },
    ],
  });
  const analysis = parseMaterialAnalysis(jsonFromModel(response.text));
  const conceptRows: InsertConcept[] = [];
  for (const concept of analysis.concepts) {
    const chunk = chunks.find(item => item.chunkSequence === concept.evidenceChunk);
    if (!chunk) continue;
    const definition = cleanTeachingStatement(concept.definition ?? concept.description, 700);
    if (!definition) continue;
    const evidence = evidenceForRelevantUnit(units, chunk, concept.name, definition);
    if (!evidence.length) continue;
    const example = cleanTeachingStatement(concept.example, 800);
    conceptRows.push({
      materialId,
      canonicalName: concept.name,
      normalizedKey: normalizeConceptKey(concept.name),
      aliases: concept.aliases,
      definition,
      importance: concept.importance,
      difficulty: concept.difficulty ?? "intermediate",
      examples: example ? [{ ...evidence[0], excerpt: example }] : null,
      evidence,
    });
  }
  if (conceptRows.length === 0) throw new Error("Material analysis returned no source-backed concepts.");
  await db.replaceMaterialConcepts(materialId, conceptRows);

  const dedicatedPlan = await createDedicatedLessonPlan(material, conceptRows, chunks);
  const lessonPlan = validateLessonPlan(dedicatedPlan ?? analysis.lessonPlan, conceptRows, chunks);
  await db.updateMaterialIntelligence(materialId, {
    pipelineStage: "embeddings",
    passCompleted: 2,
    overview: analysis.overview,
    learningObjectives: analysis.learningObjectives,
    keyIdeas: analysis.keyIdeas,
    structuredSummary: { conceptCount: conceptRows.length, lessonPlan },
  });

  const persistedChunks = await db.getMaterialChunks(materialId);
  const retrievalRows = persistedChunks.map(chunk => ({
    materialId,
    startSourceRef: (chunk.sourceRefs as SourceRef[])[0],
    endSourceRef: (chunk.sourceRefs as SourceRef[])[(chunk.sourceRefs as SourceRef[]).length - 1],
    text: chunk.text,
    analysisVersion: MATERIAL_INTELLIGENCE_VERSION,
  }));
  await db.replaceMaterialRetrievalPassages(materialId, retrievalRows);
  const embeddingRows = [];
  for (const chunk of persistedChunks.slice(0, 120)) {
    // Material chunks are embedded using the existing provider abstraction. The
    // result remains a separate concern from legacy Book Brain embeddings.
    const embedding = await llmEmbed(chunk.text);
    embeddingRows.push({
      materialId,
      chunkId: chunk.id,
      embedding,
      metadata: { startUnitIndex: chunk.startUnitIndex, endUnitIndex: chunk.endUnitIndex, chunkSequence: chunk.chunkSequence },
      analysisVersion: MATERIAL_INTELLIGENCE_VERSION,
    });
  }
  await db.replaceMaterialEmbeddings(materialId, embeddingRows);
  await db.updateMaterialIntelligence(materialId, { pipelineStage: "complete", passCompleted: 3 });
  await db.updateMaterialProcessing(materialId, { processingState: "complete", processingError: null, processingRetryAfter: null });
  return { passCompleted: 3, conceptCount: conceptRows.length };
}

/** Runs one resumable Material Intelligence pass. Errors pause rather than misrepresent completion. */
export async function runMaterialIntelligencePipeline(materialId: number) {
  await db.updateMaterialProcessing(materialId, { processingState: "processing", processingError: null });
  await db.updateMaterialIntelligence(materialId, { pipelineStage: "chunks", pipelineError: null, pipelineRetryAfter: null });
  try {
    return await analyzeMaterial(materialId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Material Intelligence could not finish.";
    const retryAfter = new Date(Date.now() + 10 * 60 * 1000);
    await db.updateMaterialIntelligence(materialId, { pipelineStage: "paused", pipelineError: message, pipelineRetryAfter: retryAfter });
    await db.updateMaterialProcessing(materialId, { processingState: "paused", processingError: message, processingRetryAfter: retryAfter });
    throw error;
  }
}
