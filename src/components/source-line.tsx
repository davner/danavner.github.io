import type { ReactNode } from "react";

/**
 * "16 shown · Read from League of Comic Geeks Aug 10, 2026".
 *
 * The sign-off under every page whose numbers were fetched rather than typed:
 * what you are looking at, where it came from, and when it was last read. A
 * stale figure is then visibly stale rather than quietly wrong.
 *
 * One component rather than three, because there were three and they had
 * already drifted: comics wrote the date as "August 10, 2026" and the record
 * shelf as "Aug 10, 2026", each from its own copy of a `formatFetched` that
 * differed by one word of config. Same reasoning as `CONTROL_CLASS` - the
 * measurements of a shared thing live in one place or they diverge.
 */
export function SourceLine({
  count,
  href,
  source,
  fetched,
}: {
  /** What is on screen, e.g. "16 shown". Omitted when a count says nothing. */
  count?: ReactNode;
  href: string;
  /** Where it came from, named the way that site names itself. */
  source: string;
  /** ISO date of the last successful read. */
  fetched: string;
}) {
  return (
    <p className="readout-dim mt-8">
      {count ? <>{count} · </> : null}
      <a href={href} target="_blank" rel="noopener noreferrer" className="readout-link">
        Read from {source}
      </a>{" "}
      {formatFetched(fetched)}
    </p>
  );
}

/**
 * "Aug 10, 2026". Short month, which is what the rest of the site uses - the
 * Fortnite season ranges read "Dec 1, 2024 - Feb 21, 2025" - and short enough
 * to sit at the end of a line on a phone without wrapping on its own.
 */
function formatFetched(date: string): string {
  const parsed = Date.parse(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed)) return "";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}
