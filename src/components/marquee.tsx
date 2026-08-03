import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * Scrolling ticker. The track holds two identical copies of the items and
 * translates by exactly -50%, so the loop is seamless. Decorative, so the whole
 * thing is hidden from assistive tech and pauses on hover.
 */
export function Marquee({
  items,
  className,
  duration = "42s",
  separator = "✦",
}: {
  items: string[];
  className?: string;
  duration?: string;
  separator?: string;
}) {
  const copy = (key: string) => (
    <div key={key} className="flex shrink-0 items-center">
      {items.map((item, index) => (
        <Fragment key={`${key}-${index}`}>
          <span className="px-5 whitespace-nowrap">{item}</span>
          <span className="text-ember">{separator}</span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div
      aria-hidden
      className={cn(
        "marquee-host relative flex overflow-hidden border-y border-border py-2.5 select-none",
        className,
      )}
    >
      <div className="marquee-track readout" style={{ "--marquee-duration": duration } as never}>
        {copy("a")}
        {copy("b")}
      </div>
    </div>
  );
}
