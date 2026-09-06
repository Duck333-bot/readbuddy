import type { RequestHandler } from "express";
import { trustedOrigin } from "./origin";

export const secureRequests: RequestHandler = (req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "private, no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.path.startsWith("/api/scheduled/") && req.path !== "/api/stripe/webhook") {
    if (req.get("sec-fetch-site") === "cross-site") return res.status(403).json({ error: "Please make this request from ZhiyaAI." });
    const origin = req.get("origin");
    if (origin) {
      try {
        trustedOrigin(origin);
      } catch {
        return res.status(403).json({ error: "Untrusted origin" });
      }
    }
  }
  next();
};

export function burstLimit(limit: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, { count: number; reset: number }>();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    if (++bucket.count > limit) {
      res.set("Retry-After", String(Math.ceil((bucket.reset - now) / 1000)));
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    if (buckets.size > 10_000) {
      Array.from(buckets.entries()).forEach(([id, candidate]) => {
        if (candidate.reset <= now) buckets.delete(id);
      });
    }
    next();
  };
}
