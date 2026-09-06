import type { Express } from "express";
import { userOwnsStorageKey } from "../db";
import { storageGetSignedUrl } from "../storage";
import { storageKeyBelongsToUser } from "../storageAccess";
import { sdk } from "./sdk";

export function registerStorageProxy(app: Express) {
  app.get(["/manus-storage/*", "/api/files/*"], async (req, res) => {
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });

    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).send("Please sign in to open this file.");
    }

    const key = (req.params as Record<string, string>)[0];
    if (!key || user.isCron || !storageKeyBelongsToUser(key, user.id)) {
      return res.status(404).send("File not found.");
    }

    try {
      if (!(await userOwnsStorageKey(key, user.id))) return res.status(404).send("File not found.");
      return res.redirect(307, await storageGetSignedUrl(key));
    } catch {
      return res.status(503).send("This file could not be opened. Please try again.");
    }
  });
}
