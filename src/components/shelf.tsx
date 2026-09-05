import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The tile ladder the three shelves share: two columns on a phone, three from
 * `sm`, and `max` from `lg`.
 *
 * The steps are fixed rather than fluid, and that is a decision rather than a
 * missing feature. `repeat(auto-fill, minmax(MIN, 1fr))` cannot reproduce this
 * ladder at any constant `MIN`, because the shell's gutter steps from `px-4` to
 * `sm:px-6` at 640: the container gets *narrower* across that boundary, 607px
 * to 592px, while the column count goes up. `MIN` would have to fall as the
 * viewport grows, which only a breakpoint does - so a fluid shelf either
 * changes the ladder or reintroduces the breakpoint it replaced. Both widths
 * are in `responsive.spec`'s sweep, so this is not a hypothetical.
 *
 * No seam field behind the grid, and no switch for one. A last row that is not
 * full leaves empty cells, and a grid container is as wide and tall as its rows
 * whether or not anything sits in them, so a `bg-border` showing through
 * `gap-px` paints a grey rectangle where the missing tiles would be. Every tile
 * draws its own hairline instead, with a 1px spread shadow that takes no layout
 * space and lands on the same pixel its neighbour's does. `StatBoard` is the
 * one that can afford the seam field, because its last row is always full.
 */
export function Shelf({
  max,
  className,
  children,
  ...rest
}: {
  /**
   * Columns from `lg` up. The 2 / 3 beneath it is the same on all three
   * shelves, so only the top of the ladder is worth a parameter.
   */
  max: 4 | 5;
  className?: string;
  children: ReactNode;
} & Pick<ComponentProps<"ul">, "onPointerMove">) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-px sm:grid-cols-3",
        max === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
        className,
      )}
      {...rest}
    >
      {children}
    </ul>
  );
}
