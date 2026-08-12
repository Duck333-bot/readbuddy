const VISITOR_KEY = "readbuddy_funnel_visitor";
const AUTH_INTENT_KEY = "readbuddy_funnel_auth_intent";

/** Random local-only id for pre-auth conversion counting; it contains no personal data. */
export function getFunnelVisitorId() {
  if (typeof window === "undefined") return "server-preview";
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() ?? `rb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(VISITOR_KEY, next);
  return next;
}

export function markFunnelAuthIntent() {
  if (typeof window !== "undefined") window.sessionStorage.setItem(AUTH_INTENT_KEY, "1");
}

export function consumeFunnelAuthIntent() {
  if (typeof window === "undefined") return false;
  const value = window.sessionStorage.getItem(AUTH_INTENT_KEY) === "1";
  window.sessionStorage.removeItem(AUTH_INTENT_KEY);
  return value;
}
