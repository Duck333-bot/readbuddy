import { z } from "zod";
import * as db from "./db";
import { llmCall, llmEmbed } from "./llm/router";
import type { InsertConcept, InsertMaterialChunk } from "../drizzle/schema";
import type { MaterialEvidence, SourceRef } from "@shared/materials";

export const MATERIAL_INTELLIGENCE_VERSION = 1;
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
  evidenceChunk: z.union([z.number(), z.string()]).transform(value => Number(value)).pipe(z.number().int().min(1)),
});

const materialAnalysisSchema = z.object({
  overview: z.string().trim().min(1).max(2500),
  learningObjectives: z.array(z.string().trim().min(1).max(400)).max(12),
  keyIdeas: z.array(z.string().trim().min(1).max(400)).max(16),
  concepts: z.array(materialConceptSchema).min(1).max(24),
});

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

export function parseMaterialAnalysis(raw: unknown) {
  return materialAnalysisSchema.parse(raw);
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
  for (const unit of units) {
    const text = unit.content.trim();
    if (!text) continue;
    if (buffer.length && buffer.join("\n\n").length + text.length > MAX_CHUNK_CHARS) flush();
    if (!startUnit) startUnit = unit.unitIndex;
    buffer.push(text);
    refs.push(unit.sourceRef as SourceRef);
  }
  flush();
  return rows;
}

function evidenceForChunk(chunk: { sourceRefs: SourceRef[]; text: string }): MaterialEvidence[] {
  const excerpt = chunk.text.replace(/\s+/g, " ").trim().slice(0, 500);
  return chunk.sourceRefs.length ? [{ source: chunk.sourceRefs[0], excerpt }] : [];
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
        content: "You are ZhiyaAI Material Intelligence. Analyze only the supplied source material. Return strict JSON with overview, learningObjectives, keyIdeas, and concepts. Every concept must be directly supported by a named evidenceChunk. Do not introduce outside knowledge, invent formulas, or claim a source position not supplied.",
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
    const evidence = evidenceForChunk(chunk);
    if (!evidence.length) continue;
    const sourceDefinition = chunk.text.replace(/\s+/g, " ").trim().slice(0, 700);
    conceptRows.push({
      materialId,
      canonicalName: concept.name,
      normalizedKey: normalizeConceptKey(concept.name),
      aliases: concept.aliases,
      // Some providers label the same field "description". If neither is
      // returned, preserve a source excerpt rather than inventing a definition.
      definition: concept.definition ?? concept.description ?? sourceDefinition,
      importance: concept.importance,
      difficulty: concept.difficulty ?? "intermediate",
      examples: concept.example ? [{ ...evidence[0], excerpt: concept.example }] : null,
      evidence,
    });
  }
  if (conceptRows.length === 0) throw new Error("Material analysis returned no source-backed concepts.");
  await db.replaceMaterialConcepts(materialId, conceptRows);

  await db.updateMaterialIntelligence(materialId, {
    pipelineStage: "embeddings",
    passCompleted: 2,
    overview: analysis.overview,
    learningObjectives: analysis.learningObjectives,
    keyIdeas: analysis.keyIdeas,
    structuredSummary: { conceptCount: conceptRows.length },
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
