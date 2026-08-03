import { Fragment } from "react";

/**
 * A bill, comma-separated.
 *
 * This exists rather than a plain `bands.join(", ")` for one reason: each name
 * is kept unbreakable, so a two-word band never splits across lines while the
 * list as a whole still wraps. Change the separator here and it changes
 * everywhere a bill is rendered.
 */
export function BandList({ bands, className }: { bands: string[]; className?: string }) {
  return (
    <span className={className}>
      {bands.map((band, index) => (
        <Fragment key={band}>
          {index > 0 ? ", " : null}
          <span className="whitespace-nowrap">{band}</span>
        </Fragment>
      ))}
    </span>
  );
}
