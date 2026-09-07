import type { NextFunction, Request, Response } from "express";
import { publicOrigin } from "./origin";

const LEGACY_HOSTS = new Set(["sleepline.icu", "www.sleepline.icu"]);

export function isLegacyReadBuddyHost(host: string | undefined) {
  return LEGACY_HOSTS.has((host ?? "").toLowerCase().split(":")[0]);
}

/** Keep the prior product domain out of reader-facing and search-facing identity. */
export function redirectLegacyReadBuddyHost(req: Request, res: Response, next: NextFunction) {
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || req.get("host");

  if (!isLegacyReadBuddyHost(requestHost)) {
    next();
    return;
  }

  res.redirect(308, `${publicOrigin()}${req.originalUrl || "/"}`);
}
