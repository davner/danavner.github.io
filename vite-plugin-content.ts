import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { load as parseYaml } from "js-yaml";
import type { Plugin } from "vite";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WORDS_PER_MINUTE = 200;

const POST_CATEGORIES = ["work", "personal"];
const SHOW_TYPES = ["show", "festival"];
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

function parsePost({ file, meta, body, slug }: Frontmatter) {
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
    draft: meta.draft === true,
    readingTime: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    body,
  };
}

/**
 * Photos accept either a bare path or an object, so a quick entry stays quick:
 *
 *   photos:
 *     - /img/shows/warped-1/pit.jpg
 *     - src: /img/shows/warped-1/stage.jpg
 *       alt: Underoath mid-set
 *       caption: Underoath
 */
function asPhotos(value: unknown, file: string, publicDir: string) {
  if (value == null) return [];

  return (Array.isArray(value) ? value : [value]).map((entry, index) => {
    const raw =
      typeof entry === "string"
        ? { src: entry }
        : entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : fail("shows", file, `\`photos[${index}]\` must be a path or a mapping with \`src\``);

    const src = asTrimmedString(raw.src);
    if (!src) fail("shows", file, `\`photos[${index}]\` needs a \`src\``);
    if (!src.startsWith("/") && !/^https?:\/\//.test(src)) {
      fail(
        "shows",
        file,
        `\`photos[${index}].src\` must start with "/" (a path under public/) or be a full URL`,
      );
    }

    // A typo in a photo path would otherwise ship as a broken image; local
    // files are cheap to confirm, remote ones are not this build's problem.
    if (src.startsWith("/") && !existsSync(path.join(publicDir, src))) {
      fail("shows", file, `\`photos[${index}].src\` does not exist: public${src}`);
    }

    return { src, alt: asTrimmedString(raw.alt), caption: asTrimmedString(raw.caption) };
  });
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

  return {
    slug,
    title,
    subtitle: asTrimmedString(meta.subtitle),
    type,
    date,
    endDate,
    venue: asTrimmedString(meta.venue),
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
    photos: asPhotos(meta.photos, file, publicDir),
    standout: meta.standout === true,
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
];

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
    const dir = dirs.get(collection.name)!;
    // A leading underscore marks a file as notes-to-self rather than an entry,
    // which is how each collection keeps its own README next to its content.
    const files = existsSync(dir)
      ? readdirSync(dir).filter((file) => file.endsWith(".md") && !file.startsWith("_"))
      : [];

    const entries = files
      .map((file) =>
        collection.parse(
          splitFrontmatter(collection.name, file, readFileSync(path.join(dir, file), "utf8")),
          publicDir,
        ),
      )
      .filter((entry) => includeDrafts || !entry.draft)
      // Newest first; a partial date sorts below a full one in the same year,
      // which is the right place for "sometime in 2026".
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

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
