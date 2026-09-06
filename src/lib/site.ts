/** Canonical origin, matching `public/CNAME`. Used to build shareable links. */
export const SITE_URL = "https://danavner.com";

export const SITE_NAME = "Dan Avner";

/**
 * The one clock the site reads a date on.
 *
 * Fixed rather than the machine's, so every build stamps the same date whoever
 * makes it, and Pacific rather than UTC because the author writes from Pacific:
 * UTC files an evening commit, or a data job that commits in UTC, under
 * tomorrow's date, and a footer claiming a day the reader has not reached yet
 * reads as broken.
 *
 * It is the station's day on `/dan-fm` as well. "Today's album" has to mean the
 * same album everywhere rather than whichever one the reader's own clock lands
 * on, so `stationDate` in `lib/dan-fm.ts` reads its day from here, and
 * `scripts/update-dan-fm.mjs` mirrors the zone to decide which rows are dated
 * far enough ahead to hold back. Vite's config reads it too, which is why it
 * lives beside the nav rather than inside a route.
 */
export const SITE_TIME_ZONE = "America/Los_Angeles";

/**
 * How the now page describes itself, in one place.
 *
 * It is the page's lede, its meta description, and the `blurb` the nav panel
 * and the home index both read - the one section where those two sets of words
 * are the same, because the lede already says it.
 *
 * Kept here rather than in the route because the route is lazily loaded, and
 * importing a constant out of it would pull that whole chunk into the landing
 * page's bundle to read one sentence.
 */
export const NOW_DESCRIPTION =
  "What I'm doing at the moment, updated whenever it stops being true.";

export interface Section {
  to: string;
  label: string;
  /**
   * One line saying what the section holds, for the nav panel and the home
   * index. Both read this one, so a section cannot describe itself two ways
   * depending on which list you met it in.
   *
   * Not `PAGE_META.description`, and the two are not to be unified. That one is
   * written for a tab, a search result and a link preview; this one is written
   * for a reader already on the site deciding where to go next. `/now` is the
   * single exception, where both read `NOW_DESCRIPTION` because the page's own
   * lede is already that sentence.
   *
   * Here rather than in the routes for `NOW_DESCRIPTION`'s reason: every
   * section route is lazily loaded, so importing a sentence out of one pulls
   * its whole chunk into the landing page's bundle.
   */
  blurb: string;
}

export interface SectionGroup {
  label: string;
  items: Section[];
}

/**
 * The site's sections, in nav order.
 *
 * One list because the header and the footer both render it; two lists drift,
 * and a section added to one is a section half the site cannot reach.
 *
 * The collections are grouped rather than sitting alongside About and Career,
 * because they are not the same kind of thing: Shows, Vinyl, Comics, Fortnite
 * and dan.fm are all "what I am into", and listing them flat makes a nine-item
 * bar where five of the entries answer the same question. Grouping also stops the bar growing
 * every time another shelf gets a page.
 */
export const SECTIONS: (Section | SectionGroup)[] = [
  { to: "/now", label: "Now", blurb: NOW_DESCRIPTION },
  {
    to: "/about",
    label: "About",
    blurb: "Alexis, Milly and Penny, shows, records, comics, Legos, and one bowling statistic.",
  },
  {
    to: "/career",
    label: "Career",
    blurb: "The day job, and the decade of telescope software behind it.",
  },
  {
    to: "/blog",
    label: "Blog",
    blurb: "Notes on whatever has my attention, which is usually not work.",
  },
  {
    label: "Collections",
    items: [
      {
        to: "/shows",
        label: "Shows",
        blurb: "Every gig I have been to since I started keeping track, logged and rated.",
      },
      {
        to: "/vinyl",
        label: "Vinyl",
        blurb: "Every record Alexis and I own, pulled straight from the Discogs shelf.",
      },
      {
        to: "/comics",
        label: "Comics",
        blurb: "Every run on the shelf, what is waiting at the shop, and what I still want.",
      },
      {
        to: "/fortnite",
        label: "Fortnite",
        blurb: "Wins, kills and K/D, read nightly and kept season by season.",
      },
      {
        to: "/dan-fm",
        label: "dan.fm",
        blurb: "One album a day, with a review, a favourite track, and a score out of five.",
      },
    ],
  },
];

export function isGroup(entry: Section | SectionGroup): entry is SectionGroup {
  return "items" in entry;
}

/**
 * Every page, flattened. The footer lists them all rather than reproducing the
 * grouping - a footer is an index, and hiding three pages behind a heading there
 * would only make them harder to find.
 */
export const ALL_SECTIONS: Section[] = SECTIONS.flatMap((entry) =>
  isGroup(entry) ? entry.items : [entry],
);

/**
 * The site's own link-preview card: the wordmark and a line advertising the site
 * over a faded portrait, in the site's look. Used for the home page and any page
 * without a more specific image. Generated by `scripts/make-site-card.mjs`.
 */
export const DEFAULT_SHARE_IMAGE = "/img/og-card.jpg";

/**
 * The wordless card, for an entry whose own picture would be the right preview
 * and is missing: a show with no photos, an album with no sleeve saved. A
 * portrait is the right social image for the site as a whole and the wrong one
 * for either, where a link preview showing a headshot reads as the wrong link
 * entirely. Generated by `scripts/make-share-fallback.mjs`.
 */
export const CARD_FALLBACK_IMAGE = "/img/share-card.jpg";
