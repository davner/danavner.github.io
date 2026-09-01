import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { PAGE_META, STATIC_PATHS, type PageMeta } from "../src/lib/routes";
import { ALL_SECTIONS, DEFAULT_SHARE_IMAGE, SITE_URL } from "../src/lib/site";
import { readNow, readPosts, readShows } from "../vite-plugin-content";

const DIST = path.resolve("dist");
const CONTENT_ROOT = process.cwd();
const PUBLIC = path.resolve("public");
const SITE_NAME = "Dan Avner";

/** Keyed loosely, because these lookups are driven by lists of plain strings. */
const META: Record<string, PageMeta> = PAGE_META;

/** Every static route but the home page, which is `index.html` and Vite's. */
const SECTIONS = STATIC_PATHS.filter((route) => route !== "/");

/**
 * The static routes that also name a directory the build fills. Each is written
 * twice, so whichever form Pages prefers, the URL answers with a page.
 */
const BOTH_FORMS = ["/blog", "/shows", "/now", "/dan-fm"];

/** `/about` -> `dist/about.html`. */
function fileFor(route: string) {
  return path.join(DIST, `${route.slice(1)}.html`);
}

function read(file: string) {
  return readFileSync(file, "utf8");
}

/** The four entities the build escapes with, back to the characters. */
function decode(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/** index.html wraps some meta tags across lines, so match loosely on whitespace. */
function metaFrom(html: string) {
  return (name: string) =>
    decode(
      new RegExp(`<meta\\s+(?:name|property)="${name}"[^>]*content="([^"]*)"`).exec(html)?.[1] ??
        "",
    );
}

function titleOf(html: string) {
  return decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "");
}

function canonicalOf(html: string) {
  return /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(html)?.[1] ?? "";
}

/**
 * Everything the document loads for every route: the module script, the
 * stylesheet, and the font preloads.
 *
 * A generated page is meant to be `index.html` with its meta swapped and
 * nothing else, and that claim is only worth making if something checks it. The
 * one deliberate addition is each page's `modulepreload` for its own route
 * chunk, which is per-page by definition and so is not part of the comparison.
 */
function bundleTags(html: string) {
  return html
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("/assets/") && !line.includes("modulepreload"));
}

/**
 * The site is client-rendered, so a bare request for `/vinyl` is answered by
 * whatever file GitHub Pages finds at that path - it never runs the router. A
 * missing file is a 404 to a crawler and to Lighthouse, both of which stop
 * there, while a human never notices because `404.html` boots the app anyway.
 */
test.describe("a real page per route", () => {
  test("every section has one", () => {
    expect(SECTIONS.length).toBeGreaterThan(0);

    for (const route of SECTIONS) {
      expect(existsSync(fileFor(route)), `${route} has no page of its own`).toBe(true);
    }
  });

  test("a route that is also a directory is written both ways", () => {
    for (const route of BOTH_FORMS) {
      const flat = fileFor(route);
      const directory = path.join(DIST, route.slice(1), "index.html");

      expect(existsSync(flat), `${route} has no flat file`).toBe(true);
      expect(existsSync(directory), `${route}/ has no index`).toBe(true);
      // Identical, so which form Pages serves cannot change what a visitor
      // reads - only whether they pay a redirect to get there.
      expect(read(flat), `${route} and ${route}/ serve different pages`).toBe(read(directory));
    }
  });

  test("each page carries its own meta", () => {
    for (const route of SECTIONS) {
      const html = read(fileFor(route));
      const meta = metaFrom(html);
      const expected = META[route];

      expect(titleOf(html), `${route} has the wrong title`).toBe(
        `${expected.title} · ${SITE_NAME}`,
      );
      expect(meta("description"), `${route} has the wrong description`).toBe(expected.description);
      expect(meta("og:title"), `${route} has the wrong og:title`).toBe(
        `${expected.title} · ${SITE_NAME}`,
      );
      expect(meta("og:description"), `${route} has the wrong og:description`).toBe(
        expected.description,
      );
      expect(meta("og:url"), `${route} points og:url somewhere else`).toBe(`${SITE_URL}${route}`);
      // A relative image previews as a blank card, which is worse than no
      // image: the crawler has no page URL to resolve it against.
      expect(meta("og:image"), `${route} has a relative og:image`).toMatch(/^https?:\/\//);
      expect(canonicalOf(html), `${route} names the wrong canonical URL`).toBe(
        `${SITE_URL}${route}`,
      );
    }
  });

  test("no generated page preloads the home page's hero", () => {
    // The home page's largest contentful paint, and 47 kB nobody else asked
    // for. `index.html` is the only file Pages serves at "/".
    for (const route of SECTIONS) {
      expect(read(fileFor(route)), `${route} still preloads the home hero`).not.toContain(
        "home-preload:start",
      );
    }

    expect(read(path.join(DIST, "404.html"))).not.toContain("home-preload:start");
    expect(read(path.join(DIST, "index.html"))).toContain("home-preload:start");
  });

  test("every page loads the same bundle the home page does", () => {
    const home = bundleTags(read(path.join(DIST, "index.html")));
    expect(home.length).toBeGreaterThan(0);

    for (const route of SECTIONS) {
      expect(bundleTags(read(fileFor(route))), `${route} loads a different bundle`).toEqual(home);
    }
  });
});

/**
 * A post's page is the one a search result or a shared link opens, so the set
 * of them is the set of URLs the site is publishing.
 */
test.describe("a page per published post", () => {
  const posts = readPosts(CONTENT_ROOT, PUBLIC);

  test("every published post has one", () => {
    const published = posts.filter((post) => !post.draft);
    expect(published.length).toBeGreaterThan(0);

    for (const post of published) {
      expect(
        existsSync(path.join(DIST, "blog", `${post.slug}.html`)),
        `/blog/${post.slug} has no page of its own`,
      ).toBe(true);
    }
  });

  test("no draft has one", () => {
    /*
     * The filter that has to be applied by hand: `readPosts` returns drafts,
     * and the only other one in the repo keeps them out of the bundle rather
     * than out of the build's URL list. A draft that slips through gets a real
     * page and, from there, a line in the sitemap.
     */
    const drafts = posts.filter((post) => post.draft);
    test.skip(drafts.length === 0, "no draft is filed - nothing to leak");

    for (const post of drafts) {
      expect(
        existsSync(path.join(DIST, "blog", `${post.slug}.html`)),
        `/blog/${post.slug} is a draft and the build published it`,
      ).toBe(false);
    }
  });
});

/**
 * What a link preview is told about its own picture, none of which is visible
 * on the page. `og:image:width` and `og:image:height` are the box a crawler
 * lays the card out in, so a portrait photo announced as 1200x630 is cropped to
 * a shape it is not, and `og:image:alt` is the only words anyone reading the
 * preview by ear gets for it.
 */
test.describe("the link preview card", () => {
  /** The dimensions of an image under `public/`, as a browser would paint it. */
  async function measure(src: string) {
    const { autoOrient } = await sharp(path.join(PUBLIC, src)).metadata();
    return { width: String(autoOrient.width), height: String(autoOrient.height) };
  }

  /** Every generated page whose card is a photo out of the content. */
  function pagesWithPhotos() {
    const { current, archive } = readNow(CONTENT_ROOT, PUBLIC);

    return [
      ...readPosts(CONTENT_ROOT, PUBLIC)
        .filter((post) => !post.draft)
        .map((post) => ({
          file: path.join(DIST, "blog", `${post.slug}.html`),
          photos: post.photos,
        })),
      ...readShows(CONTENT_ROOT, PUBLIC).map((show) => ({
        file: path.join(DIST, "shows", `${show.slug}.html`),
        photos: show.photos,
      })),
      ...[current, ...archive].map((entry) => ({
        file: path.join(DIST, "now", `${entry.updated}.html`),
        photos: entry.photos,
      })),
    ]
      .filter((page) => page.photos.length > 0)
      .map((page) => ({ file: page.file, photo: page.photos[0] }));
  }

  test("a page with its own photo declares that photo, not the site's card", async () => {
    const pages = pagesWithPhotos();
    expect(pages.length, "no page previews with a photo - nothing to check here").toBeGreaterThan(
      0,
    );

    for (const { file, photo } of pages) {
      const meta = metaFrom(read(file));
      const remote = /^https?:\/\//.test(photo.src);

      expect(meta("og:image"), `${file} does not preview as its own photo`).toBe(
        remote ? photo.src : `${SITE_URL}${photo.src}`,
      );
      expect(meta("og:image:alt"), `${file} describes the site card, not its photo`).toBe(
        photo.alt,
      );

      if (remote) {
        // Measuring one would mean fetching it, and the build reads no network.
        // Nothing is better than a guess: told a size, a crawler believes it.
        expect(meta("og:image:width"), `${file} invents a remote card's width`).toBe("");
        expect(meta("og:image:height"), `${file} invents a remote card's height`).toBe("");
        continue;
      }

      const { width, height } = await measure(photo.src);
      expect(meta("og:image:width"), `${file} declares the wrong card width`).toBe(width);
      expect(meta("og:image:height"), `${file} declares the wrong card height`).toBe(height);
    }
  });

  test("a page with no photo of its own keeps the site card's size and words", async () => {
    const site = metaFrom(read(path.join(DIST, "index.html")));
    const { width, height } = await measure(DEFAULT_SHARE_IMAGE);

    expect(site("og:image:alt"), "index.html leaves the site card undescribed").not.toBe("");

    for (const route of SECTIONS) {
      const meta = metaFrom(read(fileFor(route)));

      expect(meta("og:image"), `${route} previews as something other than the site card`).toBe(
        `${SITE_URL}${DEFAULT_SHARE_IMAGE}`,
      );
      expect(meta("og:image:width"), `${route} declares the wrong card width`).toBe(width);
      expect(meta("og:image:height"), `${route} declares the wrong card height`).toBe(height);
      expect(meta("og:image:alt"), `${route} describes the site card as something else`).toBe(
        site("og:image:alt"),
      );
    }
  });
});

/**
 * The word in the nav and the word in the tab, held together. They are one
 * string in `lib/routes.ts` and this is what says so - somebody scanning a list
 * of links for "Vinyl" should not land on a tab calling it something else.
 */
test("every section's page is titled the way the nav names it", () => {
  for (const section of ALL_SECTIONS) {
    expect(META[section.to], `${section.to} is in the nav with no page meta`).toBeDefined();
    expect(META[section.to].title, `${section.to} is titled differently from its nav label`).toBe(
      section.label,
    );
  }
});

/**
 * The sitemap is the list of addresses this site hands a search engine, so what
 * is missing from it and what should never have been on it both matter.
 */
test.describe("the sitemap", () => {
  const locs = [
    ...readFileSync(path.join(DIST, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]*)<\/loc>/g),
  ].map((match) => match[1]);

  test("lists every static route", () => {
    for (const route of STATIC_PATHS) {
      expect(locs, `${route} is missing from the sitemap`).toContain(`${SITE_URL}${route}`);
    }
  });

  test("lists every published post and show", () => {
    const posts = readPosts(CONTENT_ROOT, PUBLIC);

    for (const post of posts.filter((entry) => !entry.draft)) {
      expect(locs, `/blog/${post.slug} is missing from the sitemap`).toContain(
        `${SITE_URL}/blog/${post.slug}`,
      );
    }

    for (const post of posts.filter((entry) => entry.draft)) {
      expect(locs, `/blog/${post.slug} is a draft and the sitemap advertises it`).not.toContain(
        `${SITE_URL}/blog/${post.slug}`,
      );
    }

    for (const show of readShows(CONTENT_ROOT, PUBLIC)) {
      expect(locs, `/shows/${show.slug} is missing from the sitemap`).toContain(
        `${SITE_URL}/shows/${show.slug}`,
      );
    }
  });

  test("lists the archived now entries and not the current one", () => {
    const { current, archive } = readNow(CONTENT_ROOT, PUBLIC);

    for (const entry of archive) {
      expect(locs, `/now/${entry.updated} is missing from the sitemap`).toContain(
        `${SITE_URL}/now/${entry.updated}`,
      );
    }

    /*
     * The current entry has a page - a shared link has to preview as itself -
     * but its permalink redirects to `/now`. Listing both would offer a search
     * engine two addresses for one entry and send a reader to the one that
     * bounces.
     */
    expect(locs, "the current now entry's permalink is in the sitemap").not.toContain(
      `${SITE_URL}/now/${current.updated}`,
    );
  });

  test("every URL is absolute", () => {
    expect(locs.length).toBeGreaterThan(0);

    for (const loc of locs) {
      // A crawler reads the sitemap on its own, with no page to resolve a
      // relative path against.
      expect(loc.startsWith(`${SITE_URL}/`), `${loc} is not an absolute URL`).toBe(true);
    }
  });
});
