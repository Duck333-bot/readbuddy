/** Reader Memory is book knowledge too: do not surface help learned on unread pages. */
export function memoryVisibleAtPage<T extends { pageFirstAsked: number }>(
  items: T[],
  currentPage: number,
  spoilerMode: "safe" | "full",
): T[] {
  return spoilerMode === "full" ? items : items.filter(item => item.pageFirstAsked <= currentPage);
}
