import type { NextFunction, Request, Response } from "express";

export const READBUDDY_PUBLIC_ORIGIN = "https://readbuddy-fqfwwm4a.manus.space";
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

  res.redirect(308, `${READBUDDY_PUBLIC_ORIGIN}${req.originalUrl || "/"}`);
}
