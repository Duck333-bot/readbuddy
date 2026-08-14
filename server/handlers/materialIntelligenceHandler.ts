import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { materialIntelligence } from "../../drizzle/schema";
import { runMaterialIntelligencePipeline } from "../materialIntelligence";
import { recordOperationTelemetry } from "../telemetry";

/** Authenticated Heartbeat callback for non-blocking Material Intelligence. */
export async function materialIntelligenceHandler(req: Request, res: Response) {
  const startedAt = Date.now();
  let materialId: number | null = null;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only endpoint" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database unavailable" });
    const row = (await db.select({ materialId: materialIntelligence.materialId, pipelineStage: materialIntelligence.pipelineStage })
      .from(materialIntelligence).where(eq(materialIntelligence.jobTaskUid, user.taskUid)).limit(1))[0];
    if (!row) return res.json({ ok: true, skipped: "orphan" });
    materialId = row.materialId;
    if (row.pipelineStage === "complete") return res.json({ ok: true, skipped: "already-complete" });
    const result = await runMaterialIntelligencePipeline(materialId);
    void recordOperationTelemetry({ operation: "material_intelligence_pipeline", startedAt, success: true, extra: { materialId, ...result } });
    return res.json({ ok: true, ...result });
  } catch (error) {
    void recordOperationTelemetry({ operation: "material_intelligence_pipeline", startedAt, success: false, error, extra: { materialId } });
    return res.status(500).json({ error: error instanceof Error ? error.message : "material intelligence failed" });
  }
}
