import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { load as parseYaml } from "js-yaml";
import type { Plugin } from "vite";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WORDS_PER_MINUTE = 200;

const POST_CATEGORIES = ["work", "personal"];
const SHOW_TYPES = ["show", "festival"];
const TRIP_TYPES = ["vacation", "family", "work", "tour"];
const MAX_RATING = 5;

/** `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` - you remember some nights better than others. */
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

interface Frontmatter {
  file: string;
  meta: Record<string, unknown>;
  body: string;
  slug: string;
}

function fail(collection: string, file: string, message: string): never {
  throw new Error(`Invalid ${collection} entry - src/content/${collection}/${file}: ${message}`);
}

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * js-yaml parses an unquoted `2026-06-20` into a Date, so a full date arrives as
 * an object while `2026` and `2026-06` arrive as a number and a string. Normalise
 * all three back to the literal text the file contained.
 */
function asDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  return asTrimmedString(value);
}

function splitFrontmatter(collection: string, file: string, raw: string): Frontmatter {
  const match = FRONTMATTER.exec(raw);
  if (!match) fail(collection, file, "missing a `---` frontmatter block at the top of the file");

  const data = parseYaml(match[1]);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    fail(collection, file, "frontmatter must be a YAML mapping of keys to values");
  }

  return {
    file,
    meta: data as Record<string, unknown>,
    body: raw.slice(match[0].length).trim(),
    slug: file.replace(/\.md$/, ""),
  };
}

function parsePost({ file, meta, body, slug }: Frontmatter, publicDir: string) {
  const title = asTrimmedString(meta.title);
  if (!title) fail("blog", file, "frontmatter needs a `title`");

  const date = asDate(meta.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail("blog", file, "frontmatter needs a `date` in `YYYY-MM-DD` form");
  }

  const category = asTrimmedString(meta.category);
  if (!POST_CATEGORIES.includes(category)) {
    fail("blog", file, `frontmatter \`category\` must be one of: ${POST_CATEGORIES.join(", ")}`);
  }

  if (!body) fail("blog", file, "the post has no body");

  const words = body.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title,
    date,
    category,
    summary: asTrimmedString(meta.summary),
    tags: asStringArray(meta.tags),
    /*
     * Optional, and validated exactly like a show's or a trip's. Markdown can
     * still embed an image inline, but nothing checks those - no required alt
     * text, no required caption, no build-time check that the file is there.
     * A post whose photos are the point should use this instead.
     */
    photos: asPhotos("blog", meta.photos, file, publicDir),
    draft: meta.draft === true,
    readingTime: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    body,
  };
}

/**
 * Photos are written as objects with a path, alt text, and a caption:
 *
 *   photos:
 *     - src: /img/shows/warped-1/stage.jpg
 *       alt: Underoath mid-set, the drummer lit from behind
 *       caption: Underoath
 *
 * `alt` and `caption` are both required; a bare path is rejected.
 */
function asPhotos(collection: string, value: unknown, file: string, publicDir: string) {
  if (value == null) return [];

  return (Array.isArray(value) ? value : [value]).map((entry, index) => {
    const raw =
      typeof entry === "string"
        ? { src: entry }
        : entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : fail(collection, file, `\`photos[${index}]\` must be a path or a mapping with \`src\``);

    const src = asTrimmedString(raw.src);
    if (!src) fail(collection, file, `\`photos[${index}]\` needs a \`src\``);
    if (!src.startsWith("/") && !/^https?:\/\//.test(src)) {
      fail(
        collection,
        file,
        `\`photos[${index}].src\` must start with "/" (a path under public/) or be a full URL`,
      );
    }

    // A typo in a photo path would otherwise ship as a broken image; local
    // files are cheap to confirm, remote ones are not this build's problem.
    if (src.startsWith("/") && !existsSync(path.join(publicDir, src))) {
      fail(collection, file, `\`photos[${index}].src\` does not exist: public${src}`);
    }

    // Alt text and a caption are both required. A photo without alt text is
    // invisible to anyone using a screen reader, and one without a caption
    // gives no context to anyone else - neither should reach the site.
    const alt = asTrimmedString(raw.alt);
    if (!alt) fail(collection, file, `\`photos[${index}]\` needs \`alt\` describing what is in the frame`);

    const caption = asTrimmedString(raw.caption);
    if (!caption) fail(collection, file, `\`photos[${index}]\` needs a \`caption\``);

    return { src, alt, caption };
  });
}

/**
 * Which photo fades in behind a show's header. One photo in the list may carry
 * `banner: true`; with none marked, the first photo is used. The flag rides on
 * the photo so the choice sits next to the image it points at, and `asPhotos`
 * keeps only `src`, `alt`, and `caption`, so the flag never reaches the app.
 */
function resolveShowBanner(
  value: unknown,
  photos: { src: string; alt: string; caption: string }[],
  file: string,
) {
  if (photos.length === 0) return null;

  const entries = value == null ? [] : Array.isArray(value) ? value : [value];
  const marked = entries.flatMap((entry, index) =>
    entry &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    (entry as Record<string, unknown>).banner === true
      ? [index]
      : [],
  );

  if (marked.length > 1) {
    fail("shows", file, "only one photo can be the `banner` - mark a single photo with `banner: true`");
  }

  return photos[marked[0] ?? 0] ?? photos[0];
}

/**
 * Per-band setlist.fm links, written as objects that name the band and its URL:
 *
 *   setlists:
 *     - band: Bilmuri
 *       url: https://www.setlist.fm/setlist/bilmuri/2026/...
 *     - band: GANG!
 *       url: https://www.setlist.fm/setlist/gang/2026/...
 *
 * Every `band` must be on the bill, so a button never labels a band the entry
 * does not claim to have seen. Returned in `lineup` order regardless of how the
 * file lists them, so the buttons read top-billing-first like everything else.
 */
function asSetlists(value: unknown, file: string, lineup: string[]) {
  if (value == null) return [];

  const entries = (Array.isArray(value) ? value : [value]).map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail("shows", file, `\`setlists[${index}]\` must be a mapping with \`band\` and \`url\``);
    }
    const raw = entry as Record<string, unknown>;

    const band = asTrimmedString(raw.band);
    if (!band) fail("shows", file, `\`setlists[${index}]\` needs a \`band\``);
    if (!lineup.includes(band)) {
      fail(
        "shows",
        file,
        `\`setlists[${index}].band\` "${band}" is not in the lineup - a setlist button can only point at a band that played`,
      );
    }

    const url = asTrimmedString(raw.url);
    if (!/^https?:\/\//.test(url)) {
      fail("shows", file, `\`setlists[${index}].url\` must be a full http(s) URL`);
    }

    return { band, url };
  });

  const duplicates = entries.filter(
    (entry, index) => entries.findIndex((other) => other.band === entry.band) !== index,
  );
  if (duplicates.length > 0) {
    fail("shows", file, `\`setlists\` names the same band twice: ${duplicates.map((d) => d.band).join(", ")}`);
  }

  return entries.sort((a, b) => lineup.indexOf(a.band) - lineup.indexOf(b.band));
}

function parseShow({ file, meta, body, slug }: Frontmatter, publicDir: string) {
  const type = asTrimmedString(meta.type) || "show";
  if (!SHOW_TYPES.includes(type)) {
    fail("shows", file, `\`type\` must be one of: ${SHOW_TYPES.join(", ")}`);
  }

  const givenTitle = asTrimmedString(meta.title);
  const givenLineup = asStringArray(meta.lineup).map((band) => band.trim()).filter(Boolean);

  /*
   * `lineup` is the whole bill, top billing first - a show is rarely one band,
   * and the openers are half the reason to go. A one-band night can still be
   * written as a bare `title`, which normalises to a lineup of one.
   *
   * A festival's `title` is the event, not a band, so it stays out of `lineup`
   * and therefore out of every band count downstream.
   */
  const lineup = type === "festival" ? givenLineup : givenLineup.length ? givenLineup : [givenTitle].filter(Boolean);

  if (type === "festival" && !givenTitle) {
    fail("shows", file, "a festival needs a `title` - the name of the event");
  }
  if (type === "show" && lineup.length === 0) {
    fail(
      "shows",
      file,
      "a show needs a `lineup` listing who played, top billing first (or a `title` for a one-band night)",
    );
  }

  const duplicates = lineup.filter((band, index) => lineup.indexOf(band) !== index);
  if (duplicates.length > 0) {
    fail("shows", file, `\`lineup\` lists the same band twice: ${duplicates.join(", ")}`);
  }

  // For a show the heading is whoever is top of the bill.
  const title = type === "festival" ? givenTitle : lineup[0];

  const date = asDate(meta.date);
  if (!DATE.test(date)) {
    fail("shows", file, "frontmatter needs a `date` as `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`");
  }

  const endDate = asDate(meta.endDate);
  if (endDate && !DATE.test(endDate)) {
    fail("shows", file, "`endDate` must be `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`");
  }
  if (endDate && endDate < date) {
    fail("shows", file, "`endDate` is before `date`");
  }

  const city = asTrimmedString(meta.city);
  if (!city) fail("shows", file, "frontmatter needs a `city`");

  const bestSong = asTrimmedString(meta.bestSong);

  // How many people the room holds. Optional, because plenty of venues never
  // publish one and a guessed capacity is worse than no capacity.
  let capacity: number | null = null;
  if (meta.capacity != null && meta.capacity !== "") {
    const parsed = typeof meta.capacity === "number" ? meta.capacity : Number(meta.capacity);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      fail("shows", file, "`capacity` must be a whole number of people");
    }
    capacity = parsed;
  }

  const video = asTrimmedString(meta.video);
  if (video && !/^https?:\/\//.test(video)) {
    fail("shows", file, "`video` must be a full http(s) URL");
  }

  // Out of five horns, partials allowed. `null` means unrated, which is not the
  // same as zero and must not render as an empty rating.
  let rating: number | null = null;
  if (meta.rating != null && meta.rating !== "") {
    const parsed = typeof meta.rating === "number" ? meta.rating : Number(meta.rating);
    if (!Number.isFinite(parsed)) fail("shows", file, "`rating` must be a number");
    if (parsed < 0 || parsed > MAX_RATING) {
      fail("shows", file, `\`rating\` must be between 0 and ${MAX_RATING}`);
    }
    rating = parsed;
  }

  // `with` is nicer to write in frontmatter than `companions` is; the awkward
  // keyword stays out of the app by renaming it here.
  const companions = asStringArray(meta.with)
    .map((name) => name.trim())
    .filter(Boolean);
  const solo = meta.solo === true;

  if (solo && companions.length > 0) {
    fail("shows", file, "`solo: true` contradicts `with` - drop one");
  }

  const photos = asPhotos("shows", meta.photos, file, publicDir);

  return {
    slug,
    title,
    subtitle: asTrimmedString(meta.subtitle),
    type,
    date,
    endDate,
    venue: asTrimmedString(meta.venue),
    capacity,
    city,
    bestSong,
    lineup,
    rating,
    companions,
    solo,
    video,
    // A YouTube playlist URL is just a video URL with a `list` param, so the
    // link labels itself rather than needing a second field.
    videoIsPlaylist: /[?&]list=/.test(video),
    setlists: asSetlists(meta.setlists, file, lineup),
    photos,
    banner: resolveShowBanner(meta.photos, photos, file),
    standout: meta.standout === true,
    body,
  };
}

function parseTrip({ file, meta, body, slug }: Frontmatter, publicDir: string) {
  const title = asTrimmedString(meta.title);
  if (!title) fail("trips", file, "frontmatter needs a `title` - where the trip was");

  const type = asTrimmedString(meta.type) || "vacation";
  if (!TRIP_TYPES.includes(type)) {
    fail("trips", file, `\`type\` must be one of: ${TRIP_TYPES.join(", ")}`);
  }

  // Same precision rules as a show. A trip you only remember the month of is
  // still worth logging, so a bare `YYYY-MM` is valid and renders as "June".
  const date = asDate(meta.date);
  if (!DATE.test(date)) {
    fail("trips", file, "frontmatter needs a `date` as `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`");
  }

  const endDate = asDate(meta.endDate);
  if (endDate && !DATE.test(endDate)) {
    fail("trips", file, "`endDate` must be `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`");
  }
  if (endDate && endDate < date) fail("trips", file, "`endDate` is before `date`");

  /*
   * Every place the trip touched, in the order you went, written "City,
   * Country". The country is split off here so the index can count countries
   * without every page re-parsing the same strings.
   */
  const stops = asStringArray(meta.stops)
    .map((stop) => stop.trim())
    .filter(Boolean);
  if (stops.length === 0) {
    fail("trips", file, "frontmatter needs `stops` listing where you went, in order");
  }

  const duplicates = stops.filter((stop, index) => stops.indexOf(stop) !== index);
  if (duplicates.length > 0) {
    fail("trips", file, `\`stops\` lists the same place twice: ${[...new Set(duplicates)].join(", ")}`);
  }

  for (const [index, stop] of stops.entries()) {
    if (!stop.includes(",")) {
      fail("trips", file, `\`stops[${index}]\` must be "City, Country" - got "${stop}"`);
    }
  }

  const highlights = asStringArray(meta.highlights)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const companions = asStringArray(meta.with)
    .map((name) => name.trim())
    .filter(Boolean);
  const solo = meta.solo === true;

  if (solo && companions.length > 0) {
    fail("trips", file, "`solo: true` contradicts `with` - drop one");
  }

  // Deliberately three states. `null` is "have not decided", which is not the
  // same as "no", and must not render as a verdict either way.
  let wouldGoBack: boolean | null = null;
  if (meta.wouldGoBack != null && meta.wouldGoBack !== "") {
    if (typeof meta.wouldGoBack !== "boolean") {
      fail("trips", file, "`wouldGoBack` must be true or false");
    }
    wouldGoBack = meta.wouldGoBack;
  }

  return {
    slug,
    title,
    type,
    date,
    endDate,
    stops,
    countries: [...new Set(stops.map((stop) => stop.split(",").at(-1)!.trim()).filter(Boolean))],
    highlights,
    oneThing: asTrimmedString(meta.oneThing),
    bestMeal: asTrimmedString(meta.bestMeal),
    wouldGoBack,
    companions,
    solo,
    photos: asPhotos("trips", meta.photos, file, publicDir),
    body,
  };
}

interface Collection {
  /** Directory under `src/content/`, and the export name on the virtual module. */
  name: string;
  exportName: string;
  parse: (entry: Frontmatter, publicDir: string) => { date: string; title: string; draft?: boolean };
}

const COLLECTIONS: Collection[] = [
  { name: "blog", exportName: "posts", parse: parsePost },
  { name: "shows", exportName: "shows", parse: parseShow },
  { name: "trips", exportName: "trips", parse: parseTrip },
];

function readCollection(collection: Collection, dir: string, publicDir: string) {
  // A leading underscore marks a file as notes-to-self rather than an entry,
  // which is how each collection keeps its own README next to its content.
  const files = existsSync(dir)
    ? readdirSync(dir).filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    : [];

  return (
    files
      .map((file) =>
        collection.parse(
          splitFrontmatter(collection.name, file, readFileSync(path.join(dir, file), "utf8")),
          publicDir,
        ),
      )
      // Newest first; a partial date sorts below a full one in the same year,
      // which is the right place for "sometime in 2026".
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
  );
}

/**
 * The published shows, parsed the same way the app sees them. Exported so the
 * build can write a real HTML page per show without a second parser drifting
 * out of step with this one.
 */
export function readShows(root: string, publicDir: string) {
  const collection = COLLECTIONS.find((entry) => entry.name === "shows")!;
  return readCollection(collection, path.resolve(root, "src/content/shows"), publicDir) as ReturnType<
    typeof parseShow
  >[];
}

/**
 * Reads and validates the markdown collections under `src/content/` at build
 * time and exposes each as a virtual module (`virtual:blog`, `virtual:shows`).
 *
 * Doing this in Node rather than in the browser buys three things the runtime
 * version could not: malformed frontmatter fails the build instead of the live
 * page, `draft: true` entries are genuinely absent from the production bundle
 * rather than merely filtered out after shipping, and the YAML parser never
 * reaches the client.
 */
export function contentPlugin(): Plugin {
  const dirs = new Map<string, string>();
  let publicDir = "";
  let includeDrafts = false;

  function virtualId(name: string) {
    return `virtual:${name}`;
  }

  function resolvedId(name: string) {
    return `\0virtual:${name}`;
  }

  function load(collection: Collection): string {
    const entries = readCollection(collection, dirs.get(collection.name)!, publicDir).filter(
      (entry) => includeDrafts || !entry.draft,
    );

    return `export const ${collection.exportName} = ${JSON.stringify(entries)};`;
  }

  return {
    name: "content",
    enforce: "pre",

    configResolved(config) {
      for (const collection of COLLECTIONS) {
        dirs.set(collection.name, path.resolve(config.root, "src/content", collection.name));
      }
      publicDir = config.publicDir;
      includeDrafts = config.command === "serve";
    },

    resolveId(id) {
      const collection = COLLECTIONS.find((entry) => id === virtualId(entry.name));
      return collection ? resolvedId(collection.name) : null;
    },

    load(id) {
      const collection = COLLECTIONS.find((entry) => id === resolvedId(entry.name));
      return collection ? load(collection) : null;
    },

    configureServer(server) {
      // Editing, adding, or deleting an entry should refresh the browser.
      const invalidate = (file: string) => {
        if (!file.endsWith(".md")) return;

        const collection = COLLECTIONS.find((entry) => file.startsWith(dirs.get(entry.name)!));
        if (!collection) return;

        const module = server.moduleGraph.getModuleById(resolvedId(collection.name));
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", invalidate);
      server.watcher.on("change", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}
