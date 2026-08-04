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

  return (
    <ul
      data-slot="facts"
      className={cn(
        "flex flex-col gap-y-1 text-lg text-muted-foreground",
        "sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3",
        className,
      )}
    >
      {/* One fact per row on a phone. Flowing them inline wrapped wherever the
          longest venue name happened to land, and any wrap left a row opening
          with an orphan dot - two facts is enough to do it once a date and a
          country pair up. The separators only exist in the one-line layout, so
          there is nothing to strand.

          A fixed, ordered list of facts about one thing - the index is the
          identity, so nothing reorders behind the key. */}
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-x-3">
          {index > 0 ? (
            <span className="hidden text-ember sm:inline" aria-hidden>
              ·
            </span>
          ) : null}
          {item}
        </li>
      ))}
    </ul>
  );
}
