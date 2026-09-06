import type { Plugin } from "vite";

import { albumSummary, albumTitle, albumUrl } from "./src/lib/dan-fm-summary";
import { ATOM_TYPE, COMBINED, FEEDS, type Feed, feedUrl } from "./src/lib/feeds";
import { nowSummary, nowTitle } from "./src/lib/now-summary";
import { showHeading, showSummary } from "./src/lib/show-summary";
import { SITE_NAME, SITE_TIME_ZONE, SITE_URL } from "./src/lib/site";
import {
  readDanFm,
  readNow,
  readPosts,
  readShows,
  readVinyl,
  seedsDanFm,
  type SeedRule,
} from "./vite-plugin-content";

/**
 * A day as the content files one: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. The two
 * partial forms are a show's - `parseShow` permits both.
 */
const DAY = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

/**
 * The time of day a stamp reads at, in the site's own zone.
 *
 * Atom wants an instant and the content stores a day, so one has to be
 * invented. Nine in the morning is a house convention like the imprint's epoch
 * stamp rather than a claim about when anything was written, and it sits far
 * enough from midnight that no reader in any zone files an entry under the
 * wrong day.
 */
const STAMP_HOUR = "09:00:00";

/** Reads the site zone's offset from UTC at a given instant. */
const OFFSET = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  timeZoneName: "longOffset",
});

/** That offset in minutes east of UTC, so Pacific winter is -480. */
function offsetAt(instant: Date): number {
  const name = OFFSET.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value;
  const parts = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? "");

  // `longOffset` prints a bare "GMT" for a zone sitting on the meridian, which
  // this one never does. Anything else here is a zone name that changed shape
  // under us, and guessing an offset would put every date in the feed an
  // unknown number of hours out.
  if (!parts) {
    throw new Error(`feeds: ${SITE_TIME_ZONE}'s offset came back as "${name}", which is not one`);
  }

  const minutes = Number(parts[2]) * 60 + Number(parts[3]);
  return parts[1] === "-" ? -minutes : minutes;
}

/** `-480` -> `-08:00`. */
function offsetLabel(minutes: number): string {
  const pad = (value: number) => String(Math.floor(value)).padStart(2, "0");
  const size = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${pad(size / 60)}:${pad(size % 60)}`;
}

/**
 * A stored day as the RFC-3339 instant Atom's `<updated>` asks for: the day
 * itself, `STAMP_HOUR`, and the site zone's offset on that day.
 *
 * A partial show date pads to the start of the period it names. A feed has
 * nowhere to put a precision of "some time in 2026", and the alternative -
 * dropping those shows - loses entries over a date the log is allowed to write.
 *
 * The offset is resolved per date rather than written down, because half the
 * year is not -08:00 and a feed whose every winter date is an hour out is a bug
 * nobody notices for six months. Two reads of the zone: the wall time read as
 * UTC lands within a day of the real instant, and the offset in force there is
 * the one 09:00 local falls under - a transition happens at 02:00 local, seven
 * hours before the stamp, so it cannot fall between the two reads.
 *
 * Exported because a wrong offset is the one failure here that looks right:
 * `tests/feeds.spec.ts` pins a date on each side of a boundary.
 */
export function stamp(date: string): string {
  const parts = DAY.exec(date);
  if (!parts) throw new Error(`feeds: "${date}" is not a date an entry can be stamped with`);

  const [, year, month = "01", day = "01"] = parts;
  const whole = `${year}-${month}-${day}`;
  const wall = new Date(`${whole}T${STAMP_HOUR}Z`);

  /*
   * Round-tripped rather than range-checked, which gets leap years right for
   * free - the same reason `asLogDate` in the content plugin round-trips. Only
   * the album log validates its dates that far; a show or a now entry dated
   * February 30 passes its own shape check and would reach a reader here as a
   * timestamp no calendar has, which is grounds to reject the whole document.
   */
  if (Number.isNaN(wall.getTime()) || wall.toISOString().slice(0, 10) !== whole) {
    throw new Error(`feeds: "${date}" names a day no calendar has`);
  }

  return `${whole}T${STAMP_HOUR}${offsetLabel(offsetAt(new Date(wall.getTime() - offsetAt(wall) * 60_000)))}`;
}

/**
 * Every control character but the three XML keeps.
 *
 * Tab, newline and carriage return are the only ones XML 1.0 has a spelling
 * for. Not hypothetical either: this text arrives from a published Google Sheet
 * and from Discogs, and one stray control byte does not make one entry wrong -
 * it makes the document unparseable, so every subscriber loses the feed at once.
 */
const FORBIDDEN = /(?![\t\n\r])\p{Cc}/gu;

/**
 * One value as an XML text node.
 *
 * Not `escapeAttribute` from `vite-plugin-pages.ts`: that one is shared with
 * the HTML `render()` writes, so widening it to strip controls would change
 * every generated page's meta tags. A quote is left alone, because a text node
 * has no quoting to break - `escapeXmlAttribute` is for the values that do.
 *
 * Exported for the reason `stamp` is: the repo's own content carries none of
 * these characters today, so nothing about the built feeds would notice this
 * going wrong.
 */
export function escapeXml(value: string): string {
  return value
    .replace(FORBIDDEN, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The same value inside double quotes, where a `"` would end the attribute. */
function escapeXmlAttribute(value: string): string {
  return escapeXml(value).replace(/"/g, "&quot;");
}

/** A site path as a subscriber reads it, with no page to resolve it against. */
function absolute(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * The authority half of a `tag:` URI, frozen at the year it was minted.
 *
 * A tag URI is an identity rather than an address, and its date names a time
 * the domain was held, not when the entry appeared. Moving it would re-issue
 * every id and land the whole shelf in every subscriber's reader as new.
 */
const TAG_AUTHORITY = `${new URL(SITE_URL).host},2026`;

/** One item in a feed, before it is written out. */
interface Entry {
  /**
   * Its identity, stable for as long as it exists: the absolute URL of its own
   * page where it has one, and a `tag:` URI where it has none.
   */
  id: string;
  title: string;
  /** Empty where the collection has nothing to add to the title. */
  summary: string;
  /** The day it is filed under, at whatever precision the content stores. */
  date: string;
  /** Where a reader opens it, site-relative. */
  path: string;
}

/**
 * Newest first, and deterministic with it: two entries filed on the same day
 * order by their id, so two builds of the same content write the same bytes
 * rather than whatever order a directory happened to be read in.
 */
function newestFirst(a: Entry, b: Entry): number {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}

/**
 * Every entry each section feed carries, keyed by the section it belongs to.
 *
 * Read through the same readers the pages plugin writes HTML from, so a feed
 * cannot describe an entry differently from the page it points at - and through
 * the same `seedDanFm` the content plugin bundles by, or a seeded build would
 * publish a feed for a log the site does not serve.
 */
function collect(root: string, publicDir: string, seed: SeedRule): Map<string, Entry[]> {
  const sections = new Map<string, Entry[]>();

  /*
   * Drafts are the caller's to drop - `readPosts` says so - and a feed is the
   * caller with the least room to forget: an unfinished post reaches every
   * subscriber at once, and it cannot be unsent by publishing it later.
   */
  sections.set(
    "/blog",
    readPosts(root, publicDir)
      .filter((post) => !post.draft)
      .map((post) => {
        const path = `/blog/${post.slug}`;
        return {
          id: absolute(path),
          title: post.title,
          summary: post.summary,
          date: post.date,
          path,
        };
      }),
  );

  sections.set(
    "/shows",
    readShows(root, publicDir).map((show) => {
      const path = `/shows/${show.slug}`;
      return {
        id: absolute(path),
        title: showHeading(show),
        summary: showSummary(show),
        date: show.date,
        path,
      };
    }),
  );

  /*
   * The current entry and the archive alike, with the two halves of an entry's
   * address doing different jobs.
   *
   * The permalink is the identity even while the entry is current, because that
   * is the address it keeps the day the next one lands - an id that moved with
   * it would arrive in every reader as a second copy of what they have already
   * read. The link is `/now` for as long as it is current, because
   * `/now/<its date>` redirects there, which is the rule the sitemap follows.
   *
   * An empty log comes back as an entry with an empty date rather than as no
   * entry at all, and that one is nothing to publish.
   */
  const { current, archive } = readNow(root, publicDir);
  sections.set(
    "/now",
    [current, ...archive]
      .filter((entry) => entry.updated)
      .map((entry) => ({
        id: absolute(`/now/${entry.updated}`),
        title: nowTitle(entry),
        summary: nowSummary(entry),
        date: entry.updated,
        path: entry === current ? "/now" : `/now/${entry.updated}`,
      })),
  );

  sections.set(
    "/dan-fm",
    readDanFm(root, publicDir, seed).albums.map((album) => ({
      id: absolute(albumUrl(album)),
      title: albumTitle(album),
      summary: albumSummary(album),
      date: album.date,
      path: albumUrl(album),
    })),
  );

  /*
   * A record has no page of its own here, so it takes a `tag:` id and links to
   * the shelf it sits on. Discogs would be the other candidate for the link and
   * is not one: a feed of this site sending every click to someone else's is
   * not a feed of this site.
   *
   * The date is filtered rather than trusted. `readVinyl` validates the artist,
   * the title and the cover but not `added`, and a fetch that half-succeeded
   * would otherwise stop the whole build over one record's missing day. Every
   * other collection's date is validated where it is parsed.
   */
  sections.set(
    "/vinyl",
    readVinyl(root, publicDir)
      .records.filter((record) => DAY.test(record.added))
      .map((record) => ({
        id: `tag:${TAG_AUTHORITY}:vinyl/${record.instanceId}`,
        title: `${record.artist} - ${record.title}`,
        // The spine the tile prints under the sleeve, with the colour of the
        // wax folded in where the pressing has one.
        summary: [
          record.year ? String(record.year) : "",
          record.format,
          record.variant,
          record.label,
        ]
          .filter(Boolean)
          .join(" · "),
        date: record.added,
        path: "/vinyl",
      })),
  );

  for (const entries of sections.values()) entries.sort(newestFirst);

  return sections;
}

/** One entry: Atom's four required elements, plus what it is about. */
function entryXml(entry: Entry): string[] {
  const lines = [
    "  <entry>",
    `    <title type="text">${escapeXml(entry.title)}</title>`,
    `    <id>${escapeXml(entry.id)}</id>`,
    `    <link rel="alternate" type="text/html" href="${escapeXmlAttribute(absolute(entry.path))}" />`,
    `    <updated>${stamp(entry.date)}</updated>`,
  ];

  /*
   * A text node, never CDATA. A `type="text"` summary carries no markup to
   * protect, which is the only thing CDATA is for, and a CDATA section cannot
   * contain `]]>` - a landmine in prose arriving from a sheet nobody on this
   * side of it controls.
   *
   * And a summary rather than `<content>`: full content would mean a third
   * markdown pipeline rendering HTML that differs from the one `blog-post.tsx`
   * ships, and `now-summary.ts` already documents a parity contract between the
   * two that exist.
   */
  if (entry.summary) {
    lines.push(`    <summary type="text">${escapeXml(entry.summary)}</summary>`);
  }

  lines.push("  </entry>");
  return lines;
}

/**
 * One whole feed document.
 *
 * `fallbackDay` is only ever reached by a feed with nothing in it, which is the
 * state of a checkout the fetch jobs have never run against. Every other build
 * takes its `<updated>` from the newest entry, so a build that changed nothing
 * writes the same bytes.
 */
function atom(feed: Feed, entries: Entry[], fallbackDay: string): string {
  const self = feedUrl(feed);

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title type="text">${escapeXml(feed.title)}</title>`,
    `  <id>${escapeXml(self)}</id>`,
    `  <link rel="self" type="${ATOM_TYPE}" href="${escapeXmlAttribute(self)}" />`,
    // What the feed is a feed of: its own section, or the site itself.
    `  <link rel="alternate" type="text/html" href="${escapeXmlAttribute(absolute(feed.section ?? "/"))}" />`,
    `  <updated>${stamp(entries[0]?.date ?? fallbackDay)}</updated>`,
    "  <author>",
    `    <name>${escapeXml(SITE_NAME)}</name>`,
    `    <uri>${escapeXml(SITE_URL)}</uri>`,
    "  </author>",
    ...entries.flatMap(entryXml),
    "</feed>",
    "",
  ].join("\n");
}

/** Today where the site keeps its clock, for a feed with nothing in it yet. */
function buildDay(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SITE_TIME_ZONE,
  }).formatToParts(new Date());
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return `${field("year")}-${field("month")}-${field("day")}`;
}

/**
 * Writes the site's Atom feeds - one per collection, plus the combined feed
 * that carries all of them.
 *
 * The site had none, and a reader who follows what someone is up to had no way
 * to find out but to visit. Six files rather than one, because a single feed
 * has to be titled for something: a follower who wants the writing and a
 * follower who wants everything are subscribing to different lists, and the
 * failure mode of guessing is a feed titled for one section that silently omits
 * every other.
 *
 * Atom rather than RSS, and only Atom. RSS dates are RFC-822, which needs a
 * day-name table `dates.ts` deliberately does not have, and a second format is a
 * second artefact to hold in step for reach this site does not need.
 */
export function feedsPlugin(): Plugin {
  let root = "";
  let publicDir = "";
  let seedDanFm: SeedRule = "never";

  return {
    name: "feeds",
    apply: "build",

    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
      seedDanFm = seedsDanFm(config.command);
    },

    /**
     * The combined feed's autodiscovery link, injected rather than written into
     * `index.html`.
     *
     * This plugin is build-only, so a literal in that file would advertise a
     * feed the dev server never writes, and it would be a URL kept in step with
     * `FEEDS` by hand. `vite-plugin-pages.ts` builds every generated page and
     * `404.html` from the `index.html` this leaves behind, so all of them
     * inherit the link.
     */
    transformIndexHtml() {
      return [
        {
          tag: "link",
          attrs: {
            rel: "alternate",
            type: ATOM_TYPE,
            // Titled, because a reader's subscribe dialog shows this and
            // "alternate" on its own says nothing about what is inside.
            title: COMBINED.title,
            href: feedUrl(COMBINED),
          },
          injectTo: "head" as const,
        },
      ];
    },

    generateBundle() {
      const sections = collect(root, publicDir, seedDanFm);
      // The union, re-sorted across sections: the combined feed says
      // "everything" and is held to it.
      const everything = [...sections.values()].flat().sort(newestFirst);
      const today = buildDay();

      for (const feed of FEEDS) {
        const entries = feed.section === null ? everything : sections.get(feed.section);

        if (!entries) {
          throw new Error(
            `feeds: ${feed.path} is declared for ${feed.section}, which nothing collects entries for`,
          );
        }

        this.emitFile({
          type: "asset",
          // An emitted name is relative to the out dir; the path it answers at
          // is not.
          fileName: feed.path.slice(1),
          source: atom(feed, entries, today),
        });
      }

      console.log(`feeds: wrote ${FEEDS.length} file(s) covering ${everything.length} entries`);
    },
  };
}
