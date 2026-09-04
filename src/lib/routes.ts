import { NOW_DESCRIPTION } from "./site";

/**
 * How one page names and describes itself.
 *
 * Read from both sides: the route calls `useDocumentMeta` with it, and the
 * build stamps it into that route's HTML file so a crawler sees the same words
 * without running the app. `./site` is spelled relatively for the reason
 * `show-summary.ts` records - Vite's config gets no `@/` alias resolution.
 */
export interface PageMeta {
  /**
   * The page's own name. The `<title>` is this and the site name, and it is
   * also the label the nav gives the same path - `tests/pages.spec.ts` holds
   * those two together.
   */
  title: string;
  /**
   * One line saying what the page is, for the tab, the search result, and the
   * link preview.
   *
   * On two routes it is also copy a visitor reads: `/now` and `/fortnite` set
   * it as the lede under their headline. Editing either of those rewrites the
   * page as well as the search result. Every other description here is invisible
   * on the page itself.
   */
  description: string;
  /**
   * The page's serial in the site's own catalogue, like "DA-005". Assigned in
   * nav order once, colophon last, and never renumbered: each is a literal
   * here rather than derived from position, so pages joining or leaving the
   * nav cannot shuffle the numbers already in print. Required, so a new page
   * cannot ship unnumbered.
   */
  catalogue: string;
}

/**
 * Every section of the site in nav order, then the colophon, which only the
 * footer links.
 *
 * The section titles are the labels `site.ts` gives the same paths,
 * deliberately: a page someone found by scanning a list of links should say
 * the word they scanned for.
 */
export const PAGE_META = {
  "/now": {
    title: "Now",
    description: NOW_DESCRIPTION,
    catalogue: "DA-001",
  },
  "/about": {
    title: "About",
    description:
      "The non-work half. Alexis, Milly and Penny, shows, records, comics, Legos, and one very specific bowling achievement.",
    catalogue: "DA-002",
  },
  "/career": {
    title: "Career",
    description:
      "A decade of writing software for telescopes: the roles, the toolkit, and the nights on a mountain that inform both.",
    catalogue: "DA-003",
  },
  "/blog": {
    title: "Blog",
    description:
      "Dan Avner's blog. Posts on scientific software and engineering, plus the personal stuff. Filter by work or personal.",
    catalogue: "DA-004",
  },
  "/shows": {
    title: "Shows",
    description:
      "A running log of every show I have been to - who played, where, and if I lost my hearing.",
    catalogue: "DA-005",
  },
  "/vinyl": {
    title: "Vinyl",
    description:
      "Every record Alexis and I own, read from Discogs nightly - what it is, when it was pressed, and whose shelf it is on.",
    catalogue: "DA-006",
  },
  "/comics": {
    title: "Comics",
    description:
      "Every run I own, what is waiting at the shop this week, and what I still want - read from League of Comic Geeks nightly.",
    catalogue: "DA-007",
  },
  "/fortnite": {
    title: "Fortnite",
    description: "Wins, kills, and how good I am. 1v1 me.",
    catalogue: "DA-008",
  },
  "/dan-fm": {
    title: "dan.fm",
    description:
      "One album a day, logged and rated: a review, a favourite track, a least favourite, and a score out of five.",
    catalogue: "DA-009",
  },
  "/colophon": {
    title: "Colophon",
    description:
      "How this site is made: the type it is set in, the inks on the plate, and the press it comes off of.",
    catalogue: "DA-010",
  },
} as const satisfies Record<string, PageMeta>;

/**
 * The line `PageHeader` prints over a page's title, like "DA-005 · SHOWS".
 * One spelling, so ten call sites cannot drift on the separator.
 */
export function catalogueLine(route: keyof typeof PAGE_META): string {
  const meta = PAGE_META[route];
  return `${meta.catalogue} · ${meta.title.toUpperCase()}`;
}

/**
 * The catalogue number standing for a path: the page's own, or its section's
 * for a content page - an item in the catalogue borrows the number of the
 * shelf holding it. Null for the home page, which is the cover, and for any
 * path the catalogue does not reach.
 */
export function catalogueFor(pathname: string): string | null {
  const meta: Record<string, PageMeta> = PAGE_META;
  const section = `/${pathname.split("/")[1] ?? ""}`;
  return (meta[pathname] ?? meta[section])?.catalogue ?? null;
}

/**
 * Every route the site serves that is not built out of content.
 *
 * The home page leads and carries no entry above: its meta is written into
 * `index.html`, which is the file GitHub Pages serves at "/" and the only page
 * the build does not generate.
 */
export const STATIC_PATHS = ["/", ...Object.keys(PAGE_META)];
