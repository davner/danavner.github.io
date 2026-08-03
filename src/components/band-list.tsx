import { Star } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * A bill, separated by outline stars rather than middots.
 *
 * The star is an SVG rather than a dingbat like ✯ because none of the three
 * self-hosted faces carry those glyphs — a text star would fall through to
 * whatever symbol font the visitor happens to have, and render differently on
 * every platform. It is decorative, so a comma carries the separation for
 * screen readers instead.
 */
export function BandList({ bands, className }: { bands: string[]; className?: string }) {
  return (
    <span className={className}>
      {bands.map((band, index) => (
        <Fragment key={band}>
          {index > 0 ? (
            <>
              <span className="sr-only">, </span>
              <Star
                aria-hidden
                className={cn(
                  "mx-1.5 inline-block size-2.5 shrink-0 text-ember",
                  // Nudged onto the text baseline; `align-middle` sits too high
                  // against lowercase letters at this size.
                  "translate-y-[-0.05em] align-baseline",
                )}
              />
            </>
          ) : null}
          {/* Keeps a two-word name whole; the list still wraps between bands. */}
          <span className="whitespace-nowrap">{band}</span>
        </Fragment>
      ))}
    </span>
  );
}
