import type { SVGProps } from "react";

export const marginMarkKinds = ["memory", "context", "evidence", "spoiler", "return"] as const;
export type MarginMarkKind = (typeof marginMarkKinds)[number];

type MarginMarkProps = SVGProps<SVGSVGElement> & {
  kind: MarginMarkKind;
  title?: string;
};

/**
 * Margin Marks are ReadBuddy's branded reading-action symbols. They are used
 * only where the product is explaining, locating context, showing evidence,
 * protecting unread pages, or returning to the book. Generic UI continues to
 * use familiar utility icons.
 */
export function MarginMark({ kind, title, ...props }: MarginMarkProps) {
  const label = title ?? kind;
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} {...props}>
      {kind === "memory" && <><path {...shared} d="M6 4.5h9.5l2.5 2.5v12.5H6z" /><path {...shared} d="M15.5 4.5V7H18" /><path {...shared} d="M8.5 13.5c2-2.8 4.4-2.8 7 0" /><circle cx="8.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" /></>}
      {kind === "context" && <><path {...shared} d="M5 5.5h7.5l2 2v11H5z" /><path {...shared} d="M12.5 5.5v2h2" /><path {...shared} d="M8 16c1.7-2.8 5.2-3.4 8.5-1.8" strokeDasharray="1.5 2.5" /><circle cx="17" cy="14.2" r="1.3" fill="currentColor" stroke="none" /></>}
      {kind === "evidence" && <><path {...shared} d="M7.5 5.5H5v13h2.5" /><path {...shared} d="M12 7.5h6.5M12 12h4.5M12 16.5h6.5" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>}
      {kind === "spoiler" && <><path {...shared} d="M5.5 5.5h9.5l3 3v10H5.5z" /><path {...shared} d="M15 5.5v3h3" /><path {...shared} d="M8 15.5h7" opacity=".35" /><path {...shared} d="M8 12.5h5" opacity=".58" /><path {...shared} d="M6 19 19 6" /></>}
      {kind === "return" && <><path {...shared} d="M6.5 5.5h11v12H11" /><path {...shared} d="m10.5 10-4 3.5 4 3.5" /><path {...shared} d="M7 13.5h8" /></>}
    </svg>
  );
}
