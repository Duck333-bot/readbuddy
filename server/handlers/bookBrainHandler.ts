/**
 * Heartbeat callback for the Book Brain background pipeline.
 * Registered at POST /api/scheduled/bookBrain in server/_core/index.ts.
 *
 * The Manus platform POSTs here on each trigger. We authenticate the request
 * as a cron caller, look up the book by the Heartbeat task UID, and run
 * whichever pipeline passes have not yet completed.
 */

import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { runBookBrainPipeline } from "../bookBrain";
import * as db from "../db";
import { eq } from "drizzle-orm";
import { bookBrain } from "../../drizzle/schema";
import { getDb } from "../db";

export async function bookBrainHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    // Look up the book by the task UID stored on the bookBrain row.
    const dbConn = await getDb();
    if (!dbConn) {
      return res.status(500).json({ error: "database unavailable" });
    }
    const rows = await dbConn
      .select({ bookId: bookBrain.bookId, passCompleted: bookBrain.passCompleted })
      .from(bookBrain)
      .where(eq(bookBrain.brainJobTaskUid, user.taskUid))
      .limit(1);

    if (!rows[0]) {
      // Orphan — the book was deleted; tell the platform to stop retrying.
      return res.json({ ok: true, skipped: "orphan" });
    }

    const { bookId, passCompleted } = rows[0];

    if (passCompleted >= 4) {
      // Already complete — nothing to do.
      return res.json({ ok: true, skipped: "already-complete" });
    }

    const result = await runBookBrainPipeline(bookId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[bookBrainHandler] error:", error);
    return res.status(500).json({
      error,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}

