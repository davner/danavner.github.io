import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A page's own facts, set on one line: "April 20, 2026 · Hollywood Palladium ·
 * Los Angeles, CA".
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
    <p
      data-slot="facts"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-muted-foreground",
        className,
      )}
    >
      {/* The separator travels with the fact after it rather than sitting
          between them as its own item. Wrapping this line otherwise strands a
          dot at the end of a row, where it reads as a typo. */}
      {/* A fixed, ordered list of facts about one thing - the index is the
          identity, so nothing reorders behind the key. */}
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-x-3">
          {index > 0 ? (
            <span className="text-ember" aria-hidden>
              ·
            </span>
          ) : null}
          {item}
        </span>
      ))}
    </p>
  );
}
