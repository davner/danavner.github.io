import { STATIC_PATHS } from "../src/lib/routes";

import { albumsOnDisk } from "./dan-fm";

/**
 * One album's permalink, taken off the log on disk rather than written out.
 *
 * The oldest album, because the log grows at the newest end: picking from there
 * renames this route on every refresh of the sheet, and a run whose coverage
 * moved is a run that proves something about a different page each time. Sorted
 * by date rather than taken off an end of the file, whose order is the job's
 * contract rather than anything a reader of it is entitled to assume.
 *
 * Empty when neither the fetched log nor the fixture is on disk, and the route
 * drops out of the sweeps with it. It goes stale the one way `albumsOnDisk`
 * records: a build made with no fetched payload and no `DANFM_SEED=1` serves no
 * albums while the fixture still names one here, and `/dan-fm/<slug>` then
 * redirects to the station with every sweep passing on the wrong page.
 * `tests/dan-fm-page.spec.ts` is what refuses that build under CI, which is
 * where it would otherwise go unnoticed.
 */
const OLDEST_ALBUM = [...albumsOnDisk()].sort((a, b) => a.date.localeCompare(b.date))[0]?.slug;

/** Every page the site serves, used by most of the suites. */
export const ROUTES: readonly string[] = [
  // Straight from the manifest the build writes those pages from, so a new
  // section joins every sweep at the same moment it gets a page.
  ...STATIC_PATHS,
  "/blog/welcome",
  "/shows/bruno-mars-madrid-2026",
  /*
   * An archived now entry's permalink. A literal because `ROUTES` is a static
   * const feeding six sweep loops, so it cannot be derived - and it goes stale
   * in two ways, which fail differently and neither of them loudly:
   *
   * - The entry is deleted. `/now/<gone>` redirects to `/now` and every sweep
   *   still passes. Repoint it at an entry that exists.
   * - The entry becomes the newest one, which happens if every entry after it
   *   is removed. `/now/<current>` also redirects to `/now`, so the sweeps keep
   *   passing while quietly covering the front door instead of the permalink
   *   view. Nothing fails; the coverage just evaporates.
   *
   * So: pick a date that is filed and is not the newest.
   */
  "/now/2026-08-10",
  ...(OLDEST_ALBUM ? [`/dan-fm/${OLDEST_ALBUM}`] : []),
];
