const requiredProductionValues = [
  ["DATABASE_URL", "database"],
  ["BUILT_IN_FORGE_API_URL", "private storage and AI gateway URL"],
  ["BUILT_IN_FORGE_API_KEY", "private storage and AI gateway key"],
  ["GOOGLE_CLIENT_ID", "Google sign-in client"],
  ["GOOGLE_CLIENT_SECRET", "Google sign-in secret"],
  ["STRIPE_SECRET_KEY", "Stripe server key"],
  ["STRIPE_WEBHOOK_SECRET", "Stripe webhook signature secret"],
  ["STRIPE_PRO_PRICE_ID", "Stripe Pro subscription price"],
  ["APP_ORIGIN", "public application origin"],
] as const;

export function configurationIssues(env: NodeJS.ProcessEnv = process.env) {
  const issues: string[] = [];
  for (const [key, purpose] of requiredProductionValues) {
    if (!env[key]?.trim()) issues.push(`${key} (${purpose})`);
  }
  if ((env.ZHIYA_SESSION_SECRET ?? "").length < 32) {
    issues.push("ZHIYA_SESSION_SECRET (minimum 32 characters)");
  }
  if (env.APP_ORIGIN) {
    try {
      if (new URL(env.APP_ORIGIN).protocol !== "https:") issues.push("APP_ORIGIN (must use HTTPS)");
    } catch {
      issues.push("APP_ORIGIN (must be a valid URL)");
    }
  }
  if (env.EMAIL_AUTH_ENABLED === "true") {
    if (!env.RESEND_API_KEY?.trim() || !env.EMAIL_FROM?.trim()) {
      issues.push("RESEND_API_KEY and EMAIL_FROM (required when EMAIL_AUTH_ENABLED=true)");
    } else {
      const address = env.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.EMAIL_FROM;
      if (!address.includes("@") || address.toLowerCase().endsWith("@resend.dev")) {
        issues.push("EMAIL_FROM (must use a verified sender domain)");
      }
    }
  }
  return Array.from(new Set(issues));
}

export function emailAuthenticationEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.EMAIL_AUTH_ENABLED !== "true" || !env.RESEND_API_KEY?.trim() || !env.EMAIL_FROM?.trim()) return false;
  const address = env.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.EMAIL_FROM;
  return address.includes("@") && !address.toLowerCase().endsWith("@resend.dev");
}
