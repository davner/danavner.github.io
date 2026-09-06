import { longDate } from "./dates";
import { fullShowDate, type ShowLike } from "./show-summary";

/**
 * What the home index says about one section: the newest thing in it, and how
 * much of it there is.
 *
 * Computed once at build time and served as `virtual:site-index` rather than
 * read off the collections by the page that prints it. The landing chunk is
 * eager - every page loads it - and the collections it indexes are ~80 kB of
 * payload plus two module-level constructions a bundler cannot shake out, to
 * print nine lines. The digest is a few hundred bytes.
 *
 * Node-safe under `show-summary.ts`'s rule and for its reason:
 * `vite-plugin-content.ts` fills these rows in from Node, where a `@/` alias
 * and a `virtual:` specifier both fail to resolve, so every import here is a
 * relative sibling. `tsconfig.node.json` lists this file, so an aliased import
 * fails `tsc -b` rather than the build.
 */
export interface IndexRow {
  /**
   * The newest item, already worded. Null where the collection is empty, and
   * null where a newest item is not an honest figure for the collection - see
   * `/comics` in `buildSiteIndex`.
   */
  latest: string | null;
  /**
   * The machine value for `<time datetime>`: `YYYY`, `YYYY-MM` or
   * `YYYY-MM-DD`, all three of which are legal `datetime` values.
   *
   * The rule is one-directional. A row with a date carries a `latest` and a
   * `dateLabel`; a row with a `latest` may still have no date, because a
   * Fortnite season is a period rather than something that happened on a day.
   */
  date: string | null;
  /** The printed form of `date`. Non-null exactly when `date` is. */
  dateLabel: string | null;
  /**
   * That item's page on this site. Null where it has none: a record and a
   * comic live on someone else's site, and the row must not pretend otherwise.
   * Null too where the item's page is the section's own - see `rowFor`, which
   * is what settles that one rather than each row settling it for itself.
   */
  href: string | null;
  /**
   * The shelf's size, worded and pluralised here so that no two rows can
   * disagree about a plural. Null where a total says nothing useful.
   */
  tally: string | null;
}

/** Keyed by section path, matching `ALL_SECTIONS` and `PAGE_META`. */
export type SiteIndex = Record<string, IndexRow>;

/** Every field absent: what a section with nothing logged renders. */
export const NO_ROW: IndexRow = {
  latest: null,
  date: null,
  dateLabel: null,
  href: null,
  tally: null,
};

/**
 * A section's row as the page is handed it: the row that was built for it, or
 * nothing at all, with an `href` that has somewhere of its own to go.
 *
 * A row names the newest item and links to that item's page. Where the item has
 * no page of its own the link is the section's own path - `/now` prints one
 * entry rather than listing it, so its newest entry is the page the row already
 * opens - and a second control onto the row's own destination is a tab stop
 * that arrives nowhere new. Worse on that row than on any other, because an
 * entry with no title is named by a cut of its prose, so the tab stop announces
 * itself as half a sentence.
 *
 * Applied to every row rather than written into the one that needs it, so the
 * next section whose items have no pages cannot ship the same link by writing
 * the obvious thing. What the page does with the answer already exists: a row
 * with no `href` prints its item as plain text, which is what `/vinyl` and
 * `/fortnite` have always done.
 */
export function rowFor(section: string, row: IndexRow | undefined): IndexRow {
  if (!row) return NO_ROW;
  return row.href === section ? { ...row, href: null } : row;
}

/** The two date fields, which are only ever set as a pair. */
export type DateFields = Pick<IndexRow, "date" | "dateLabel">;

const NO_DATE: DateFields = { date: null, dateLabel: null };

/**
 * A date and the words for it, or neither.
 *
 * The pair moves together deliberately: a date `longDate` cannot spell - an
 * empty one, or a timestamp - would otherwise print as a blank readout beside
 * a real item, which reads as broken rather than as nothing to say.
 */
export function dateOf(date: string): DateFields {
  const label = longDate(date);
  return label ? { date, dateLabel: label } : NO_DATE;
}

/**
 * The same pair for a show, whose date may be a bare `YYYY` or a `YYYY-MM`.
 * Both are legal `datetime` values and both are ones `longDate` returns "" for,
 * so the words come from `fullShowDate` instead.
 */
export function showDateOf(show: Pick<ShowLike, "date" | "endDate">): DateFields {
  const label = fullShowDate(show);
  return label ? { date: show.date, dateLabel: label } : NO_DATE;
}

/**
 * "1 record", "83 records", or null at zero, because "0 records" advertises an
 * empty shelf as though it were something to look at.
 */
export function tally(count: number, unit: string, plural = `${unit}s`): string | null {
  if (count < 1) return null;
  return `${count} ${count === 1 ? unit : plural}`;
}
