import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The frame a collection states its own shape in: a two-up ladder that opens to
 * four, with the hairlines between tiles drawn by `gap-px` over a `bg-border`
 * field rather than by borders on the tiles themselves.
 *
 * A plain `div` rather than the `dl` its contents suggest, because the board
 * holds more than figures - `/shows` and `/vinyl` each drop a ranked list into
 * it, and a `<p>` beside an `<ol>` is content that `dl` does not permit and
 * that axe's `definition-list` rule fails. Each `Stat` carries its own one-pair
 * list instead, so the grouping lives in the grid and not in the markup.
 *
 * The seam field sits behind the grid rather than on each tile, which is the
 * opposite of what `Shelf` does, and it holds only while the rows come out
 * full: an empty cell in a `bg-border` grid paints as a solid grey block. All
 * three boards do fill today - four figures, or four plus two double-width
 * lists - but every one of those is conditional on the data behind it, so a
 * board that comes to hold a count the row does not divide wants `Shelf`'s
 * per-tile hairline instead of this.
 */
export function StatBoard({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * One figure on the board: a term and the number under it.
 *
 * `data-slot="stat"` is load-bearing rather than decorative. `responsive.spec`
 * sweeps `[data-slot=stat] dd` at eleven widths for a figure spilling its own
 * tile, which is a fault no horizontal-overflow check can see, so a tile that
 * does not carry the attribute is a tile nothing measures. It is set here and
 * not by the caller for that reason.
 */
export function Stat({
  label,
  value,
  wrap = "balance",
}: {
  label: ReactNode;
  value: ReactNode;
  /**
   * How the figure sets when it wraps. A count never wraps and reads best
   * balanced; a figure that is a name rather than a number wants `pretty`, so
   * it does not leave one word alone on the last line.
   */
  wrap?: "balance" | "pretty";
}) {
  return (
    <dl data-slot="stat" className="bg-background p-5 sm:p-6">
      <dt className="readout-dim">{label}</dt>
      <dd
        className={cn(
          "display mt-2 text-heading",
          wrap === "pretty" ? "text-pretty" : "text-balance",
        )}
      >
        {value}
      </dd>
    </dl>
  );
}
