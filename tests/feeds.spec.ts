import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { COMBINED, FEEDS, feedUrl, type Feed } from "../src/lib/feeds";
import { SITE_URL } from "../src/lib/site";
import { readNow, readPosts } from "../vite-plugin-content";
import { escapeXml, stamp } from "../vite-plugin-feeds";

const DIST = path.resolve("dist");
const CONTENT_ROOT = process.cwd();
const PUBLIC = path.resolve("public");

const ATOM_NS = "http://www.w3.org/2005/Atom";

/** What `<updated>` has to be: a full RFC-3339 instant, offset included. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/**
 * The one id in these feeds that is not an address, because a record has no
 * page here. Pinned by shape so a `tag:` id cannot quietly become the answer
 * for a section whose entries do have pages.
 */
const TAG_ID = new RegExp(
  `^tag:${new URL(SITE_URL).host.replaceAll(".", "\\.")},\\d{4}:vinyl/\\d+$`,
);

/** Every control character but the three XML keeps, restated for the check. */
const FORBIDDEN = /(?![\t\n\r])\p{Cc}/u;

/** An ampersand opening nothing, which is the commonest way a feed stops parsing. */
const BARE_AMPERSAND = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g;

/** `/feed-blog.xml` -> `dist/feed-blog.xml`. */
function fileFor(feed: Feed) {
  return path.join(DIST, feed.path.slice(1));
}

/**
 * The file the build answers a URL on this site from, or null for a URL that is
 * not one.
 *
 * The flat form for a page, because that is the one `vite-plugin-pages.ts`
 * always writes - the directory form is a second copy of the same bytes, and
 * only for the routes that parent content pages.
 */
function servedFile(url: string): string | null {
  if (!url.startsWith(`${SITE_URL}/`)) return null;

  const at = url.slice(SITE_URL.length);
  if (at === "/") return path.join(DIST, "index.html");
  return path.join(DIST, at.endsWith(".xml") ? at.slice(1) : `${at.slice(1)}.html`);
}

interface ParsedLink {
  rel: string;
  type: string;
  href: string;
}

interface ParsedEntry {
  id: string;
  title: string;
  /** Null where the entry carries none, which a `<summary>` is allowed to be. */
  summary: string | null;
  updated: string;
  links: ParsedLink[];
}

interface ParsedFeed {
  /** What the parser refused, or null where it accepted the document. */
  error: string | null;
  root: string;
  namespace: string | null;
  title: string;
  id: string;
  updated: string;
  links: ParsedLink[];
  entries: ParsedEntry[];
}

/**
 * Every feed the build wrote, read by a real XML parser and keyed by the path
 * it is served at.
 *
 * Chromium's `DOMParser` rather than anything on this side: "it parses" is half
 * of what a feed has to be, and a forgiving parser answers yes for a document
 * no reader would accept.
 */
async function parseFeeds(page: Page): Promise<Map<string, ParsedFeed>> {
  const sources = FEEDS.map(
    (feed) => [feed.path, readFileSync(fileFor(feed), "utf8")] as [string, string],
  );

  const parsed = await page.evaluate(
    (files) =>
      files.map(([at, source]) => {
        const doc = new DOMParser().parseFromString(source, "application/xml");
        const failure = doc.querySelector("parsererror");
        const root = doc.documentElement;

        const childrenOf = (parent: Element, name: string) =>
          [...parent.children].filter((child) => child.localName === name);
        const textOf = (parent: Element, name: string) =>
          childrenOf(parent, name)[0]?.textContent ?? null;
        const linksOf = (parent: Element) =>
          childrenOf(parent, "link").map((link) => ({
            rel: link.getAttribute("rel") ?? "",
            type: link.getAttribute("type") ?? "",
            href: link.getAttribute("href") ?? "",
          }));

        return [
          at,
          {
            error: failure ? (failure.textContent ?? "the parser refused it") : null,
            root: root.localName,
            namespace: root.namespaceURI,
            title: textOf(root, "title") ?? "",
            id: textOf(root, "id") ?? "",
            updated: textOf(root, "updated") ?? "",
            links: linksOf(root),
            entries: childrenOf(root, "entry").map((entry) => ({
              id: textOf(entry, "id") ?? "",
              title: textOf(entry, "title") ?? "",
              summary: textOf(entry, "summary"),
              updated: textOf(entry, "updated") ?? "",
              links: linksOf(entry),
            })),
          },
        ] as [string, ParsedFeed];
      }),
    sources,
  );

  return new Map(parsed);
}

/** Every address one feed states, its own and its entries'. */
function urlsOf(feed: ParsedFeed): string[] {
  return [
    feed.id,
    ...feed.links.map((link) => link.href),
    ...feed.entries.flatMap((entry) => [entry.id, ...entry.links.map((link) => link.href)]),
  ];
}

/**
 * The feeds, checked against the build that wrote them.
 *
 * The site had none before this, and a reader who follows what Dan is up to
 * could only find out by visiting. What that reader is owed is checked here:
 * that every declared feed is really there and really parses, that it names
 * addresses the site answers, and that nothing unfinished or redirecting
 * reaches a subscriber.
 */
test.describe("the feeds the build writes", () => {
  test("every declared feed is written and parses as XML", async ({ page }) => {
    const feeds = await parseFeeds(page);

    for (const feed of FEEDS) {
      expect(
        existsSync(fileFor(feed)),
        `${feed.path} is declared and the build wrote no file`,
      ).toBe(true);

      const parsed = feeds.get(feed.path)!;
      expect(parsed.error, `${feed.path} is not well-formed XML: ${parsed.error}`).toBeNull();
      expect(parsed.root, `${feed.path} is not an Atom feed`).toBe("feed");
      expect(parsed.namespace, `${feed.path} is not in the Atom namespace`).toBe(ATOM_NS);

      // The title is the whole fix for a follower subscribing to a link that
      // turns out to hold none of what they came for.
      expect(parsed.title, `${feed.path} does not say what it is`).toBe(feed.title);
      expect(parsed.id, `${feed.path} does not identify itself`).toBe(feedUrl(feed));
      expect(
        parsed.links.find((link) => link.rel === "self")?.href,
        `${feed.path} does not say where it lives`,
      ).toBe(feedUrl(feed));
    }
  });

  test("every link and id points at something the build wrote", async ({ page }) => {
    const feeds = await parseFeeds(page);

    for (const feed of FEEDS) {
      for (const url of urlsOf(feeds.get(feed.path)!)) {
        if (url.startsWith("tag:")) {
          expect(url, `${feed.path} carries a tag URI that is not a record's`).toMatch(TAG_ID);
          continue;
        }

        // A subscriber reads the feed with no page to resolve a path against,
        // so a relative one names nothing.
        const file = servedFile(url);
        expect(file, `${feed.path} carries "${url}", which is not an address here`).not.toBeNull();
        expect(existsSync(file!), `${feed.path} points at ${url}, which has no file`).toBe(true);
      }
    }
  });

  test("no draft reaches a feed", async ({ page }) => {
    const drafts = readPosts(CONTENT_ROOT, PUBLIC).filter((post) => post.draft);
    expect(drafts.length, "no draft is on disk, so this proves nothing").toBeGreaterThan(0);

    const feeds = await parseFeeds(page);

    for (const feed of [feeds.get("/feed-blog.xml")!, feeds.get(COMBINED.path)!]) {
      for (const draft of drafts) {
        expect(
          feed.entries.map((entry) => entry.id),
          `${draft.slug} is a draft and a feed publishes it`,
        ).not.toContain(`${SITE_URL}/blog/${draft.slug}`);
        expect(
          feed.entries.map((entry) => entry.title),
          `"${draft.title}" is a draft and a feed prints its title`,
        ).not.toContain(draft.title);
      }
    }
  });

  test("the current now entry is linked where it answers, and identified where it will", async ({
    page,
  }) => {
    const { current } = readNow(CONTENT_ROOT, PUBLIC);
    const permalink = `${SITE_URL}/now/${current.updated}`;
    const now = (await parseFeeds(page)).get("/feed-now.xml")!;

    const entry = now.entries.find((one) => one.id === permalink);
    expect(entry, "the current now entry is missing from its own feed").toBeDefined();

    /*
     * The id is the permalink and the link is not, and the two answer different
     * questions. `/now/<the current date>` redirects to `/now`, which is the
     * rule the sitemap already follows, so the link has to be the address that
     * answers. The id has to be the address the entry keeps once it is
     * archived, or the day it moves every subscriber meets it a second time.
     */
    expect(entry!.links.map((link) => link.href)).toEqual([`${SITE_URL}/now`]);
    expect(
      now.entries.flatMap((one) => one.links.map((link) => link.href)),
      "a feed links the current now entry at the address that redirects",
    ).not.toContain(permalink);
  });

  test("the combined feed is the union of the five, newest first", async ({ page }) => {
    const feeds = await parseFeeds(page);
    const combined = feeds.get(COMBINED.path)!;

    const union = FEEDS.filter((feed) => feed.section !== null).flatMap((feed) =>
      feeds.get(feed.path)!.entries.map((entry) => entry.id),
    );

    // A feed titled "everything" is telling the truth or it is the trap it was
    // written to avoid.
    expect(combined.entries.length, "the combined feed is not the size of the five").toBe(
      union.length,
    );
    expect(new Set(combined.entries.map((entry) => entry.id))).toEqual(new Set(union));

    const times = combined.entries.map((entry) => Date.parse(entry.updated));
    for (const [index, time] of times.entries()) {
      if (index === 0) continue;
      expect(
        time,
        `entry ${index} of the combined feed is newer than the one above it`,
      ).toBeLessThanOrEqual(times[index - 1]);
    }
  });

  test("every date a feed carries is a full instant", async ({ page }) => {
    const feeds = await parseFeeds(page);

    for (const feed of FEEDS) {
      const parsed = feeds.get(feed.path)!;
      expect(parsed.updated, `${feed.path} has no readable <updated>`).toMatch(INSTANT);

      for (const entry of parsed.entries) {
        expect(entry.updated, `${entry.id} in ${feed.path} is not stamped`).toMatch(INSTANT);
      }
    }
  });
});

/**
 * The stamp, checked where a wrong answer looks right.
 *
 * The site's zone runs seven hours behind UTC for the summer half of the year
 * and eight for the winter half. The stamp reads 09:00 local, which is after
 * the 02:00 changeover, so the day either side of a transition is the day the
 * offset moves - and a feed whose every winter date is an hour out is a bug
 * nobody notices for six months.
 */
test.describe("the date a feed entry carries", () => {
  test("follows the site's zone across a daylight-saving boundary", () => {
    // 2026's transitions: forward on March 8, back on November 1.
    expect(stamp("2026-03-07")).toBe("2026-03-07T09:00:00-08:00");
    expect(stamp("2026-03-08")).toBe("2026-03-08T09:00:00-07:00");
    expect(stamp("2026-10-31")).toBe("2026-10-31T09:00:00-07:00");
    expect(stamp("2026-11-01")).toBe("2026-11-01T09:00:00-08:00");
  });

  test("pads a partial show date to the start of the period it names", () => {
    expect(stamp("2025")).toBe("2025-01-01T09:00:00-08:00");
    expect(stamp("2025-07")).toBe("2025-07-01T09:00:00-07:00");
  });

  test("refuses a day no calendar has", () => {
    // Only the album log validates its dates this far; a show or a now entry
    // dated this way passes its own shape check.
    expect(() => stamp("2026-02-30")).toThrow(/no calendar has/);
    expect(() => stamp("2026-13-01")).toThrow(/no calendar has/);
    expect(() => stamp("last summer")).toThrow(/stamped with/);
  });
});

/**
 * The escaping, checked on input the repo does not have.
 *
 * Every summary in the built feeds today is plain prose, so nothing about the
 * output would notice this going wrong - and the text arrives from a published
 * Google Sheet and from Discogs, which is where the input that would is.
 */
test.describe("the text a feed entry carries", () => {
  test("the escaper spells out what XML reserves and drops what it forbids", () => {
    expect(escapeXml("Belle & Sebastian <3 > 2")).toBe("Belle &amp; Sebastian &lt;3 &gt; 2");

    // The sequence a CDATA section cannot hold, which is why a summary is a
    // text node instead.
    expect(escapeXml("]]> and on")).toBe("]]&gt; and on");

    // Tab, newline and carriage return stay; every other control goes.
    expect(escapeXml("a\u0000b\u0008c\u001Fd\te\nf\rg")).toBe("abcd\te\nf\rg");

    // A quote is a text node's to keep - only an attribute has to escape one.
    expect(escapeXml('a 7" single')).toBe('a 7" single');
  });

  test("no feed the build wrote carries a character XML cannot", () => {
    for (const feed of FEEDS) {
      const source = readFileSync(fileFor(feed), "utf8");

      expect(FORBIDDEN.test(source), `${feed.path} carries a control character`).toBe(false);
      expect(
        source.match(BARE_AMPERSAND) ?? [],
        `${feed.path} carries an ampersand that opens nothing`,
      ).toEqual([]);
    }
  });
});
