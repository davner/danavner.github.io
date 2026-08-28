import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  viewportClassName,
  viewportRef,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /*
   * Local addition. The viewport is the scrolling element, so anything that
   * needs to drive or observe the scroll - jumping to a child, watching which
   * child is in view - needs a handle on it rather than on the root.
   */
  viewportRef?: React.Ref<HTMLDivElement>;
  /*
   * Local addition to the generated component. The viewport is the element that
   * scrolls, and it is `size-full`, so a `max-h` on the root does not clamp it:
   * a percentage height against an auto-height parent resolves to the content's
   * own height and the region grows instead of scrolling. Styling it directly is
   * the way to cap a region that should shrink to fit when there is little in it
   * and scroll only once there is more.
   */
  viewportClassName?: string;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        /*
         * Local change to the generated component: the viewport is the element
         * that actually scrolls, so it has to be reachable by keyboard. Without
         * a tab stop here the content is mouse-and-touch only, which axe flags
         * as `scrollable-region-focusable` and which the a11y suite fails on.
         */
        tabIndex={0}
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow]",
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
