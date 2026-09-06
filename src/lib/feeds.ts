import { SITE_NAME, SITE_URL } from "./site";

/**
 * What a feed is served as. One string, because three places spell it: the
 * `rel="self"` link inside every feed, the autodiscovery link the feeds plugin
 * injects, and the one `vite-plugin-pages.ts` appends per section.
 */
export const ATOM_TYPE = "application/atom+xml";

/**
 * One feed the build writes.
 *
 * The manifest is the contract: `vite-plugin-feeds.ts` writes exactly these
 * files, `vite-plugin-pages.ts` advertises them, and `tests/feeds.spec.ts`
 * holds the build to the list. They are files rather than routes, so none of
 * them has a `PAGE_META` entry, a catalogue number, or a line in `ROUTES`.
 *
 * Node-safe under `show-summary.ts`'s rule and for its reason: the build reads
 * this from Vite's config context, where `@/` does not resolve, so `./site` is
 * spelled as a relative sibling.
 */
export interface Feed {
  /** The file the build writes, and the URL it is served at. Flat, at the root. */
  path: `/${string}.xml`;
  /**
   * What a reader shows in its subscribe dialog, and the whole reason the
   * section feeds exist.
   *
   * A site whose one advertised feed is titled for a single section hands a
   * follower a subscription missing most of what they came for, and nothing
   * about the title tells them so. So the feed that says "everything" carries
   * everything, and the feed that says "blog" is the one a blog follower wants.
   */
  title: string;
  /**
   * The section whose entries it carries and whose pages advertise it. Null for
   * the combined feed, which every page advertises.
   */
  section: string | null;
}

/** The feed every page autodiscovers: one subscription, the whole site. */
export const COMBINED: Feed = {
  path: "/feed.xml",
  title: `${SITE_NAME} - everything`,
  section: null,
};

/**
 * Every feed, the combined one first.
 *
 * Flat paths at the root rather than `/blog/feed.xml`. `vite-plugin-pages.ts`
 * writes a route both as `vinyl.html` and as `vinyl/index.html` only where that
 * route parents content pages, and `/vinyl` parents none - so a feed nested
 * under it would be the only thing in `dist/vinyl/`, leaving a directory with
 * no `index.html` behind it. What GitHub Pages answers there is not something
 * to find out in production.
 */
export const FEEDS: readonly Feed[] = [
  COMBINED,
  { path: "/feed-blog.xml", title: `${SITE_NAME} - blog`, section: "/blog" },
  { path: "/feed-shows.xml", title: `${SITE_NAME} - shows`, section: "/shows" },
  { path: "/feed-now.xml", title: `${SITE_NAME} - now`, section: "/now" },
  { path: "/feed-dan-fm.xml", title: `${SITE_NAME} - dan.fm`, section: "/dan-fm" },
  { path: "/feed-vinyl.xml", title: `${SITE_NAME} - vinyl`, section: "/vinyl" },
];

/** Absolute, for a subscriber that has no page to resolve a path against. */
export function feedUrl(feed: Feed): string {
  return `${SITE_URL}${feed.path}`;
}

/**
 * The section feed a page belongs to, or null for a page in no section.
 *
 * `/blog` and `/blog/welcome` both take the blog's, which is what makes a
 * content page advertise the feed it would arrive in.
 */
export function feedFor(pathname: string): Feed | null {
  return (
    FEEDS.find(
      (feed) =>
        feed.section !== null &&
        (pathname === feed.section || pathname.startsWith(`${feed.section}/`)),
    ) ?? null
  );
}
