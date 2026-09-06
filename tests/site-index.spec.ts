import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { ALL_SECTIONS } from "../src/lib/site";
import { NO_ROW, tally, type SiteIndex } from "../src/lib/site-index";
import { contentPlugin, readPosts } from "../vite-plugin-content";

/**
 * The home index, checked where it is decided: in Node, at build time.
 *
 * The landing page reads `virtual:site-index` and prints what it finds, so
 * everything worth asserting about a row - that a date came with the words for
 * it, that no unfinished post is named, that a shelf with nothing on it says
 * nothing rather than zero - is answerable here without a browser. What the
 * page does with the answers costs one, and belongs to the home page's spec.
 *
 * Every case goes in through `resolveId` and `load` rather than by calling
 * `buildSiteIndex`: the name the app imports the digest by is half of the
 * contract, and a direct call exercises none of it.
 */

/**
 * Vite describes a plugin hook as either a function or an object wrapping one,
 * and this plugin writes the first. Typed by hand for the reason
 * `tests/dan-fm.spec.ts` types its own by hand.
 */
interface Hooks {
  configResolved: (config: { root: string; publicDir: string; command: "build" | "serve" }) => void;
  resolveId: (id: string) => string | null;
  load: (id: string) => string | null;
}

/** `export const siteIndex = <json>;`, which is the whole of what `load` returns. */
const EXPORTED = /^export const siteIndex = (.*);$/s;

/**
 * What the plugin calls `virtual:site-index` once it has resolved it.
 *
 * Asked for rather than spelled out: the `\0` prefix is Rollup's business, and
 * the contract worth holding here is that the plugin answers to the name the
 * app imports.
 */
const RESOLVED = (contentPlugin() as unknown as Hooks).resolveId("virtual:site-index");

/** The repo's own content, which is what a real build reads. */
const REPO = process.cwd();
const PUBLIC = path.resolve("public");

/**
 * The index a build of `root` would ship.
 *
 * `DANFM_SEED` is always set or cleared explicitly rather than inherited: it is
 * a real variable a shell may already carry, and a test whose answer depends on
 * who ran it reports the wrong thing on somebody's machine.
 */
function loadIndex(root: string, publicDir: string, seed?: string): SiteIndex {
  const before = process.env.DANFM_SEED;

  try {
    if (seed === undefined) delete process.env.DANFM_SEED;
    else process.env.DANFM_SEED = seed;

    const plugin = contentPlugin() as unknown as Hooks;
    plugin.configResolved({ root, publicDir, command: "build" });

    expect(RESOLVED, "the plugin no longer claims `virtual:site-index`").not.toBeNull();

    const code = plugin.load(RESOLVED!);
    const json = EXPORTED.exec(code ?? "");
    expect(
      json,
      "`virtual:site-index` no longer exports `siteIndex` as one JSON literal",
    ).not.toBeNull();

    return JSON.parse(json![1]) as SiteIndex;
  } finally {
    if (before === undefined) delete process.env.DANFM_SEED;
    else process.env.DANFM_SEED = before;
  }
}

/** The index built from a throwaway content tree, keyed by path under its root. */
function indexOf(files: Record<string, string>, seed?: string): SiteIndex {
  const root = mkdtempSync(path.join(tmpdir(), "site-index-"));

  try {
    for (const [name, body] of Object.entries(files)) {
      const file = path.join(root, name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, body);
    }

    return loadIndex(root, path.join(root, "public"), seed);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A post the reader accepts, for a case to make one of them a draft. */
function post(entry: { title: string; date: string; draft?: boolean }): string {
  return [
    "---",
    `title: ${entry.title}`,
    `date: ${entry.date}`,
    "category: personal",
    ...(entry.draft ? ["draft: true"] : []),
    "---",
    "",
    "A body, because a post without one fails the reader.",
    "",
  ].join("\n");
}

/** A show the reader accepts, at whatever precision its date is written to. */
function show(entry: { title: string; date: string }): string {
  return ["---", `title: ${entry.title}`, `date: ${entry.date}`, "city: Long Beach, CA", "---", ""]
    .join("\n")
    .concat("\n");
}

/** An album log, as `src/content/dan-fm.seed.json` holds one. */
function log(albums: Record<string, unknown>[]): string {
  return JSON.stringify({ url: "https://example.test/sheet", fetched: "2026-02-03", albums });
}

test.describe("every section's row", () => {
  test("every section has one", () => {
    /*
     * The page draws a row per section from this record, so a section missing
     * from it is a row read as `undefined` rather than a gap on the page.
     */
    const index = loadIndex(REPO, PUBLIC, "1");

    expect(Object.keys(index)).toEqual(ALL_SECTIONS.map((section) => section.to));
  });

  test("a date arrives with the item it belongs to and the words for it", () => {
    /*
     * The invariant, and it runs one way only: a row with a date has both of
     * the other two, while a row with a `latest` may still have no date. The
     * `/fortnite` case below is the witness for the direction that is allowed.
     */
    const index = loadIndex(REPO, PUBLIC, "1");

    for (const [section, row] of Object.entries(index)) {
      if (row.date === null) continue;

      expect(row.latest, section).not.toBeNull();
      expect(row.dateLabel, section).not.toBeNull();
    }
  });

  test("no row points off this site", () => {
    // A row's link is to the item's page here. A record and a comic have none,
    // and the index must send nobody to Discogs to read its own newest line.
    const index = loadIndex(REPO, PUBLIC, "1");

    for (const [section, row] of Object.entries(index)) {
      if (row.href === null) continue;

      expect(row.href, section).toMatch(/^\/[^/]/);
    }
  });

  test("no row points where the row already goes", () => {
    /*
     * A row's link is to the item's own page, and the row itself already opens
     * the section. Where the two are the same address the item has no page of
     * its own - `/now` prints its newest entry rather than listing it - and the
     * link is a second tab stop onto the destination the reader is already on
     * their way to.
     */
    const index = loadIndex(REPO, PUBLIC, "1");

    for (const [section, row] of Object.entries(index)) {
      expect(row.href, `${section} links to itself`).not.toBe(section);
    }
  });

  test("no unfinished post is named", () => {
    /*
     * `readPosts` returns drafts with everything else and says so, so the
     * filter is this caller's to apply. Without it the front page carries the
     * title of a post nobody has published.
     */
    const index = loadIndex(REPO, PUBLIC, "1");
    const named = Object.values(index).map((row) => row.latest);

    for (const draft of readPosts(REPO, PUBLIC).filter((entry) => entry.draft)) {
      expect(named, draft.slug).not.toContain(draft.title);
    }
  });

  test("the blog counts what it published, not what it holds", () => {
    const posts = readPosts(REPO, PUBLIC);
    const published = posts.filter((entry) => !entry.draft);
    const index = loadIndex(REPO, PUBLIC, "1");

    expect(index["/blog"].tally).toBe(tally(published.length, "post"));
    // Only says something while the repo holds a draft; the case below holds
    // the filter on content of its own.
    expect(index["/blog"].tally).not.toBe(tally(posts.length, "post"));
  });
});

test.describe("what a row refuses to say", () => {
  test("a draft newer than everything published is neither named nor counted", () => {
    const index = indexOf({
      "src/content/blog/published.md": post({ title: "Published", date: "2026-01-01" }),
      "src/content/blog/unfinished.md": post({
        title: "Unfinished",
        date: "2026-06-01",
        draft: true,
      }),
    });

    expect(index["/blog"]).toEqual({
      latest: "Published",
      date: "2026-01-01",
      dateLabel: "January 1, 2026",
      href: "/blog/published",
      tally: "1 post",
    });
  });

  test("a show dated by the year alone still prints a date", () => {
    /*
     * `parseShow` permits `YYYY` and `YYYY-MM`, and `longDate` returns "" for
     * both - a row worded through it would carry a real `datetime` with a blank
     * readout printed beside it.
     */
    const index = indexOf({
      "src/content/shows/some-band.md": show({ title: "Some Band", date: "2019" }),
    });

    expect(index["/shows"]).toEqual({
      latest: "Some Band",
      date: "2019",
      dateLabel: "2019",
      href: "/shows/some-band",
      tally: "1 show",
    });
  });

  test("now names its newest entry and gives it nothing to link to", () => {
    /*
     * The sweep above only says the rule held for whatever was in the repo the
     * morning it ran. This is the row the rule was written for, built from a
     * log of exactly one entry: the entry is named, and the link that would go
     * back to the page naming it is not there.
     */
    const index = indexOf({
      "src/content/now/2026-01-02.md": "---\nupdated: 2026-01-02\n---\n\nStill here.\n",
    });

    expect(index["/now"]).toEqual({
      latest: "Still here.",
      date: "2026-01-02",
      dateLabel: "January 2, 2026",
      href: null,
      tally: "1 entry",
    });
  });

  test("comics names no newest comic and still says how big the shelf is", () => {
    /*
     * The pull list is what is waiting at the shop, so it is dated forward, and
     * the runs on the shelf carry no date at all. Neither can honestly be the
     * newest thing here, so the row says how big the shelf is instead - and
     * says it without a zero on either side of it.
     */
    const index = loadIndex(REPO, PUBLIC, "1");

    expect(index["/comics"].latest).toBeNull();
    expect(index["/comics"].date).toBeNull();
    expect(index["/comics"].dateLabel).toBeNull();
    expect(index["/comics"].tally).toMatch(/^[1-9]\d* runs?( · [1-9]\d* waiting)?$/);
  });

  test("fortnite names a season and gives it no date", () => {
    // A season is a period rather than an event, and this is the row that makes
    // the invariant above one-directional rather than a pair.
    const index = loadIndex(REPO, PUBLIC, "1");

    expect(index["/fortnite"].latest).not.toBeNull();
    expect(index["/fortnite"].date).toBeNull();
    expect(index["/fortnite"].dateLabel).toBeNull();
    expect(index["/fortnite"].href).toBeNull();
  });

  test("a checkout with nothing logged says nothing at all", () => {
    /*
     * What the repo builds before any fetch job has ever run. Every collection
     * is empty, and an empty one has to come back absent rather than as a zero:
     * "0 records" advertises an empty shelf, and `readNow` spells an empty log
     * as an entry with an empty date, which would print as a blank readout
     * under a heading.
     */
    const index = indexOf({});

    for (const section of ALL_SECTIONS) {
      expect(index[section.to], section.to).toEqual(NO_ROW);
    }
  });
});

test.describe("which album log the index was built from", () => {
  const album = {
    date: "2026-02-01",
    slug: "2026-02-01-the-standing-wave-low-tide-signals",
    artist: "The Standing Wave",
    album: "Low Tide Signals",
    score: 4,
  };

  const newer = {
    date: "2026-02-02",
    slug: "2026-02-02-ivy-bellweather-small-hours",
    artist: "Ivy Bellweather",
    album: "Small Hours",
    score: 3.5,
  };

  test("an unseeded build says nothing rather than zero", () => {
    /*
     * `deploy.yml` builds with no `DANFM_SEED` while the fixture sits committed
     * beside the log it stands in for, so this is the production path exactly.
     * A row falling back to a zero tally here would put "0 albums" on every
     * page of the live site until the job first ran.
     */
    const index = indexOf({ "src/content/dan-fm.seed.json": log([album, newer]) });

    expect(index["/dan-fm"]).toEqual(NO_ROW);
  });

  test("DANFM_SEED=1 puts the newest album in the fixture on the index", () => {
    // What `ci.yml` sets, so the suite meets a populated page. Newest in the
    // log rather than whatever the station has on air: the digest is baked at
    // build time and `station()` reads the day off the reader's clock.
    const index = indexOf({ "src/content/dan-fm.seed.json": log([album, newer]) }, "1");

    expect(index["/dan-fm"]).toEqual({
      latest: "Ivy Bellweather - Small Hours",
      date: "2026-02-02",
      dateLabel: "February 2, 2026",
      href: "/dan-fm/2026-02-02-ivy-bellweather-small-hours",
      tally: "2 albums",
    });
  });
});
