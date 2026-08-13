import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

const STATE_COOKIE = "__Host-rb_google_state";
const MAGIC_TTL_MS = 15 * 60 * 1000;
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const originFrom = (value: string) => { const url = new URL(value); if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Invalid origin"); return url.origin; };

async function ensureUser(provider: "google" | "email", providerId: string, email: string, name: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  let user = await db.getUserByProvider(provider, providerId);
  if (!user) user = await db.getUserByEmail(normalizedEmail);
  if (!user) {
    const openId = `${provider}_${hash(providerId).slice(0, 48)}`;
    await db.upsertUser({ openId, email: normalizedEmail, name, loginMethod: provider, lastSignedIn: new Date() });
    user = await db.getUserByOpenId(openId);
  }
  if (!user) throw new Error("Unable to create account");
  await db.linkIdentity(user.id, provider, providerId, normalizedEmail);
  await db.upsertUser({ openId: user.openId, email: normalizedEmail, name: name ?? user.name, loginMethod: provider, lastSignedIn: new Date() });
  return user;
}

async function issueSession(req: Request, res: Response, user: { openId: string; name: string | null }) {
  const token = await sdk.createSessionToken(user.openId, { name: user.name || "ReadBuddy reader", expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/google/start", (req, res) => {
    try {
      const origin = originFrom(String(req.query.origin || ""));
      const nonce = crypto.randomBytes(24).toString("base64url");
      res.cookie(STATE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600_000 });
      const state = Buffer.from(JSON.stringify({ nonce, origin })).toString("base64url");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
      url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
      url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "openid email profile"); url.searchParams.set("state", state); url.searchParams.set("prompt", "select_account");
      res.redirect(302, url.toString());
    } catch { res.status(400).send("Unable to start Google sign-in."); }
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const state = JSON.parse(Buffer.from(String(req.query.state || ""), "base64url").toString()) as { nonce: string; origin: string };
      const expected = parseCookie(req.headers.cookie || "")[STATE_COOKIE];
      if (!expected || expected !== state.nonce || !req.query.code) return res.status(403).send("This Google sign-in link is no longer valid. Please try again.");
      const origin = originFrom(state.origin); res.clearCookie(STATE_COOKIE, { path: "/" });
      const token = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code" }) });
      const tokenData = await token.json() as { access_token?: string }; if (!tokenData.access_token) throw new Error("Google exchange failed");
      const profile = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } })).json() as { sub?: string; email?: string; email_verified?: boolean; name?: string };
      if (!profile.sub || !profile.email || !profile.email_verified) return res.status(400).send("A verified Google email is required.");
      const user = await ensureUser("google", profile.sub, profile.email, profile.name || null); await issueSession(req, res, user); res.redirect(302, `${origin}/library`);
    } catch { res.status(500).send("Google sign-in could not be completed. Please try again."); }
  });
  app.get("/api/auth/email/verify", async (req, res) => {
    try {
      const origin = originFrom(String(req.query.origin || "")); const raw = String(req.query.token || "");
      const record = await db.consumeEmailLoginToken(hash(raw)); if (!record) return res.status(400).send("This sign-in link is expired or already used.");
      const user = await ensureUser("email", record.email, record.email, null); await issueSession(req, res, user); res.redirect(302, `${origin}/library`);
    } catch { res.status(400).send("This sign-in link is invalid."); }
  });
}

export async function sendMagicLink(email: string, origin: string) {
  const cleanOrigin = originFrom(origin); const token = crypto.randomBytes(32).toString("base64url");
  await db.createEmailLoginToken(hash(token), email, new Date(Date.now() + MAGIC_TTL_MS));
  const url = `${cleanOrigin}/api/auth/email/verify?token=${encodeURIComponent(token)}&origin=${encodeURIComponent(cleanOrigin)}`;
  const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: "Your ReadBuddy sign-in link", html: `<p>Use this one-time link to sign in to ReadBuddy:</p><p><a href="${url}">Sign in to ReadBuddy</a></p><p>This link expires in 15 minutes.</p>` }) });
  if (!sent.ok) throw new Error("Email delivery failed");
}
