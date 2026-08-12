import { describe, expect, it } from "vitest";
import {
  clampPillPosition,
  MAX_SELECTION_LENGTH,
  rangeIsInside,
  readSelection,
} from "./selection";

const geometry = { headerHeight: 56, viewportWidth: 1280, viewportHeight: 800 };

/** Builds a fake Range/Selection pair without needing a real DOM. */
function fakeSelection(options: {
  text: string;
  start: Node;
  end: Node;
  collapsed?: boolean;
  rect?: { left: number; top: number; width: number; height: number };
  rangeCount?: number;
}) {
  const range = {
    startContainer: options.start,
    endContainer: options.end,
    collapsed: options.collapsed ?? false,
    getBoundingClientRect: () =>
      options.rect ?? { left: 400, top: 300, width: 200, height: 22 },
  } as unknown as Range;

  return {
    toString: () => options.text,
    rangeCount: options.rangeCount ?? 1,
    getRangeAt: () => range,
  } as unknown as Selection;
}

/** Minimal stand-in for the reader's article element. */
function fakeContainer(children: Node[]): Node {
  return {
    contains: (node: Node | null) => (node ? children.includes(node) : false),
  } as unknown as Node;
}

const paragraph = { nodeType: 1 } as unknown as Node;
const textNode = { nodeType: 3, parentNode: paragraph } as unknown as Node;
const outsideNode = { nodeType: 1 } as unknown as Node;
const container = fakeContainer([paragraph]);

describe("rangeIsInside", () => {
  it("resolves text nodes to their parent element", () => {
    const range = {
      startContainer: textNode,
      endContainer: textNode,
    } as unknown as Range;
    expect(rangeIsInside(range, container)).toBe(true);
  });

  it("rejects a range that ends outside the container", () => {
    const range = {
      startContainer: textNode,
      endContainer: outsideNode,
    } as unknown as Range;
    expect(rangeIsInside(range, container)).toBe(false);
  });
});

describe("clampPillPosition", () => {
  it("keeps the pill clear of the sticky header", () => {
    const { y } = clampPillPosition({ left: 100, top: 0, width: 50, height: 24 }, geometry);
    expect(y).toBe(68);
  });

  it("centres the pill on the first line of the selection", () => {
    expect(
      clampPillPosition({ left: 400, top: 300, width: 200, height: 24 }, geometry).y,
    ).toBe(312);
  });

  it("places the pill in the right margin beside the selection", () => {
    expect(
      clampPillPosition({ left: 400, top: 300, width: 200, height: 24 }, geometry).x,
    ).toBe(614);
  });

  it("flips to the left margin when there is no room on the right", () => {
    const { x } = clampPillPosition(
      { left: 1150, top: 300, width: 120, height: 24 },
      geometry,
    );
    expect(x).toBe(976);
  });

  it("never positions the pill off the left edge", () => {
    const { x } = clampPillPosition(
      { left: 4, top: 300, width: 1270, height: 24 },
      geometry,
    );
    expect(x).toBeGreaterThanOrEqual(12);
  });
});

describe("readSelection", () => {
  it("returns positioned state for a valid selection", () => {
    const result = readSelection(
      fakeSelection({ text: "the division of labour", start: textNode, end: textNode }),
      container,
      geometry,
    );
    expect(result).toEqual({ text: "the division of labour", x: 614, y: 311, startOffset: null, endOffset: null });
  });

  it("ignores a collapsed caret (a plain click)", () => {
    const result = readSelection(
      fakeSelection({
        text: "",
        start: textNode,
        end: textNode,
        collapsed: true,
      }),
      container,
      geometry,
    );
    expect(result).toBeNull();
  });

  it("keeps a one-character word actionable instead of failing silently", () => {
    const result = readSelection(
      fakeSelection({ text: "a", start: textNode, end: textNode }),
      container,
      geometry,
    );
    expect(result?.text).toBe("a");
  });

  it("ignores selections outside the page body", () => {
    const result = readSelection(
      fakeSelection({ text: "site header text", start: outsideNode, end: outsideNode }),
      container,
      geometry,
    );
    expect(result).toBeNull();
  });

  it("ignores a zero-size rect (invisible selection)", () => {
    const result = readSelection(
      fakeSelection({
        text: "hidden text",
        start: textNode,
        end: textNode,
        rect: { left: 0, top: 0, width: 0, height: 0 },
      }),
      container,
      geometry,
    );
    expect(result).toBeNull();
  });

  it("truncates a runaway selection", () => {
    const result = readSelection(
      fakeSelection({ text: "x".repeat(9000), start: textNode, end: textNode }),
      container,
      geometry,
    );
    expect(result?.text.length).toBe(MAX_SELECTION_LENGTH);
  });

  it("returns null when there is no selection or container", () => {
    expect(readSelection(null, container, geometry)).toBeNull();
    expect(
      readSelection(
        fakeSelection({ text: "abc", start: textNode, end: textNode }),
        null,
        geometry,
      ),
    ).toBeNull();
  });
});
