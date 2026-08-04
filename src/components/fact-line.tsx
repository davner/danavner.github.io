import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A page's own facts: "April 20, 2026 · Hollywood Palladium · Los Angeles, CA"
 * on one line where there is room, one fact per row on a phone where there is
 * not.
 *
 * Detail pages used to carry these on a small rail above the title. The rail is
 * gone, so anything a page states nowhere else is set here at reading size
 * instead.
 */
export function FactLine({
  items,
  className,
}: {
  /** Nodes rather than strings so a date can stay a `<time>` element. */
  items: ReactNode[];
  className?: string;
}) {
  if (items.length === 0) return null;

  // Three facts do not fit a phone line, and flowing them wrapped into ragged
  // rows breaking wherever the longest venue name landed. Two short ones fit,
  // so stacking a post's date and reading time would only add a row.
  const stacked = items.length > 2;

  return (
    <ul
      data-slot="facts"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-muted-foreground",
        stacked && "max-sm:flex-col max-sm:items-start",
        className,
      )}
    >
      {/* The separator only exists in the one-line layout, so a stacked row
          never opens with an orphan dot.

          A fixed, ordered list of facts about one thing - the index is the
          identity, so nothing reorders behind the key. */}
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-x-3">
          {index > 0 ? (
            <span className={cn("text-ember", stacked && "max-sm:hidden")} aria-hidden>
              ·
            </span>
          ) : null}
          {item}
        </li>
      ))}
    </ul>
  );
}
