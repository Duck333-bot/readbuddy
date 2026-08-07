export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function progressPercent(lastPage: number, pageCount: number): number {
  if (!pageCount || pageCount <= 0) return 0;
  return Math.min(100, Math.round((lastPage / pageCount) * 100));
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - value.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return `${n} minute${n === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return `${n} hour${n === 1 ? "" : "s"} ago`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export const MODE_LABELS: Record<string, string> = {
  explain: "Explain",
  simplify: "Simplify",
  translate: "Translate",
  define: "Define",
  ask: "Question",
};

