import type { Express } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

const publicLandingEvents = new Set(["landing_view", "landing_start_clicked"]);
const visitorIdPattern = /^[A-Za-z0-9_-]{12,64}$/;

export function isPublicLandingEvent(value: unknown): value is "landing_view" | "landing_start_clicked" {
  return typeof value === "string" && publicLandingEvents.has(value);
}

export function isPublicVisitorId(value: unknown): value is string {
  return typeof value === "string" && visitorIdPattern.test(value);
}

/**
 * The public landing needs only a binary session check and two privacy-safe
 * funnel events. Keeping these endpoints outside the app router prevents a
 * first-time visitor from downloading the whole authenticated client stack.
 */
export function registerPublicLandingRoutes(app: Express) {
  app.get("/api/public/session", async (req, res) => {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    res.json({ authenticated: Boolean(user) });
  });

  app.post("/api/public/landing-event", async (req, res) => {
    const { event, visitorId } = req.body ?? {};
    if (!isPublicLandingEvent(event) || !isPublicVisitorId(visitorId)) {
      res.status(400).json({ success: false });
      return;
    }

    await db.recordAnalyticsEvent({ visitorId, event });
    res.status(202).json({ success: true });
  });
}
