const PRIVATE_PREFIXES = ["books", "covers", "materials", "material-covers"] as const;

export function storageKeyBelongsToUser(key: string, userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;
  if (key.length > 512 || key.startsWith("/") || key.includes("..") || key.includes("\\") || /[\x00-\x1f\x7f]/.test(key)) return false;
  return PRIVATE_PREFIXES.some(prefix => new RegExp(`^${prefix}/${userId}/[^/]+$`).test(key));
}
