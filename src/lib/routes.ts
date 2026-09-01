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
}

/**
 * Every section of the site, in nav order.
 *
 * The titles are the labels `site.ts` gives the same paths, deliberately: a page
 * someone found by scanning a list of links should say the word they scanned
 * for.
 */
export const PAGE_META = {
  "/now": {
    title: "Now",
    description: NOW_DESCRIPTION,
  },
  "/about": {
    title: "About",
    description:
      "The non-work half. Alexis, Milly and Penny, shows, records, comics, Legos, and one very specific bowling achievement.",
  },
  "/career": {
    title: "Career",
    description:
      "A decade of writing software for telescopes: the roles, the toolkit, and the nights on a mountain that inform both.",
  },
  "/blog": {
    title: "Blog",
    description:
      "Dan Avner's blog. Posts on scientific software and engineering, plus the personal stuff. Filter by work or personal.",
  },
  "/shows": {
    title: "Shows",
    description:
      "A running log of every show I have been to - who played, where, and if I lost my hearing.",
  },
  "/vinyl": {
    title: "Vinyl",
    description:
      "Every record Alexis and I own, read from Discogs nightly - what it is, when it was pressed, and whose shelf it is on.",
  },
  "/comics": {
    title: "Comics",
    description:
      "Every run I own, what is waiting at the shop this week, and what I still want - read from League of Comic Geeks nightly.",
  },
  "/fortnite": {
    title: "Fortnite",
    description: "Wins, kills, and how good I am. 1v1 me.",
  },
  "/dan-fm": {
    title: "dan.fm",
    description:
      "One album a day, logged and rated: a review, a favourite track, a least favourite, and a score out of five.",
  },
} as const satisfies Record<string, PageMeta>;

/**
 * Every route the site serves that is not built out of content.
 *
 * The home page leads and carries no entry above: its meta is written into
 * `index.html`, which is the file GitHub Pages serves at "/" and the only page
 * the build does not generate.
 */
export const STATIC_PATHS = ["/", ...Object.keys(PAGE_META)];
