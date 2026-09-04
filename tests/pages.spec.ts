import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { albumUrl } from "../src/lib/dan-fm-summary";
import { PAGE_META, STATIC_PATHS, type PageMeta } from "../src/lib/routes";
import { ALL_SECTIONS, CARD_FALLBACK_IMAGE, DEFAULT_SHARE_IMAGE, SITE_URL } from "../src/lib/site";
import { readNow, readPosts, readShows } from "../vite-plugin-content";

import { albumsOnDisk, type LoggedAlbum } from "./dan-fm";

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

  test("each page carries one theme-color meta, defaulting dark", () => {
    // Exactly one, because the pre-paint script re-stamps this single meta for
    // the resolved theme - a media-qualified pair would fight it. The content
    // is the dark hex so a no-JS visitor's chrome matches the dark-baked
    // markup whatever their OS preference.
    for (const file of [path.join(DIST, "index.html"), ...SECTIONS.map(fileFor)]) {
      const html = read(file);
      const name = path.basename(file);

      expect(
        html.match(/<meta\s+name="theme-color"/g),
        `${name} pairs the theme-color meta`,
      ).toHaveLength(1);
      expect(metaFrom(html)("theme-color"), `${name} defaults the chrome off dark`).toBe("#0a0c12");
    }
  });

  /*
   * The `socials` list in src/content/profile.ts, spelled out. A literal
   * because that module cannot be imported from here: it reads accounts.json,
   * which Node's loader refuses without an import attribute the app's build
   * does not use. Adding a profile means adding it in both places, and this
   * failing is how the second place gets remembered.
   */
  const PROFILES = [
    "https://github.com/davner",
    "https://www.linkedin.com/in/danavner/",
    "https://www.instagram.com/aspacemansheavyload/",
    "https://www.youtube.com/@danmadespace",
    "https://scholar.google.com/citations?user=B0HllkYAAAAJ&hl=en",
  ];

  test("each page vouches for every profile that vouches back", () => {
    /*
     * The rel=me links are hand-written in index.html - the config context
     * cannot import profile.ts, for the reason src/lib/routes.ts records - so
     * this is the only thing binding them to the profile list. Order and all:
     * the head's list is that list, not a selection from it.
     */
    for (const file of [path.join(DIST, "index.html"), ...SECTIONS.map(fileFor)]) {
      const html = read(file);
      const hrefs = [...html.matchAll(/<link\s+rel="me"\s+href="([^"]*)"/g)].map((match) =>
        decode(match[1]),
      );

      expect(hrefs, `${path.basename(file)} does not vouch for every profile`).toEqual(PROFILES);
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
 * The dimensions of an image under `public/`, as a browser would paint it.
 *
 * Module scope because both the photo cases and the album sleeve cases hold a
 * page's declared card size against the file it names.
 */
async function measure(src: string) {
  const { autoOrient } = await sharp(path.join(PUBLIC, src)).metadata();
  return { width: String(autoOrient.width), height: String(autoOrient.height) };
}

/**
 * What a link preview is told about its own picture, none of which is visible
 * on the page. `og:image:width` and `og:image:height` are the box a crawler
 * lays the card out in, so a portrait photo announced as 1200x630 is cropped to
 * a shape it is not, and `og:image:alt` is the only words anyone reading the
 * preview by ear gets for it.
 */
test.describe("the link preview card", () => {
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

    /*
     * The station is not one of these. `/dan-fm` previews as the sleeve of the
     * album on air, so its card comes out of the log rather than off the site
     * and moves every time the log does.
     */
    for (const route of SECTIONS.filter((route) => route !== "/dan-fm")) {
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
 * What `/dan-fm` and an album's permalink preview as, which is the record
 * rather than a picture of whoever played it.
 *
 * The one card on the site that moves on its own: the log gains a row every day
 * the job runs, so the station's picture is whatever sleeve that row saved. All
 * of it is read off the log on disk for that reason - a slug or a title written
 * out here would be describing yesterday's station by tomorrow.
 */
test.describe("an album's sleeve as its card", () => {
  /** The log the built site was made from, oldest first. */
  const LOGGED = [...albumsOnDisk()].sort((a, b) => a.date.localeCompare(b.date));

  /**
   * The album the station previews as: the newest row by date.
   *
   * `station()` picks the featured album this way and the build re-derives it,
   * because `vite-plugin-pages.ts` runs where `virtual:dan-fm` has no resolver
   * and cannot call the function the page calls. Two derivations of one choice
   * living in two files is exactly the drift these cases are here to catch, so
   * this is a third reading of the dates rather than a call into either.
   */
  const ON_AIR = LOGGED.at(-1);

  /**
   * The words a preview writes for a sleeve. The page writes none: the artist
   * and the album are set in type beside the picture there, and an unfurl read
   * by ear has nothing beside it, so the two are deliberately not the same
   * string and neither can be taken from the other.
   */
  function sleeveAlt(album: LoggedAlbum) {
    return `The sleeve of ${album.album} by ${album.artist}`;
  }

  /** What `index.html` says about the site's own card, which a fallback keeps. */
  const site = metaFrom(read(path.join(DIST, "index.html")));

  test("an album with a sleeve saved previews as that sleeve", async () => {
    const withSleeve = LOGGED.filter((album) => album.cover);
    test.skip(withSleeve.length === 0, "no album in the log on disk has a sleeve saved");

    for (const album of withSleeve) {
      const route = albumUrl(album);
      const meta = metaFrom(read(fileFor(route)));

      expect(meta("og:image"), `${route} previews as something other than its sleeve`).toBe(
        `${SITE_URL}${album.cover}`,
      );
      expect(meta("og:image:alt"), `${route} does not name the record its card shows`).toBe(
        sleeveAlt(album),
      );

      // A sleeve is square and the card tags default to 1200x630, so an album
      // that kept the default would hand a crawler a ratio to crop it into.
      const { width, height } = await measure(album.cover);
      expect(meta("og:image:width"), `${route} declares the wrong sleeve width`).toBe(width);
      expect(meta("og:image:height"), `${route} declares the wrong sleeve height`).toBe(height);
    }
  });

  test("an album with no sleeve saved previews as the wordless card", () => {
    const bare = LOGGED.filter((album) => !album.cover);
    test.skip(bare.length === 0, "every album in the log on disk has a sleeve saved");

    for (const album of bare) {
      const route = albumUrl(album);
      const meta = metaFrom(read(fileFor(route)));

      /*
       * The wordless card rather than the site's portrait, which would preview
       * a stranger's record as a picture of the owner - and rather than a
       * sleeve path the album has none of, which would point the crawler at a
       * file the build never wrote.
       */
      expect(meta("og:image"), `${route} previews as something other than the wordless card`).toBe(
        `${SITE_URL}${CARD_FALLBACK_IMAGE}`,
      );
      expect(meta("og:image:alt"), `${route} describes a sleeve it has not got`).toBe(
        site("og:image:alt"),
      );
    }
  });

  test("the station previews as the album on air, exactly as that album's own page does", () => {
    test.skip(ON_AIR === undefined, "no album log on disk for the station to preview");
    test.skip(!ON_AIR!.cover, "the album on air has no sleeve for the station to show");

    const album = ON_AIR!;
    const station = metaFrom(read(fileFor("/dan-fm")));
    const permalink = metaFrom(read(fileFor(albumUrl(album))));

    expect(station("og:image"), "the station does not preview as the album on air").toBe(
      `${SITE_URL}${album.cover}`,
    );
    expect(station("og:image:alt"), "the station's card does not name the album on air").toBe(
      sleeveAlt(album),
    );

    /*
     * Held against the album's own page as well as against the log, so the
     * station keeps taking its card from the same place the album does however
     * the build is rearranged - a station given a second derivation of its own
     * fails here even if it happens to agree with the log on this one row.
     *
     * The other half of the drift is on the page rather than in the file:
     * `station()` picks what the browser shows and the build cannot call it.
     * `tests/dan-fm-page.spec.ts` holds that half to the same reading of the
     * dates these do, which is what makes the pair of them a fence.
     */
    for (const tag of ["og:image", "og:image:alt", "og:image:width", "og:image:height"]) {
      expect(station(tag), `the station and ${albumUrl(album)} disagree about ${tag}`).toBe(
        permalink(tag),
      );
    }
  });

  test("the station takes the site card when nothing on air has a sleeve", async () => {
    /*
     * Both fallbacks at once, because the station cannot tell them apart: an
     * empty log and an album whose sleeve never saved both leave it with no
     * picture of its own, and it takes the site card either way - the one every
     * other section index takes.
     *
     * Runs on a build in one of those states and stands down on any other. A
     * log that has never been fetched is one, and so is a run of the job where
     * the newest row's cover download failed, which is not hypothetical: the
     * committed fixture files six such rows out of eight.
     */
    test.skip(
      ON_AIR !== undefined && Boolean(ON_AIR.cover),
      "the album on air has a sleeve, so the station previews as that instead",
    );

    const station = metaFrom(read(fileFor("/dan-fm")));
    const { width, height } = await measure(DEFAULT_SHARE_IMAGE);

    expect(station("og:image"), "the station previews as neither a sleeve nor the site card").toBe(
      `${SITE_URL}${DEFAULT_SHARE_IMAGE}`,
    );
    expect(station("og:image:width"), "the station declares the wrong card width").toBe(width);
    expect(station("og:image:height"), "the station declares the wrong card height").toBe(height);
    expect(station("og:image:alt"), "the station describes the site card as something else").toBe(
      site("og:image:alt"),
    );
  });
});

/**
 * Which of X's two frames a page's card is laid out in.
 *
 * The wide card crops the picture to 2:1 and the small one crops it to a
 * square, so a picture no wider than it is tall loses at least half its height
 * to the wide card: a square sleeve arrives as a band across its own middle.
 *
 * Asserted as a rule over every page the build wrote rather than over a list of
 * routes, because the rule is about the picture's shape and nothing about which
 * page it belongs to. A page type nobody has invented yet is covered by this
 * the day it first writes a file.
 */
test.describe("the frame X lays a card out in", () => {
  /**
   * The frame a picture fits, measured off the file `dist` actually serves.
   *
   * Off the file rather than off the `og:image:width` the page declares, so a
   * page that got the size and the frame wrong in the same direction still
   * fails here.
   */
  async function frameFor(image: string) {
    // A picture on somebody else's host cannot be measured by a build that
    // reads no network, and takes the wide card both site cards are drawn at.
    if (!image.startsWith(`${SITE_URL}/`)) return "summary_large_image";

    const file = path.join(DIST, image.slice(SITE_URL.length));
    expect(existsSync(file), `${image} is not a file the build wrote`).toBe(true);

    const { autoOrient } = await sharp(file).metadata();
    return autoOrient.width <= autoOrient.height ? "summary" : "summary_large_image";
  }

  test("every page takes the frame its own picture fits", async () => {
    const pages = readdirSync(DIST, { recursive: true })
      .map(String)
      .filter((name) => name.endsWith(".html"));

    expect(pages.length, "the build wrote no pages to check").toBeGreaterThan(0);

    // One picture is the card for a whole run of pages, and measuring it once
    // per page would open the same two files twenty times.
    const frames = new Map<string, string>();
    let checked = 0;

    for (const name of pages) {
      const meta = metaFrom(read(path.join(DIST, name)));
      const image = meta("og:image");
      const card = meta("twitter:card");

      // `dist/admin` is the CMS's own page and carries neither tag.
      if (!image || !card) continue;

      const known = frames.get(image) ?? (await frameFor(image));
      frames.set(image, known);

      expect(card, `${name} lays ${image} out in the wrong frame`).toBe(known);
      checked += 1;
    }

    expect(checked, "no page the build wrote declares both a card and a picture").toBeGreaterThan(
      0,
    );
  });

  test("both shapes are on the site, so the rule is doing work", () => {
    /*
     * What keeps the sweep above from going quiet rather than red. It compares
     * each page against its own picture, so a site whose pictures were all one
     * shape would pass it while proving nothing about the rule - and a frame
     * pinned back to one value would pass with it. This is what says both
     * branches are reachable from the pages this build wrote.
     */
    const cards = new Set(
      readdirSync(DIST, { recursive: true })
        .map(String)
        .filter((name) => name.endsWith(".html"))
        .map((name) => metaFrom(read(path.join(DIST, name)))("twitter:card"))
        .filter(Boolean),
    );

    expect(cards, "no page on the site takes the small card").toContain("summary");
    expect(cards, "no page on the site takes the wide card").toContain("summary_large_image");
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
