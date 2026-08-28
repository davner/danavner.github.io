/** Every page the site serves, used by most of the suites. */
export const ROUTES = [
  "/",
  "/about",
  "/career",
  "/blog",
  "/shows",
  "/vinyl",
  "/now",
  "/comics",
  "/fortnite",
  "/blog/welcome",
  "/blog/building-this-site",
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
] as const;
