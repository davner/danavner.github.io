/**
 * Spelled-out dates, for the two modules the Node build reaches.
 *
 * No imports at all, and that is the point rather than an accident: the build
 * calls this while writing per-entry HTML, where a `@/` alias or a `virtual:`
 * specifier does not resolve. `show-summary.ts` and `now-summary.ts` both
 * import it as a relative sibling, which works in Node and in the browser
 * alike.
 *
 * This is not a general date-formatting layer and does not claim to be one.
 * There are five `toLocaleDateString` call sites elsewhere in `src/` that use
 * `Intl` and have no month table; consolidating those is a real change, and
 * naming this module as "the one place" while leaving them alone would be a
 * name that lies.
 */

/** The one month table. `show-summary.ts` imports these rather than keeping its own. */
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "August 27, 2026" from a `YYYY-MM-DD` date.
 *
 * Returns "" for an empty or malformed one, where `formatDate` in `lib/blog.ts`
 * renders the string "Invalid Date". That divergence is deliberate: this one is
 * reachable from the Node build, where "Invalid Date" would be baked into a
 * shipped HTML file and served as a page title rather than merely looking wrong
 * on screen until the next render.
 */
export function longDate(date: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return "";

  const [, year, month, day] = parts;
  const name = MONTHS[Number(month) - 1];
  if (!name) return "";

  return `${name} ${Number(day)}, ${year}`;
}
