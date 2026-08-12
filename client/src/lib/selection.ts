/**
 * Selection helpers for the reader, kept out of the component so they can be
 * unit-tested without mounting React.
 */

export type ReaderSelection = {
  text: string;
  x: number;
  y: number;
  /** Character range inside one rendered reader page. */
  startOffset: number | null;
  endOffset: number | null;
};

export type SelectionGeometry = {
  /** Height of the sticky reader header, in pixels. */
  headerHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * A single word — including a one-character word — is a valid reading request.
 * Silence after a real selection makes readers think touch selection failed.
 */
export const MIN_SELECTION_LENGTH = 1;
/** Hard cap so a runaway selection cannot blow up the prompt. */
export const MAX_SELECTION_LENGTH = 3500;

/**
 * `startContainer` / `endContainer` are usually text nodes, and `Node.contains`
 * needs an element, so climb to the parent element before comparing.
 */
function toElement(node: Node | null): Node | null {
  if (!node) return null;
  return node.nodeType === 3 /* Node.TEXT_NODE */ ? node.parentNode : node;
}

function closestPageBody(node: Node | null): HTMLElement | null {
  const element = toElement(node);
  return typeof HTMLElement !== "undefined" && element instanceof HTMLElement
    ? element.closest<HTMLElement>("[data-reader-page-body]")
    : null;
}

/** Count characters from the start of the rendered page body to a range boundary. */
function offsetFromPageStart(root: HTMLElement, node: Node, offset: number): number | null {
  try {
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(node, offset);
    return before.toString().length;
  } catch {
    return null;
  }
}

/** True when both ends of the range sit inside the reader's article element. */
export function rangeIsInside(range: Range, container: Node): boolean {
  const start = toElement(range.startContainer);
  const end = toElement(range.endContainer);
  if (!start || !end) return false;
  return container.contains(start) && container.contains(end);
}

/**
 * Places the pill in the right-hand margin, vertically centred on the first line
 * of the selection, so it never covers the sentence being read or the line above
 * it. Falls back inside the viewport when the margin would be off-screen.
 */
export function clampPillPosition(
  rect: { left: number; top: number; right?: number; width: number; height?: number },
  geometry: SelectionGeometry,
): { x: number; y: number } {
  const padding = 12;
  /** Width reserved for the pill itself, so it never runs off the right edge. */
  const pillWidth = 160;
  const gap = 14;
  const right = rect.right ?? rect.left + rect.width;
  const lineHeight = rect.height ?? 24;
  // Prefer the right margin; if there is no room, tuck it to the left instead.
  const preferredX = right + gap;
  const x =
    preferredX + pillWidth <= geometry.viewportWidth - padding
      ? preferredX
      : Math.max(padding, rect.left - gap - pillWidth);
  return {
    x,
    y: Math.min(
      Math.max(rect.top + lineHeight / 2, geometry.headerHeight + padding),
      Math.max(geometry.headerHeight + padding, geometry.viewportHeight - padding),
    ),
  };
}

/**
 * Turns a live DOM selection into reader state, or `null` when the selection is
 * empty, too short, collapsed to a caret, or outside the page body.
 */
export function readSelection(
  selection: Selection | null,
  container: Node | null,
  geometry: SelectionGeometry,
): ReaderSelection | null {
  if (!selection || !container) return null;
  const rawText = selection.toString();
  const text = rawText.trim();
  if (text.length < MIN_SELECTION_LENGTH) return null;
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;
  if (!rangeIsInside(range, container)) return null;
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const { x, y } = clampPillPosition(rect, geometry);
  const startBody = closestPageBody(range.startContainer);
  const endBody = closestPageBody(range.endContainer);
  let startOffset: number | null = null;
  let endOffset: number | null = null;
  if (startBody && startBody === endBody) {
    const rawStart = offsetFromPageStart(startBody, range.startContainer, range.startOffset);
    if (rawStart !== null) {
      // Persist the trimmed portion because selectedText is trimmed by the API.
      const leadingWhitespace = rawText.length - rawText.trimStart().length;
      startOffset = rawStart + leadingWhitespace;
      endOffset = startOffset + text.length;
    }
  }
  return { text: text.slice(0, MAX_SELECTION_LENGTH), x, y, startOffset, endOffset };
}
