export const PLANS = {
  free: {
    name: "Free",
    uploads: 2,
    aiCalls: 40,
    sourceCharacters: 2_000_000,
  },
  pro: {
    name: "Pro",
    uploads: 50,
    aiCalls: 2_000,
    sourceCharacters: 50_000_000,
  },
} as const;

export type PlanName = keyof typeof PLANS;
export type UsageKind = "uploads" | "aiCalls";
export const USAGE_LIMIT_MESSAGE = "You’ve reached this month’s plan allowance. Open Plans to review your usage or upgrade. Your books, materials, and notes remain available.";
