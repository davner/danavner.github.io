import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import type { Plugin, Rollup } from "vite";

import { nowSummary, nowTitle } from "./src/lib/now-summary";
import { PAGE_META } from "./src/lib/routes";
import { showHeading, showSummary } from "./src/lib/show-summary";
import { DEFAULT_SHARE_IMAGE, SHOW_FALLBACK_IMAGE, SITE_NAME, SITE_URL } from "./src/lib/site";
import { readNow, readPosts, readShows } from "./vite-plugin-content";

/**
 * The home page's hero preload, marked in `index.html` so a generated page can
 * drop it.
 *
 * The photo is the home page's largest contentful paint and nothing else on the
 * site shows it, so preloading it anywhere else is 47 kB nobody asked for.
 */
const HOME_PRELOAD = /[ \t]*<!-- home-preload:start -->[\s\S]*?<!-- home-preload:end -->\n?/;

/**
 * The source module behind each lazily-loaded route.
 *
 * Written out rather than derived from the path: `/blog/:slug` renders
 * `blog-post.tsx` and `/shows/:slug` renders `show.tsx`, so a rule that matched
 * the path against a filename would silently skip exactly those two - the pages
 * with the heaviest chunks on the site.
 */
const LAZY_MODULE = {
  "/blog/:slug": "src/routes/blog-post.tsx",
  "/shows": "src/routes/shows.tsx",
  "/shows/:slug": "src/routes/show.tsx",
  "/vinyl": "src/routes/vinyl.tsx",
  // One module for both now routes, the way `App` loads it.
  "/now": "src/routes/now.tsx",
  "/now/:date": "src/routes/now.tsx",
  "/comics": "src/routes/comics.tsx",
  "/fortnite": "src/routes/fortnite.tsx",
} as const satisfies Record<string, string>;

/**
 * The module a static route renders from, or null where the entry bundle
 * already carries it.
 *
 * `as const` above so the four lookups written by hand are checked: a key
 * renamed out from under one of them fails the build instead of leaving that
 * page without its preload, which nothing else would notice.
 */
function lazyModuleFor(route: string): string | null {
  return route in LAZY_MODULE ? LAZY_MODULE[route as keyof typeof LAZY_MODULE] : null;
}

/** The end of the head, and the indentation the tags inside it are written at. */
const HEAD_END = /\n([ \t]*)<\/head>/;

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The tag `index.html` carries for one meta property, however it is wrapped,
 * with the indentation and the newline around it so removing it takes the whole
 * line rather than leaving a blank one.
 */
function metaTag(property: string) {
  return new RegExp(`[ \\t]*<meta\\s+(?:name|property)="${property}"[^>]*>\\n?`);
}

/**
 * Points a meta tag already present in `index.html` at this page's value, or
 * takes the tag out where the page has no value for it.
 *
 * Removing beats guessing: a crawler told nothing about the card measures the
 * image itself, while one told the wrong size lays out the ratio it was
 * promised and crops the picture into it.
 */
function setMeta(html: string, property: string, value: string | null) {
  return html.replace(metaTag(property), (tag) =>
    value === null ? "" : tag.replace(/content="[^"]*"/, `content="${escapeAttribute(value)}"`),
  );
}

/** Adds tags to the end of the head, indented to match the ones already there. */
function appendToHead(html: string, tags: string[]) {
  if (tags.length === 0) return html;
  return html.replace(
    HEAD_END,
    (_full, indent: string) =>
      `\n${tags.map((tag) => `${indent}  ${tag}\n`).join("")}${indent}</head>`,
  );
}

/** A share image as a crawler needs it: absolute, however it was written. */
function absoluteImage(photo: string) {
  return /^https?:\/\//.test(photo) ? photo : `${SITE_URL}${photo}`;
}

/**
 * One photo out of the content. Every collection requires `alt` on every photo,
 * so the words describing the card are already written and none has to be
 * invented here.
 */
interface SharePhoto {
  /** As the content wrote it: a path under `public/`, or a full URL. */
  src: string;
  alt: string;
}

/** An image's real pixel dimensions. */
interface ImageSize {
  width: number;
  height: number;
}

/**
 * What a page previews as: its own first photo, or the card named as the
 * fallback for pages that have none.
 */
function shareImage(
  photos: SharePhoto[],
  fallback: string,
): { photo: SharePhoto | null; image: string } {
  // Annotated rather than inferred: without `noUncheckedIndexedAccess`, TypeScript
  // types `photos[0]` as a photo even when the array is empty, so the null the
  // fallback exists for is one the signature has to declare.
  const photo = photos[0] ?? null;
  return { photo, image: absoluteImage(photo?.src ?? fallback) };
}

/**
 * `/about` -> `about.html`.
 *
 * The flat form, because GitHub Pages serves it at `/about` directly while the
 * directory form costs a 301 to `/about/` first.
 */
function flatFile(route: string) {
  return `${route.slice(1)}.html`;
}

/** One URL the site serves, before it is told which file it is written to. */
interface Page {
  /** The path it is served at, e.g. `/vinyl` or `/shows/bilmuri-los-angeles-2026`. */
  path: string;
  /** Everything before the site name in the `<title>`. */
  title: string;
  description: string;
  /** Absolute URL of the card a link preview shows. */
  image: string;
  /**
   * The photo behind that card, when the page has one of its own. Null where it
   * falls back to a site card, and that null is what decides whether the size
   * and description tags are rewritten or left as `index.html` wrote them.
   */
  photo: SharePhoto | null;
  /**
   * The source module this route renders from, when it is a lazy one, so the
   * page can start fetching the chunk it is about to ask for. Null for a route
   * the entry bundle already carries.
   */
  lazyModule: string | null;
  /**
   * Whether the URL belongs in the sitemap. A page can be worth writing and not
   * worth listing: the current now entry has a file so a shared link previews,
   * but its permalink redirects to `/now`, which is the address to index.
   */
  indexed: boolean;
}

/** A page and the file or files Pages answers its URL from. */
interface WrittenPage extends Page {
  /** Where the HTML goes, relative to the out dir. */
  files: string[];
}

/**
 * Every page the build writes, section indexes and content alike.
 *
 * `index.html` is not among them: Vite writes it, and it is the file Pages
 * serves at "/".
 */
function collectPages(root: string, publicDir: string): WrittenPage[] {
  const content: Page[] = [];

  /*
   * The draft filter belongs here because nothing upstream applies one -
   * `readCollection` returns every file it parsed, and the only other filter is
   * the one `contentPlugin` uses to keep drafts out of the bundle. A draft that
   * reaches this list gets a published URL and a line in the sitemap.
   */
  for (const post of readPosts(root, publicDir).filter((entry) => !entry.draft)) {
    content.push({
      path: `/blog/${post.slug}`,
      title: post.title,
      description: post.summary,
      ...shareImage(post.photos, DEFAULT_SHARE_IMAGE),
      lazyModule: LAZY_MODULE["/blog/:slug"],
      indexed: true,
    });
  }

  for (const show of readShows(root, publicDir)) {
    content.push({
      path: `/shows/${show.slug}`,
      title: showHeading(show),
      description: showSummary(show),
      // The show fallback rather than the site's own card: a link preview
      // showing a headshot for a festival reads as the wrong link entirely.
      ...shareImage(show.photos, SHOW_FALLBACK_IMAGE),
      lazyModule: LAZY_MODULE["/shows/:slug"],
      indexed: true,
    });
  }

  /*
   * Every now entry, current and archived alike.
   *
   * The current entry gets a file even though `/now/<its date>` redirects to
   * `/now`, and the two halves have to be read together or someone will later
   * "fix" one of them: the crawler fetches the HTML and never runs the router,
   * so this file is what makes the preview correct, while the redirect is for
   * humans, who land on `/now` showing the same entry.
   *
   * The consequence, stated so it is not filed as a bug: one entry carries two
   * titles depending on which URL you arrive by. `/now` sets "Now · Dan Avner",
   * because the front door is undated - it is always whatever is current. The
   * dated permalink says "Now · August 27, 2026 · Dan Avner", because being
   * dated is the entire reason a permalink exists.
   */
  const { current, archive } = readNow(root, publicDir);

  for (const entry of [current, ...archive].filter((entry) => entry.updated)) {
    content.push({
      path: `/now/${entry.updated}`,
      title: nowTitle(entry),
      // Never empty: `parseNowEntry` fails the build on an entry whose body
      // holds no paragraphs, so by the time `readNow` returns one there is
      // something for the preview to say.
      description: nowSummary(entry),
      // The site's own card rather than the show fallback: a now entry is about
      // the person, so the portrait is the right stand-in here.
      ...shareImage(entry.photos, DEFAULT_SHARE_IMAGE),
      lazyModule: LAZY_MODULE["/now/:date"],
      indexed: entry !== current,
    });
  }

  const sections = Object.entries(PAGE_META).map(([route, meta]): Page => ({
    path: route,
    title: meta.title,
    description: meta.description,
    // A section index has no photo of its own, and the site's card is defined
    // as the one for any page without a more specific image.
    image: absoluteImage(DEFAULT_SHARE_IMAGE),
    photo: null,
    lazyModule: lazyModuleFor(route),
    indexed: true,
  }));

  /*
   * `/blog`, `/shows` and `/now` each name a directory the content pages fill,
   * so each of those is written twice with the same bytes. Nothing documents
   * which one Pages reaches when `blog.html` and `blog/` both exist: if it
   * prefers the file the URL serves with no hop, and if it prefers the
   * directory it 301s to a page that now exists. Neither branch is the 404 both
   * forms are here to end, so which one it picks stops being something anyone
   * has to know.
   */
  const parents = new Set(content.map((page) => page.path.slice(0, page.path.lastIndexOf("/"))));

  return [...sections, ...content].map((page) => ({
    ...page,
    files: parents.has(page.path)
      ? [flatFile(page.path), `${page.path.slice(1)}/index.html`]
      : [flatFile(page.path)],
  }));
}

/**
 * Every address worth indexing, `<loc>` and nothing else.
 *
 * No `lastmod`: the deploy checks out at depth 1, so there is no per-file git
 * history to read a date out of, and a date the build invented would be a claim
 * about the content that nothing behind it supports.
 */
function sitemap(pages: WrittenPage[]) {
  const urls = [
    // The home page, which Vite writes and this plugin therefore does not list.
    `${SITE_URL}/`,
    ...pages.filter((page) => page.indexed).map((page) => `${SITE_URL}${page.path}`),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeAttribute(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

/**
 * The file a module ended up in, as a path under the site.
 *
 * Throws rather than returning nothing: a route file that moved would otherwise
 * lose its preload silently, and the only symptom is the page getting slower.
 */
function chunkFor(bundle: Rollup.OutputBundle, root: string, module: string) {
  const id = path.resolve(root, module);

  for (const output of Object.values(bundle)) {
    if (output.type === "chunk" && output.moduleIds.includes(id)) return `/${output.fileName}`;
  }

  throw new Error(`pages: nothing in the bundle contains ${module} - has the route file moved?`);
}

/**
 * The real dimensions of every local photo the pages preview with, keyed by the
 * path the content wrote.
 *
 * Measured once per photo rather than once per page: nothing stops one picture
 * being the card for two entries, and the `Set` is what keeps it from being
 * opened twice for the same two numbers. A page answering at both `/blog` and
 * `/blog/` needs no help here - it is one `Page`, and `page.files` splits it
 * into two files long after this has run.
 *
 * Remote photos are absent from the map, and the pages that use one ship no
 * `og:image:width` or `og:image:height` at all. Measuring one would mean
 * fetching it, and a build that reads the network is a build that fails when
 * somebody else's host is down.
 */
async function measurePhotos(pages: Page[], publicDir: string) {
  const local = new Set(
    pages
      .map((page) => page.photo?.src)
      .filter((src): src is string => src !== undefined && src.startsWith("/")),
  );

  const sizes = new Map<string, ImageSize>();

  await Promise.all(
    [...local].map(async (src) => {
      try {
        // `autoOrient` rather than the raw header: a crawler lays the photo out
        // the way a browser paints it, with any EXIF rotation already applied.
        const { autoOrient } = await sharp(path.join(publicDir, src)).metadata();
        sizes.set(src, { width: autoOrient.width, height: autoOrient.height });
      } catch (cause) {
        // The content plugin has already confirmed the file is there, so
        // reaching here means it is there and is not an image.
        throw new Error(`pages: could not measure public${src} for its link preview`, { cause });
      }
    }),
  );

  return sizes;
}

/** The shared bundle, wearing one page's title, description, and card. */
function render(template: string, page: Page, chunk: string | null, sizes: Map<string, ImageSize>) {
  const title = `${page.title} · ${SITE_NAME}`;
  const url = `${SITE_URL}${page.path}`;

  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(title)}</title>`);
  html = setMeta(html, "description", page.description);
  html = setMeta(html, "og:title", title);
  html = setMeta(html, "og:description", page.description);
  html = setMeta(html, "og:url", url);
  html = setMeta(html, "og:image", page.image);

  /*
   * What that image is and how big it is, for a page carrying its own photo.
   * A page falling back to a card keeps what `index.html` ships: both cards are
   * written at the 1200x630 those tags already claim, and the description there
   * is the site's own.
   *
   * Getting this wrong is not cosmetic. A portrait photo announced as 1200x630
   * reaches the crawler with its aspect ratio inverted, and the preview crops
   * the picture to the shape it was promised.
   */
  if (page.photo) {
    const size = sizes.get(page.photo.src) ?? null;

    html = setMeta(html, "og:image:width", size && String(size.width));
    html = setMeta(html, "og:image:height", size && String(size.height));
    html = setMeta(html, "og:image:alt", page.photo.alt);
  }

  // Every image reaching here is either the page's own photo or one of the
  // site's cards, and both are made to be shown large.
  html = html.replace(
    /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/,
    '<meta name="twitter:card" content="summary_large_image" />',
  );

  /*
   * `og:url` is not a canonicalization signal to Google; `rel=canonical` is.
   * Three of these pages answer at both `/blog` and `/blog/` with identical
   * bytes, and this is the tag that says which of the two is the address.
   */
  const tags = [`<link rel="canonical" href="${escapeAttribute(url)}" />`];

  if (chunk) {
    /*
     * The chunk this route is about to ask for, which the document otherwise
     * only learns about after the entry bundle has been fetched, parsed and
     * run. `crossorigin` matches the module script Vite emits, without which
     * the browser fetches the file a second time.
     *
     * This chunk only, and nothing it imports: a route chunk's static imports
     * are shared chunks the entry already pulls in.
     */
    tags.push(`<link rel="modulepreload" crossorigin href="${escapeAttribute(chunk)}" />`);
  }

  return appendToHead(html, tags);
}

/**
 * Writes every HTML file GitHub Pages serves that is not `index.html`:
 *
 * - A real page per URL the site answers - `about.html`, `blog/welcome.html`,
 *   one per show, one per now entry. The site is client-rendered, so a crawler
 *   sees whatever is in the served HTML and nothing the router does afterwards.
 *   Without these, every route but the home page answers a bare request with a
 *   404 status, and every shared link previews as the generic site card. Each
 *   page is the same bundle with its own title, description, and image, so the
 *   app still boots and routes normally.
 * - `404.html`, which Pages serves for any path it has no file for. The client
 *   router reads the URL and renders the right page, so a retired or mistyped
 *   deep link still lands somewhere.
 *
 * One plugin for all of it, because every file here starts from `index.html`:
 * split in two, the order they are listed in decides whether either sees the
 * other's output.
 *
 * `writeBundle` rather than `closeBundle`: `index.html` is an emitted asset, so
 * it is on disk by the time this runs.
 */
export function pagesPlugin(): Plugin {
  let root = "";
  let publicDir = "";
  let outDir = "";

  return {
    name: "pages",
    apply: "build",

    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
      outDir = path.resolve(config.root, config.build.outDir);
    },

    async writeBundle(_options, bundle) {
      const home = readFileSync(path.join(outDir, "index.html"), "utf8");

      if (!HOME_PRELOAD.test(home)) {
        // The markers are how the generated pages are allowed to differ from
        // the home page. If they are gone the strip silently stops happening
        // and every page here starts paying for the home page's photo.
        throw new Error("pages: the home-preload markers are missing from index.html");
      }

      if (!HEAD_END.test(home)) {
        throw new Error("pages: index.html has no </head> to hang the per-page tags on");
      }

      // `index.html` is the only file Pages serves at "/", so it is the only
      // one where the hero preload buys anything. Every page below is some
      // other URL, and the template they all start from has it stripped.
      const template = home.replace(HOME_PRELOAD, "");

      // No canonical and no page's meta: this one file stands in for every path
      // the site has no page for, so it can claim none of their addresses.
      writeFileSync(path.join(outDir, "404.html"), template);

      const pages = collectPages(root, publicDir);
      const sizes = await measurePhotos(pages, publicDir);

      // Memoised: every blog post preloads the same chunk, as does every show.
      const chunks = new Map<string, string>();
      const chunkOf = (module: string) => {
        const known = chunks.get(module) ?? chunkFor(bundle, root, module);
        chunks.set(module, known);
        return known;
      };

      let written = 0;

      for (const page of pages) {
        const chunk = page.lazyModule ? chunkOf(page.lazyModule) : null;
        const html = render(template, page, chunk, sizes);

        for (const file of page.files) {
          const target = path.join(outDir, file);
          mkdirSync(path.dirname(target), { recursive: true });
          writeFileSync(target, html);
          written += 1;
        }
      }

      writeFileSync(path.join(outDir, "sitemap.xml"), sitemap(pages));

      console.log(`pages: wrote ${written} file(s) covering ${pages.length} URL(s)`);
    },
  };
}
