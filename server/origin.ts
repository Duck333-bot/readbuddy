import crypto from "node:crypto";

function configuredOrigins() {
  return [process.env.APP_ORIGIN, ...(process.env.ADDITIONAL_APP_ORIGINS ?? "").split(",")]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export function publicOrigin() {
  const configured = process.env.APP_ORIGIN?.trim();
  return configured ? new URL(configured).origin : "https://readbuddy-fqfwwm4a.manus.space";
}

export function trustedOrigin(value: string): string {
  const url = new URL(value);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Invalid origin");
  }
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Invalid origin");
  }

  const allowed = configuredOrigins();
  if (process.env.NODE_ENV === "production") {
    if (allowed.length === 0 || !allowed.includes(url.origin)) throw new Error("Untrusted origin");
  }
  return url.origin;
}

export function secretsEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
