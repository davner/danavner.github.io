import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** How fast the line travels, in pixels a second. Slow enough to read. */
const SPEED = 42;
/** A very short overflow should still take long enough to register as motion. */
const MIN_DURATION = 1.2;

/**
 * One line of tile text that slides to reveal its tail when there is more of it
 * than fits, and truncates when there is not.
 *
 * The alternative was what these tiles did before: cut the line off with an
 * ellipsis and put the rest in a `title`. That hides the half that varies - a
 * record's pressing is "Black With Pink & Cyan Swir…", a run is "2024 - PRESENT
 * · 6 IS…" - and a tooltip is not available on a phone at all.
 *
 * The measurement is the point. Nothing animates unless the text genuinely
 * overflows, so a tile of short lines is completely still, and the distance
 * travelled is exactly what is hidden rather than a guess.
 *
 * `title` is kept regardless. Hover is not a thing on a touchscreen, and there
 * the line still truncates the way it always did.
 */
export function ScrollingText({
  children,
  className,
  as: Tag = "p",
}: {
  children: string;
  className?: string;
  as?: "p" | "span" | "div";
}) {
  const track = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  const measure = useCallback(() => {
    const inner = track.current;
    const outer = inner?.parentElement;
    if (!inner || !outer) return;

    // A sub-pixel difference is rounding, not overflow.
    const hidden = inner.scrollWidth - outer.clientWidth;
    setShift(hidden > 1 ? hidden : 0);
  }, []);

  useEffect(() => {
    measure();

    const inner = track.current;
    const outer = inner?.parentElement;
    if (!inner || !outer) return;

    /*
     * Both ends are watched. The tile changes width when the grid reflows, and
     * the line itself changes width when the font finally loads - measuring
     * once on mount would read the fallback face and be wrong by the time
     * anyone saw it.
     */
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [measure, children]);

  const overflows = shift > 0;

  return (
    <Tag
      className={cn("scroll-on-hover", className)}
      data-overflow={overflows}
      title={children}
      style={
        overflows
          ? ({
              "--scroll-shift": `${shift}px`,
              "--scroll-duration": `${Math.max(MIN_DURATION, shift / SPEED).toFixed(2)}s`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <span ref={track}>{children}</span>
    </Tag>
  );
}
