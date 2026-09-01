import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { load as parseYaml } from "js-yaml";
import type { Plugin } from "vite";

import { nowParagraphs } from "./src/lib/now-summary";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WORDS_PER_MINUTE = 200;

const POST_CATEGORIES = ["work", "personal"];
const SHOW_TYPES = ["show", "festival"];
const MAX_RATING = 5;

/** `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` - you remember some nights better than others. */
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** A whole date and nothing shorter, for the collections a job writes. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Frontmatter {
  file: string;
  meta: Record<string, unknown>;
  body: string;
  slug: string;
}

/**
 * Every build-time rejection in this file, in one shape: what is wrong, the file
 * to open, and why. One owner, because an error message that is spelled out
 * twice is one that ends up spelled two ways.
 */
function invalid(what: string, where: string, message: string): never {
  throw new Error(`Invalid ${what} - ${where}: ${message}`);
}

/**
 * The collection-shaped caller, which is almost all of them. `where` defaults to
 * the path a collection entry sits at; the single-file pages live directly under
 * `src/content/` and pass their own, so an error names the file you actually
 * have to open.
 */
function fail(
  collection: string,
  file: string,
  message: string,
  where = `src/content/${collection}/${file}`,
): never {
  return invalid(`${collection} entry`, where, message);
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

function splitFrontmatter(
  collection: string,
  file: string,
  raw: string,
  where?: string,
): Frontmatter {
  const match = FRONTMATTER.exec(raw);
  if (!match) {
    fail(collection, file, "missing a `---` frontmatter block at the top of the file", where);
  }

  const data = parseYaml(match[1]);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    fail(collection, file, "frontmatter must be a YAML mapping of keys to values", where);
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
     * Optional, and validated exactly like a show's. Markdown can
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
    if (!alt)
      fail(collection, file, `\`photos[${index}]\` needs \`alt\` describing what is in the frame`);

    const caption = asTrimmedString(raw.caption);
    if (!caption) fail(collection, file, `\`photos[${index}]\` needs a \`caption\``);

    return { src, alt, caption };
  });
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
    fail(
      "shows",
      file,
      `\`setlists\` names the same band twice: ${duplicates.map((d) => d.band).join(", ")}`,
    );
  }

  return entries.sort((a, b) => lineup.indexOf(a.band) - lineup.indexOf(b.band));
}

function parseShow({ file, meta, body, slug }: Frontmatter, publicDir: string) {
  const type = asTrimmedString(meta.type) || "show";
  if (!SHOW_TYPES.includes(type)) {
    fail("shows", file, `\`type\` must be one of: ${SHOW_TYPES.join(", ")}`);
  }

  const givenTitle = asTrimmedString(meta.title);
  const givenLineup = asStringArray(meta.lineup)
    .map((band) => band.trim())
    .filter(Boolean);

  /*
   * `lineup` is the whole bill, top billing first - a show is rarely one band,
   * and the openers are half the reason to go. A one-band night can still be
   * written as a bare `title`, which normalises to a lineup of one.
   *
   * A festival's `title` is the event, not a band, so it stays out of `lineup`
   * and therefore out of every band count downstream.
   */
  const lineup =
    type === "festival"
      ? givenLineup
      : givenLineup.length
        ? givenLineup
        : [givenTitle].filter(Boolean);

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
  const duo = meta.duo === true;

  if (solo && companions.length > 0) {
    fail("shows", file, "`solo: true` contradicts `with` - drop one");
  }
  if (duo && solo) {
    fail("shows", file, "`duo: true` contradicts `solo: true` - pick one");
  }
  if (duo && companions.length > 0) {
    fail(
      "shows",
      file,
      "`duo: true` contradicts `with` - a bigger night lists every name, hers included",
    );
  }

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
    // A frontmatter spelling, not an app field: src/lib/shows.ts expands it to
    // the partner's name in `companions` and strips it.
    duo,
    video,
    // A YouTube playlist URL is just a video URL with a `list` param, so the
    // link labels itself rather than needing a second field.
    videoIsPlaylist: /[?&]list=/.test(video),
    setlists: asSetlists(meta.setlists, file, lineup),
    photos: asPhotos("shows", meta.photos, file, publicDir),
    standout: meta.standout === true,
    body,
  };
}

interface Collection {
  /** Directory under `src/content/`, and the export name on the virtual module. */
  name: string;
  exportName: string;
  parse: (
    entry: Frontmatter,
    publicDir: string,
  ) => { date: string; title: string; draft?: boolean };
}

const COLLECTIONS: Collection[] = [
  { name: "blog", exportName: "posts", parse: parsePost },
  { name: "shows", exportName: "shows", parse: parseShow },
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

/** One validated comic. Mirrors `ComicEntry` in `src/lib/comics.ts`. */
interface ComicEntry {
  key: string;
  id: number;
  name: string;
  publisher: string;
  years: string;
  issues: number | null;
  price: string;
  released: string;
  url: string;
  cover: string;
}

/** One validated record. Mirrors `VinylRecord` in `src/lib/vinyl.ts`. */
interface VinylRecordJson {
  id: number;
  instanceId: number;
  owner: string | null;
  artist: string;
  title: string;
  year: number | null;
  label: string;
  catno: string;
  format: string;
  variant: string;
  genres: string[];
  styles: string[];
  added: string;
  rating: number;
  url: string;
  cover: string;
}

/**
 * The record collection, read from `src/content/vinyl.json` - written nightly
 * from Discogs by `scripts/update-vinyl.mjs` rather than typed by hand.
 *
 * It is generated, so the validation here is aimed at a different failure than
 * the markdown collections': not a typo, but a fetch that half-succeeded and
 * committed a payload with records missing their artist, or pointing at cover
 * files that were never written. Both would ship as a broken page, and both are
 * cheap to catch here.
 *
 * A missing file is not an error. The repo builds before the first fetch has
 * ever run, and the page renders its empty state - the same way an empty
 * content directory is a log with nothing in it rather than a broken build.
 */
function readVinyl(root: string, publicDir: string) {
  const file = path.resolve(root, "src/content/vinyl.json");
  const empty = {
    user: "",
    url: "",
    fetched: "",
    value: { minimum: "", median: "", maximum: "" },
    owners: [] as { id: string; name: string; count: number }[],
    records: [] as VinylRecordJson[],
  };

  if (!existsSync(file)) return empty;

  const fail = (message: string): never => {
    throw new Error(`Invalid vinyl payload - src/content/vinyl.json: ${message}`);
  };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return fail(`could not be parsed as JSON (${(error as Error).message})`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("must be a JSON object");
  }

  const owners = Array.isArray(payload.owners) ? (payload.owners as Record<string, unknown>[]) : [];
  for (const [index, owner] of owners.entries()) {
    if (!asTrimmedString(owner.id) || !asTrimmedString(owner.name)) {
      fail(`\`owners[${index}]\` needs an \`id\` and a \`name\``);
    }
  }
  const ownerIds = new Set(owners.map((owner) => asTrimmedString(owner.id)));

  const rawRecords = Array.isArray(payload.records)
    ? (payload.records as Record<string, unknown>[])
    : fail("`records` must be an array");

  const seen = new Set<number>();

  const records = rawRecords.map((record, index) => {
    const where = `\`records[${index}]\``;

    const instanceId = Number(record.instanceId);
    if (!Number.isInteger(instanceId)) fail(`${where} needs a numeric \`instanceId\``);
    // The instance id keys the list in React, so a duplicate would silently
    // drop a record from the page rather than render two.
    if (seen.has(instanceId)) fail(`${where} repeats \`instanceId\` ${instanceId}`);
    seen.add(instanceId);

    const artist = asTrimmedString(record.artist);
    const title = asTrimmedString(record.title);
    if (!artist) fail(`${where} has no \`artist\``);
    if (!title) fail(`${where} has no \`title\``);

    // `null` is a record in Discogs' Uncategorized folder, which is a real
    // state. A non-empty owner that names nobody is a bug in the fetch.
    const owner = record.owner == null ? null : asTrimmedString(record.owner);
    if (owner && !ownerIds.has(owner)) {
      fail(`${where} is owned by "${owner}", who is not in \`owners\``);
    }

    // A cover path that points at nothing would ship as a broken tile, exactly
    // like a mistyped photo path in a show.
    const cover = asTrimmedString(record.cover);
    if (cover && !existsSync(path.join(publicDir, cover))) {
      fail(`${where}.cover does not exist: public${cover}`);
    }

    return {
      id: Number(record.id) || 0,
      instanceId,
      owner: owner || null,
      artist,
      title,
      year: Number(record.year) || null,
      label: asTrimmedString(record.label),
      catno: asTrimmedString(record.catno),
      format: asTrimmedString(record.format),
      variant: asTrimmedString(record.variant),
      genres: asStringArray(record.genres),
      styles: asStringArray(record.styles),
      added: asTrimmedString(record.added),
      rating: Number(record.rating) || 0,
      url: asTrimmedString(record.url),
      cover,
    };
  });

  // Whole-collection figures, already formatted by Discogs with a currency
  // symbol. There is no per-owner breakdown to validate because there is no way
  // to get one - see the note in `scripts/update-vinyl.mjs`.
  const rawValue = (payload.value ?? {}) as Record<string, unknown>;

  return {
    user: asTrimmedString(payload.user),
    url: asTrimmedString(payload.url),
    fetched: asTrimmedString(payload.fetched),
    value: {
      minimum: asTrimmedString(rawValue.minimum),
      median: asTrimmedString(rawValue.median),
      maximum: asTrimmedString(rawValue.maximum),
    },
    // Counts are recomputed from the records rather than trusted, so a stale
    // count in the payload can never disagree with what the page lists.
    owners: owners.map((owner) => ({
      id: asTrimmedString(owner.id),
      name: asTrimmedString(owner.name),
      count: records.filter((record) => record.owner === asTrimmedString(owner.id)).length,
    })),
    records,
  };
}

/** One album's standout or skip. Mirrors `Track` in `src/lib/dan-fm.ts`. */
interface DanFmTrackJson {
  name: string;
  id: string;
}

/** One day's listen. Mirrors `Album` in `src/lib/dan-fm.ts`. */
interface DanFmAlbumJson {
  date: string;
  slug: string;
  ordinal: number;
  artist: string;
  album: string;
  year: number | null;
  yearIsPressing: boolean;
  genre: string;
  source: string;
  from: string;
  score: number;
  shelf: string;
  standout: DanFmTrackJson;
  skip: DanFmTrackJson;
  take: string;
  review: string;
  tags: string[];
  later: number | null;
  spotifyId: string;
  url: string;
  cover: string;
}

/**
 * A JSON object, narrowed rather than merely tested. Every reader here indexes
 * a field off a row the moment it has one, and `null` is a row shape a fetch
 * script produces by accident, so the alternative to narrowing is a
 * `TypeError` that names neither the file nor the row.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The day a row is filed under, or `null` for anything that is not one: a
 * `YYYY-MM-DD` string naming a date that exists.
 *
 * Shape is not enough. `2026-09-31` is a date no calendar has, and nothing
 * downstream would say so - it spells out as "September 31, 2026", the day
 * count reads it as October 1, and the station clock can never equal it, so
 * that album silently never airs. Round-tripped through `Date` rather than
 * range-checked by hand, which gets leap years right for free.
 */
function asLogDate(value: unknown): string | null {
  const date = asTrimmedString(value);
  if (!ISO_DATE.test(date)) return null;

  // A month of 13 parses to `NaN`, where `toISOString` throws rather than
  // returning something that fails the comparison.
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10) === date ? date : null;
}

/**
 * The year on a row, or `null` - which is the ordinary case, because the year
 * is hand-typed and often left out.
 *
 * Unreadable values are `null` too, and that is the deliberate difference from
 * `asHalfStep`, which fails the build on the same input. A score is what the
 * entry is for and a wrong one is worth stopping the build over; a year is a
 * detail the log routinely omits, so one cell nobody can read drops out rather
 * than holding the site at its last payload until someone edits a sheet. What
 * it will not do either way is coerce: `true` reaches `Number` as a clean 1,
 * and a year nobody typed prints beside the genre as though it were one.
 */
function asYear(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;

  const year = Number(value);
  return Number.isInteger(year) && year > 0 ? year : null;
}

/**
 * A slug the static host can actually serve. It is a URL path segment and a
 * file name at once, so `a/b` would be published as a nested path that answers
 * 404 rather than as one album, and a capital or a space would answer
 * differently depending on the host.
 */
const DAN_FM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A score the log can hold, or `null` for anything else: a half step from 1 to
 * `MAX_RATING`, written as a number or as the digits of one. The page draws the
 * score as a fractional fill, so a 3.7 would settle silently at a position the
 * scale does not offer rather than say anything about itself.
 *
 * The type check is not ceremony in front of `Number`. `true` and `[1]` both
 * coerce to a clean 1, and a payload holding either is a write that went wrong
 * rather than a record anyone scored - which is the whole class of damage this
 * guard exists to catch.
 */
function asHalfStep(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;

  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > MAX_RATING) return null;

  return (score * 2) % 1 === 0 ? score : null;
}

/**
 * A track name and the Spotify id it matched, both empty when the row left it
 * blank or nothing matched. Neither is required: an album with no favourite is
 * a real thing to have listened to.
 */
function danFmTrack(value: unknown): DanFmTrackJson {
  const raw = (value ?? {}) as Record<string, unknown>;
  return { name: asTrimmedString(raw.name), id: asTrimmedString(raw.id) };
}

/**
 * Whether the album log may fall back to its fixture: always in dev, and in a
 * build that asks for it by name.
 *
 * `DANFM_SEED` is how a build gets a populated log to render, because an empty
 * one draws none of the controls a browser sweep would have to find.
 * `deploy.yml` sets nothing, so the fixture never reaches production.
 *
 * Asking by name is different from merely allowing it, and the difference is
 * what keeps the fixture useful. A dev server allows it so `npm run dev` has
 * something to build against before the first fetch, and drops it the day a
 * real log arrives - the fixture retiring itself, which is what a person at a
 * dev server wants. A build that names `DANFM_SEED=1` is asking for the several
 * albums, the score over the tape's bar and the second review that the cases
 * sweeping it were written against, and the committed log is whatever the owner
 * happened to hear - on its first day, one album scoring 3.5. Let the real log
 * win there too and every one of those cases goes quiet the day the job runs,
 * without any of them failing.
 *
 * One rule for both plugins rather than the same expression written twice: the
 * bundle and the generated pages have to be built from the same log, and two
 * copies of this could disagree about which log that is.
 */
export type SeedRule = "forced" | "fallback" | "never";

export function seedsDanFm(command: "build" | "serve"): SeedRule {
  if (process.env.DANFM_SEED === "1") return "forced";
  return command === "serve" ? "fallback" : "never";
}

/**
 * The album log - one album a day, read from `src/content/dan-fm.json`, which
 * the scheduled job writes from a published sheet rather than anyone typing by
 * hand.
 *
 * Generated, so the validation here guards the failure `readVinyl` guards: a
 * fetch that half-succeeded and committed rows with no artist, an unscorable
 * score, or a cover pointing at a file that was never written.
 *
 * Three sources, in this order. A real payload always wins. Failing that,
 * `dan-fm.seed.json` stands in when `seed` is set - a hand-written fixture, so
 * that a build can be asked for a populated log instead of an empty one. An
 * empty log draws none of the controls a browser sweep would otherwise have to
 * find, which is the whole reason the fixture is here. Failing both, an empty
 * log, which is what the repo builds before the first fetch has ever run and
 * what the page renders its own empty state for.
 *
 * Two separate things keep the fixture off the live site: `deploy.yml` sets no
 * seed, and the precedence above retires the fixture on its own the day a real
 * payload lands.
 *
 * Exported for the reason `readShows` is: the build writes a real HTML page per
 * album, and it has to see exactly the log the bundle sees or it publishes
 * addresses the app answers with a redirect.
 *
 * Blank cells are the job's to normalise, not this reader's. A published sheet
 * exports an empty cell as "", so a job that passes cells through verbatim
 * writes `later: ""` and fails here rather than reading as absent. That is the
 * intended split: the payload is machine-written, and a reader that quietly
 * accepted "" as "no number" would accept it for `score` too, where there is no
 * absent to fall back on. The job writes `null`.
 */
export function readDanFm(root: string, publicDir: string, seed: SeedRule) {
  const empty = { url: "", fetched: "", albums: [] as DanFmAlbumJson[] };

  const real = "src/content/dan-fm.json";
  const fixture = "src/content/dan-fm.seed.json";

  // A build that names the fixture gets it; one that merely allows it falls
  // back to it. See `seedsDanFm` for why those are not the same question.
  let where = "";
  if (seed === "forced" && existsSync(path.resolve(root, fixture))) where = fixture;
  else if (existsSync(path.resolve(root, real))) where = real;
  else if (seed === "fallback" && existsSync(path.resolve(root, fixture))) where = fixture;
  else return empty;

  const fail = (message: string): never => invalid("dan.fm payload", where, message);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(readFileSync(path.resolve(root, where), "utf8"));
  } catch (error) {
    return fail(`could not be parsed as JSON (${(error as Error).message})`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("must be a JSON object");
  }

  const raw = Array.isArray(payload.albums)
    ? (payload.albums as unknown[])
    : fail("`albums` must be an array");

  const seenDates = new Set<string>();
  const seenSlugs = new Set<string>();

  const albums = raw.map((row, index) => {
    const at = `\`albums[${index}]\``;
    const entry = isRecord(row) ? row : fail(`${at} must be a JSON object`);

    const date =
      asLogDate(entry.date) ??
      fail(
        `${at} needs a \`date\` that is a real \`YYYY-MM-DD\` day, not ${JSON.stringify(entry.date)}`,
      );
    // The date is the log's key: one album a day is the whole format. Two rows
    // on one day would number every later album wrong and leave the page
    // showing one of them with no way to tell which.
    if (seenDates.has(date)) fail(`${at} repeats \`date\` ${date}`);
    seenDates.add(date);

    // The permalink and the React key both. A blank one collapses every album
    // onto the same address, and a repeated one collapses two of them.
    const slug = asTrimmedString(entry.slug);
    if (!slug) fail(`${at} has no \`slug\``);
    if (!DAN_FM_SLUG.test(slug)) fail(`${at} has a \`slug\` that is not a URL segment: "${slug}"`);
    // A slug opens with the date that was just proved unique, so a collision
    // means the job derived the slug wrongly rather than two albums clashing.
    // That is the failure worth catching, and the reason this check is not the
    // unreachable duplicate of the one above that it looks like.
    if (seenSlugs.has(slug)) fail(`${at} repeats \`slug\` "${slug}"`);
    seenSlugs.add(slug);

    const artist = asTrimmedString(entry.artist);
    const album = asTrimmedString(entry.album);
    if (!artist) fail(`${at} has no \`artist\``);
    if (!album) fail(`${at} has no \`album\``);

    const score =
      asHalfStep(entry.score) ??
      fail(
        `${at} needs a \`score\` of 1 to ${MAX_RATING} in half steps, not ${JSON.stringify(entry.score)}`,
      );

    // A second score after living with the record for a while. Absent is the
    // normal case and means "the first reading still stands".
    const later =
      entry.later == null
        ? null
        : (asHalfStep(entry.later) ??
          fail(
            `${at} needs a \`later\` of 1 to ${MAX_RATING} in half steps, not ${JSON.stringify(entry.later)}`,
          ));

    // A cover path pointing at nothing would ship as a broken tile, exactly
    // like a mistyped photo path in a show.
    const cover = asTrimmedString(entry.cover);
    if (cover && !existsSync(path.join(publicDir, cover))) {
      fail(`${at}.cover does not exist: public/${cover.replace(/^\/+/, "")}`);
    }

    const year = asYear(entry.year);

    return {
      date,
      slug,
      artist,
      album,
      year,
      // A pressing year is a claim about where the number came from, so it
      // cannot outlive the number itself.
      yearIsPressing: year != null && entry.yearIsPressing === true,
      genre: asTrimmedString(entry.genre),
      source: asTrimmedString(entry.source),
      from: asTrimmedString(entry.from),
      score,
      shelf: asTrimmedString(entry.shelf),
      standout: danFmTrack(entry.standout),
      skip: danFmTrack(entry.skip),
      take: asTrimmedString(entry.take),
      // Free text like `take`, and tolerated blank for the same reason: not
      // every album gets a piece written about it. Trimmed at the ends only -
      // the newlines inside are what the page splits into paragraphs.
      review: asTrimmedString(entry.review),
      tags: asStringArray(entry.tags)
        .map((tag) => tag.trim())
        .filter(Boolean),
      later,
      spotifyId: asTrimmedString(entry.spotifyId),
      url: asTrimmedString(entry.url),
      cover,
    };
  });

  return {
    url: asTrimmedString(payload.url),
    fetched: asTrimmedString(payload.fetched),
    // Numbered oldest-first and handed over newest-first: "day 1" counts up
    // from the first album, and every list on the page reads down from the most
    // recent. The ordinal is a position in the log rather than a field the file
    // carries, so a stale number can never disagree with the albums it counts -
    // the rule the vinyl payload's owner counts already follow.
    albums: [...albums]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry, index) => ({ ...entry, ordinal: index + 1 }))
      .reverse(),
  };
}

/**
 * The comics, read from `src/content/comics.json` - written nightly from League
 * of Comic Geeks by `scripts/update-comics.mjs` rather than typed by hand.
 *
 * Generated, so this guards the same failure `readVinyl` does, and one more.
 * That payload comes from an API; this one comes from parsing someone else's
 * HTML, which can succeed, return the expected number of `<li>`s, and still hand
 * back entries with every field empty because the markup moved. So a title is
 * required per entry rather than merely hoped for - a page of untitled tiles is
 * the exact shape that failure takes.
 *
 * A missing file is not an error. The repo builds before the first fetch has
 * ever run, and the page renders its empty state.
 */
function readComics(root: string, publicDir: string) {
  const file = path.resolve(root, "src/content/comics.json");
  const empty = {
    user: "",
    url: "",
    fetched: "",
    publishers: [] as { name: string; count: number }[],
    series: [] as ComicEntry[],
    pullList: [] as ComicEntry[],
    wants: [] as ComicEntry[],
  };

  if (!existsSync(file)) return empty;

  const fail = (message: string): never => {
    throw new Error(`Invalid comics payload - src/content/comics.json: ${message}`);
  };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return fail(`could not be parsed as JSON (${(error as Error).message})`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("must be a JSON object");
  }

  const seen = new Set<string>();

  const readList = (name: "series" | "pullList" | "wants"): ComicEntry[] => {
    const raw = Array.isArray(payload[name])
      ? (payload[name] as Record<string, unknown>[])
      : fail(`\`${name}\` must be an array`);

    return raw.map((entry, index) => {
      const where = `\`${name}[${index}]\``;

      // The cover filename is keyed on this, and it keys the list in React, so
      // a duplicate would silently drop a tile rather than render two.
      const key = asTrimmedString(entry.key);
      if (!key) fail(`${where} needs a \`key\``);
      if (seen.has(key)) fail(`${where} repeats \`key\` "${key}"`);
      seen.add(key);

      const title = asTrimmedString(entry.name);
      if (!title) fail(`${where} has no \`name\` - the parse found the row but not its title`);

      // A cover path pointing at nothing would ship as a broken tile, exactly
      // like a mistyped photo path in a show.
      const cover = asTrimmedString(entry.cover);
      if (cover && !existsSync(path.join(publicDir, cover))) {
        fail(`${where}.cover does not exist: public${cover}`);
      }

      const issues = Number(entry.issues);

      return {
        key,
        id: Number(entry.id) || 0,
        name: title,
        publisher: asTrimmedString(entry.publisher),
        years: asTrimmedString(entry.years),
        issues: Number.isInteger(issues) && issues > 0 ? issues : null,
        price: asTrimmedString(entry.price),
        released: asTrimmedString(entry.released),
        url: asTrimmedString(entry.url),
        cover,
      };
    });
  };

  /*
   * Publisher totals as the endpoint reports them, weighted by issues owned
   * rather than by runs. Recomputing them from `series` would give a different
   * and worse number - one per run rather than one per comic - so they are
   * carried through and only sanity-checked.
   */
  const rawPublishers = Array.isArray(payload.publishers)
    ? (payload.publishers as Record<string, unknown>[])
    : [];

  const publishers = rawPublishers.map((entry, index) => {
    const name = asTrimmedString(entry.name);
    const count = Number(entry.count);
    if (!name) fail(`\`publishers[${index}]\` needs a \`name\``);
    if (!Number.isInteger(count) || count <= 0) {
      fail(`\`publishers[${index}]\` needs a positive whole \`count\``);
    }
    return { name, count };
  });

  return {
    user: asTrimmedString(payload.user),
    url: asTrimmedString(payload.url),
    fetched: asTrimmedString(payload.fetched),
    publishers,
    series: readList("series"),
    pullList: readList("pullList"),
    wants: readList("wants"),
  };
}

/** One playlist's numbers. Mirrors `ModeStats` in `src/lib/fortnite.ts`. */
interface FortniteModeJson {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  kd: number;
  winRate: number;
  killsPerMatch: number;
  top3: number;
  top5: number;
  top6: number;
  top10: number;
  top12: number;
  top25: number;
  minutesPlayed: number;
  score: number;
  playersOutlived: number;
}

type FortniteSnapshotJson = Record<string, FortniteModeJson | null> & {
  overall: FortniteModeJson;
};

/** One season of the calendar. Mirrors `Season` in `src/lib/fortnite.ts`. */
interface FortniteSeasonJson {
  key: string;
  chapter: string;
  season: string;
  /** "" until a human names it - auto-appended entries arrive without one. */
  name: string;
  label: string;
  start: string;
  /**
   * Exclusive - the day the next season began. Null while the season is still
   * running, which only the newest entry is allowed to be.
   */
  end: string | null;
  /**
   * Epic's sequential season number, the identity the nightly job files stats
   * under. Null on entries that predate the stamp.
   */
  backendValue: number | null;
  main: { name: string; id: string; image: string; style: string } | null;
}

/**
 * The season calendar, from `src/content/fortnite-seasons.json`.
 *
 * Written by two hands: the nightly job appends a bare entry at each season
 * rollover - key, chapter, season, start, `backendValue`, no name and no end -
 * and a human fills in the name and the outfit afterwards. It carries what
 * Epic's stats endpoint will never tell you: what the season was called, when
 * it ran, and which outfit got worn all season.
 *
 * Filing is by `backendValue` now, not by date, so the dates here are
 * presentation rather than routing - still strict, because the page prints
 * the range, but a typo mislabels a tab instead of mis-filing a month of
 * matches. What stays load-bearing is the shape: at most one entry may leave
 * `end` open and it must be the newest, because "still running" is a claim
 * only one season can make.
 *
 * `end` is exclusive: it is the day the *next* season started, which is how
 * every public season table writes them and what makes consecutive ranges meet
 * exactly rather than leaving a day in neither.
 */
function readFortniteSeasons(root: string, publicDir: string): FortniteSeasonJson[] {
  const where = "src/content/fortnite-seasons.json";
  const file = path.resolve(root, where);
  if (!existsSync(file)) return [];

  const fail = (message: string): never => {
    throw new Error(`Invalid Fortnite season calendar - ${where}: ${message}`);
  };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return fail(`could not be parsed as JSON (${(error as Error).message})`);
  }

  const raw = Array.isArray(payload?.seasons)
    ? (payload.seasons as Record<string, unknown>[])
    : fail("`seasons` must be an array");

  const seen = new Set<string>();
  const stamps = new Map<number, string>();

  const seasons = raw.map((season, index) => {
    const at = `\`seasons[${index}]\``;

    const key = asTrimmedString(season.key);
    if (!key) fail(`${at} needs a \`key\``);
    if (seen.has(key)) fail(`${at} repeats \`key\` "${key}"`);
    seen.add(key);

    const required = (field: "chapter" | "season") => {
      const value = asTrimmedString(season[field]);
      if (!value) fail(`${at} needs a \`${field}\``);
      return value;
    };

    const date = (field: "start" | "end") => {
      const value = asTrimmedString(season[field]);
      if (!ISO_DATE.test(value)) fail(`${at}.${field} must be a \`YYYY-MM-DD\` date`);
      return value;
    };

    const start = date("start");

    // Absent while the season is still running - the nightly job appends new
    // entries open-ended and closes them at the next rollover. Whether an open
    // end is legitimate is a cross-entry question, answered after the map.
    const end = season.end == null ? null : date("end");
    if (end !== null && end <= start) fail(`${at} ends on or before it starts`);

    // Epic's sequential season number, stamped by the nightly job when it
    // appends an entry and worth adding to hand-written ones - it is the
    // identity stats are filed under, so a duplicate would merge two seasons.
    let backendValue: number | null = null;
    if (season.backendValue != null) {
      const value = Number(season.backendValue);
      if (!Number.isInteger(value) || value <= 0) {
        fail(`${at}.backendValue must be a positive integer`);
      }
      const holder = stamps.get(value);
      if (holder) fail(`${at} repeats \`backendValue\` ${value}, which "${holder}" already has`);
      stamps.set(value, key);
      backendValue = value;
    }

    let main: FortniteSeasonJson["main"] = null;
    if (season.main != null) {
      const entry = season.main as Record<string, unknown>;
      const name = asTrimmedString(entry.name);
      if (!name) fail(`${at}.main needs a \`name\``);

      const image = asTrimmedString(entry.image);
      // An outfit with no render yet is fine - the name is the fact, and
      // `scripts/fetch-fortnite-skins.mjs` fills the rest in. A path that
      // points at nothing is not fine, and is the failure this catches: the
      // page would render a broken image and the build would say nothing.
      if (image && !existsSync(path.join(publicDir, image))) {
        fail(`${at}.main.image "${image}" is not in the public directory`);
      }

      main = {
        name,
        id: asTrimmedString(entry.id),
        image,
        // The style on screen, e.g. "Voidburn Jade". Written by
        // `fetch-fortnite-skins.mjs` and absent when the render is the outfit's
        // default, since repeating the name says nothing.
        style: asTrimmedString(entry.style),
      };
    }

    const chapter = required("chapter");
    const number = required("season");

    return {
      key,
      chapter,
      season: number,
      // "" is legitimate: Epic names a season after the job has already
      // appended its entry, so the name arrives when a human notices.
      name: asTrimmedString(season.name),
      // Derived rather than stored, so the calendar cannot end up with a label
      // that disagrees with the chapter and season sitting next to it.
      label: `${chapter} ${number}`,
      start,
      end,
      backendValue,
      main,
    };
  });

  // At most one season may be open-ended, and it must be the newest - "still
  // running" is a claim only one season can make, and never about the past.
  const open = seasons.filter((season) => season.end === null);
  if (open.length > 1) {
    fail(
      `only the newest season may omit \`end\`, but ${open.map((s) => `"${s.key}"`).join(", ")} all do`,
    );
  }
  const newestStart = seasons.reduce((max, s) => (s.start > max ? s.start : max), "");
  if (open.length === 1 && open[0].start < newestStart) {
    fail(`"${open[0].key}" omits \`end\` but is not the newest season - close it`);
  }

  // Newest first, which is the order the file is written in and the order the
  // page shows. Sorted rather than trusted, so a season inserted in the wrong
  // place in the file still lands in the right place on the page.
  return seasons.sort((a, b) => b.start.localeCompare(a.start));
}

/**
 * The Fortnite stats, read from `src/content/fortnite.json` - written nightly
 * from Fortnite-API by `scripts/update-fortnite.mjs` rather than typed by hand.
 *
 * Generated, so this guards the failure that payload actually has: a window the
 * API answered with a body but no usable numbers, which would render a page of
 * zeroes that reads as "played 0 matches" rather than as "the fetch broke". A
 * snapshot with no `overall`, or an `overall` with no matches, is that failure.
 *
 * The season list is the part worth being strict about, because it accumulates:
 * every night rewrites one entry and carries the rest through, so a duplicate or
 * an unlabelled key is a bug that would compound for months before anyone
 * noticed the page had two "Chapter 7 Season 2" tabs.
 *
 * A missing file is not an error. The repo builds before the first fetch has
 * ever run, and the page renders its empty state.
 */
function readFortnite(root: string, publicDir: string) {
  const calendar = readFortniteSeasons(root, publicDir);

  /** The calendar with no numbers against it, which is what a season nobody
   * has played, or a repo that has never fetched, both look like. */
  const unplayed = calendar.map((season) => ({
    ...season,
    first: "",
    fetched: "",
    source: "",
    stats: null as FortniteSnapshotJson | null,
  }));

  const file = path.resolve(root, "src/content/fortnite.json");
  if (!existsSync(file)) {
    return {
      name: "",
      accountId: "",
      fetched: "",
      lifetime: null as FortniteSnapshotJson | null,
      seasons: unplayed,
    };
  }

  const fail = (message: string): never => {
    throw new Error(`Invalid Fortnite payload - src/content/fortnite.json: ${message}`);
  };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return fail(`could not be parsed as JSON (${(error as Error).message})`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("must be a JSON object");
  }

  const MODES = ["overall", "solo", "duo", "trio", "squad"] as const;

  const readMode = (raw: unknown, where: string): FortniteModeJson | null => {
    if (raw == null) return null;
    if (typeof raw !== "object" || Array.isArray(raw)) fail(`${where} must be an object or null`);

    const entry = raw as Record<string, unknown>;
    const matches = Number(entry.matches);
    if (!Number.isFinite(matches) || matches <= 0) {
      fail(`${where} needs a positive \`matches\` - a mode with none should be null`);
    }

    const num = (field: keyof FortniteModeJson) => {
      const value = Number(entry[field]);
      if (!Number.isFinite(value)) fail(`${where}.${field} is not a number`);
      return value;
    };

    /*
     * Numbers that cannot happen, whatever produced them.
     *
     * "Is it a number" is too weak a question. A half-broken backfill can write
     * a season with more wins than matches - a negative death count and a win
     * rate over 100% - and every one of those is a finite number that this
     * reader would pass straight through for the page to render. A stat board is
     * only worth anything if it refuses to show figures that are arithmetically
     * impossible.
     */
    const wins = num("wins");
    if (wins > matches) {
      fail(
        `${where} has ${wins} wins in ${matches} matches, which cannot happen - ` +
          `the numbers that produced it are wrong, not just surprising`,
      );
    }

    const deaths = num("deaths");
    if (deaths < 0) fail(`${where} has ${deaths} deaths`);

    const winRate = num("winRate");
    if (winRate < 0 || winRate > 100) {
      fail(`${where} has a win rate of ${winRate}%`);
    }

    for (const field of ["kills", "kd", "killsPerMatch", "minutesPlayed"] as const) {
      if (num(field) < 0) fail(`${where}.${field} is negative`);
    }

    return {
      matches,
      wins,
      kills: num("kills"),
      deaths,
      kd: num("kd"),
      winRate,
      killsPerMatch: num("killsPerMatch"),
      top3: num("top3"),
      top5: num("top5"),
      top6: num("top6"),
      top10: num("top10"),
      top12: num("top12"),
      top25: num("top25"),
      minutesPlayed: num("minutesPlayed"),
      score: num("score"),
      playersOutlived: num("playersOutlived"),
    };
  };

  const readSnapshot = (raw: unknown, where: string): FortniteSnapshotJson => {
    if (!raw || typeof raw !== "object") fail(`${where} must be an object`);
    const entry = raw as Record<string, unknown>;

    const overall = readMode(entry.overall, `${where}.overall`);
    if (!overall)
      fail(`${where} needs an \`overall\` - a window with no matches is not worth a tab`);

    const snapshot = { overall } as FortniteSnapshotJson;
    for (const name of MODES) {
      if (name === "overall") continue;
      snapshot[name] = readMode(entry[name] ?? null, `${where}.${name}`);
    }
    return snapshot;
  };

  const rawSeasons = Array.isArray(payload.seasons)
    ? (payload.seasons as Record<string, unknown>[])
    : fail("`seasons` must be an array");

  const seen = new Set<string>();
  const known = new Set(calendar.map((season) => season.key));

  const recorded = new Map(
    rawSeasons.map((season, index) => {
      const where = `\`seasons[${index}]\``;

      const key = asTrimmedString(season.key);
      if (!key) fail(`${where} needs a \`key\``);
      // The key tabs the page and keys the list in React, so a duplicate would
      // render two tabs that look identical and show one of them.
      if (seen.has(key)) fail(`${where} repeats \`key\` "${key}"`);
      seen.add(key);

      // Everything the page prints about a season other than its numbers - the
      // name, the dates, the outfit - comes from the calendar. A recorded key
      // with no calendar entry has nowhere to get any of it, and would drop off
      // the page silently rather than loudly.
      if (!known.has(key)) {
        fail(`${where} has key "${key}", which src/content/fortnite-seasons.json does not list`);
      }

      return [
        key,
        {
          first: asTrimmedString(season.first),
          fetched: asTrimmedString(season.fetched),
          source: asTrimmedString(season.source),
          stats: readSnapshot(season.stats, `${where}.stats`),
        },
      ] as const;
    }),
  );

  return {
    name: asTrimmedString(payload.name),
    accountId: asTrimmedString(payload.accountId),
    fetched: asTrimmedString(payload.fetched),
    lifetime: payload.lifetime ? readSnapshot(payload.lifetime, "`lifetime`") : null,
    // The calendar drives the order and the membership. A season with no
    // numbers still gets an entry, because it is still a season that was played
    // in an outfit worth showing - the page draws it without a stat board.
    seasons: unplayed.map((season) => ({
      ...season,
      ...(recorded.get(season.key) ?? {}),
    })),
  };
}

/** One now entry, current or archived. Mirrors `NowEntry` in `src/lib/now.ts`. */
interface NowEntry {
  updated: string;
  body: string;
  /** Derived rather than redeclared, so it cannot drift from what `asPhotos` returns. */
  photos: ReturnType<typeof asPhotos>;
}

/** Parses and validates one now entry. */
function parseNowEntry(raw: string, file: string, publicDir: string): NowEntry {
  const { meta, body } = splitFrontmatter("now", file, raw);

  const updated = asDate(meta.updated);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) {
    fail("now", file, "frontmatter needs an `updated` date in `YYYY-MM-DD` form");
  }

  if (!body) fail("now", file, "the entry has no body");

  /*
   * A body is not the same as prose. An entry made of nothing but a heading, an
   * image, or a fenced code block has a body and no paragraphs, and paragraphs
   * are what the description, the tab, and the share card are all read from -
   * so it would ship with an empty `<meta name="description">`, which is not a
   * degraded preview but the entry sent with nothing said about it.
   */
  if (nowParagraphs(body).length === 0) {
    fail("now", file, "the entry has no prose - it needs at least one paragraph to describe it");
  }

  // The same rules every other collection's photos get: `alt` and `caption`
  // both required, and a local `src` has to exist. Nothing about a now entry
  // makes them looser, so nothing here is a second set of checks.
  return { updated, body, photos: asPhotos("now", meta.photos, file, publicDir) };
}

/**
 * The now page: every entry in `src/content/now/`, one file per entry named
 * for its `updated` date. The newest is what `/now` shows; the rest are the
 * timeline under it. A new entry is a new file, and a correction is an edit to
 * an existing one - nothing moves files around, because the folder is the
 * whole record.
 *
 * `updated` is required and load-bearing. A now page with no date on it is just
 * an about page, and the reader has no way to tell whether "at the moment" means
 * this week or two years ago. It is also each entry's identity, so two entries
 * sharing a date fail the build rather than printing the same day twice.
 *
 * A missing folder is not an error, the same way an empty content directory is
 * a log with nothing in it. The page renders its empty state instead.
 *
 * Exported for the same reason `readShows` is: the build writes a real HTML
 * page per entry and must see exactly what the app sees. No return annotation -
 * it is inferred from the local `NowEntry` above, because the app's `NowEntry`
 * imports `virtual:now` and cannot be named from the Node side.
 */
export function readNow(root: string, publicDir: string) {
  const dir = path.resolve(root, "src/content/now");
  const files = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    : [];

  const entries = files
    .map((name) => ({
      file: name,
      entry: parseNowEntry(readFileSync(path.join(dir, name), "utf8"), name, publicDir),
    }))
    // Newest first, the way every other collection here sorts.
    .sort((a, b) => b.entry.updated.localeCompare(a.entry.updated));

  /*
   * The date is the entry's identity - the sort key and the label on the page -
   * so two entries sharing one would be the same day printed twice. The
   * likeliest way it happens is a second file saved on a day that already has
   * one instead of editing it, and the fix is deciding which file is the entry.
   */
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].entry.updated === entries[i - 1].entry.updated) {
      fail(
        "now",
        entries[i].file,
        `is dated the same day as ${entries[i - 1].file} - one of them is a duplicate`,
      );
    }
  }

  const [current, ...archive] = entries.map(({ entry }) => entry);

  return { current: current ?? { updated: "", body: "", photos: [] }, archive };
}

/**
 * The blog posts, parsed the same way the app sees them. Exported for the
 * reason `readShows` is: the build writes a real HTML page per post and a
 * second parser would drift out of step with this one.
 *
 * Drafts come back with everything else. The only draft filter in this file is
 * in `load`, which is what keeps them out of the shipped bundle - a caller that
 * turns these into URLs has to drop them itself, or the build hands an unfinished
 * post to every crawler that reads the sitemap.
 */
export function readPosts(root: string, publicDir: string) {
  const collection = COLLECTIONS.find((entry) => entry.name === "blog")!;
  return readCollection(
    collection,
    path.resolve(root, "src/content/blog"),
    publicDir,
  ) as ReturnType<typeof parsePost>[];
}

/**
 * The published shows, parsed the same way the app sees them. Exported so the
 * build can write a real HTML page per show without a second parser drifting
 * out of step with this one.
 */
export function readShows(root: string, publicDir: string) {
  const collection = COLLECTIONS.find((entry) => entry.name === "shows")!;
  return readCollection(
    collection,
    path.resolve(root, "src/content/shows"),
    publicDir,
  ) as ReturnType<typeof parseShow>[];
}

/**
 * A path under `public/img/` as the source writes one.
 *
 * Anchored on the delimiter that opens it, which is what tells a reference from
 * a mention: an attribute value, a string literal, and the space between two
 * `srcset` candidates all start one, while `public/img/...` in a sentence does
 * not.
 *
 * The run is captured whole, punctuation and interpolations alike; the class
 * simply stops at `$`, and `checkablePath` below decides how much of what it
 * captured names something. This check is a build gate, so a false
 * positive costs as much as a miss - it fails everybody's build over a sentence
 * nobody can rewrite their way out of.
 */
export const SOURCE_IMAGE = /(?<=["'`\s(])\/img\/[\w./-]*/g;

/**
 * How much of a matched run names something `public/` can be asked for, or null
 * where none of it does.
 *
 * A dot is a separator that owes an extension, so a run ending on one with
 * nothing after it has met a sentence's full stop rather than a name - the
 * pattern is greedy, so anything path-shaped would already be part of the run.
 * The stop is dropped and the name underneath it is checked, which is the point:
 * `/img/me1.webp.` in a comment still names a file that can go missing.
 *
 * A run stopping mid-token is the other thing, and it is not checkable at all.
 * `/img/me1-` is how a joined string and the fixed half of a template both look,
 * and `/img/me1` is not a file anybody meant. The folder around it is all that
 * is knowable, and it is worth keeping - `/img/vinyl/${id}.webp` names the
 * folder every cover in that grid comes from, and a rename there loses the lot.
 *
 * A run ending at a slash is neither. It is the folder, and it is checked as
 * one.
 */
function checkablePath(run: string, rest: string): string | null {
  if (!rest.startsWith("${")) {
    const name = run.replace(/\.$/, "");
    if (!name.endsWith("-")) return name;
  }

  const folder = run.slice(0, run.lastIndexOf("/") + 1);
  return folder === "/img/" ? null : folder;
}

/**
 * Fails the build for an image the source names and `public/` does not have.
 *
 * Every collection's photos are checked as they are parsed, but the hero and its
 * preload, the about and career photos, and the share cards are written straight
 * into JSX and `index.html`, where no parser sees them. Without this a deleted
 * file ships as a broken image with its alt text showing, and the build says
 * nothing.
 */
export function checkSourceImages(root: string, publicDir: string) {
  const src = path.resolve(root, "src");
  const files = [
    path.resolve(root, "index.html"),
    ...readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => path.join(src, name)),
  ];

  for (const file of files) {
    const text = readFileSync(file, "utf8");

    for (const match of text.matchAll(SOURCE_IMAGE)) {
      const image = checkablePath(match[0], text.slice(match.index + match[0].length));
      if (image === null || existsSync(path.join(publicDir, image))) continue;
      invalid("image path", path.relative(root, file), `does not exist: public${image}`);
    }
  }
}

/**
 * Reads and validates everything under `src/content/` at build time and exposes
 * each collection as a virtual module: the markdown ones as `virtual:blog` and
 * `virtual:shows`, and the generated record collection as `virtual:vinyl`.
 *
 * Doing this in Node rather than in the browser buys three things the runtime
 * version could not: malformed frontmatter fails the build instead of the live
 * page, `draft: true` entries are genuinely absent from the production bundle
 * rather than merely filtered out after shipping, and the YAML parser never
 * reaches the client.
 *
 * The image paths written into the source rather than into content are checked
 * here too, so one file answers whether every picture the site names is a
 * picture it ships.
 */
export function contentPlugin(): Plugin {
  const dirs = new Map<string, string>();
  let root = "";
  let publicDir = "";
  let includeDrafts = false;
  let seedDanFm: SeedRule = "never";

  /**
   * Pages with their own virtual module rather than the `Collection` shape.
   * The record collection is generated JSON rather than hand-written markdown,
   * and the now folder splits into `{ current, archive }` rather than a flat
   * list, because the page treats the newest entry differently from the rest.
   */
  const VINYL = "vinyl";
  const NOW = "now";
  const COMICS = "comics";
  const FORTNITE = "fortnite";
  const DAN_FM = "dan-fm";

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
      root = config.root;
      publicDir = config.publicDir;
      includeDrafts = config.command === "serve";
      seedDanFm = seedsDanFm(config.command);
    },

    // Once per build and once per dev server start, rather than inside `load`:
    // nothing imports `index.html` or `about.tsx` as content, so no virtual
    // module's graph would ever reach them.
    buildStart() {
      checkSourceImages(root, publicDir);
    },

    resolveId(id) {
      for (const single of [VINYL, NOW, COMICS, FORTNITE, DAN_FM]) {
        if (id === virtualId(single)) return resolvedId(single);
      }
      const collection = COLLECTIONS.find((entry) => id === virtualId(entry.name));
      return collection ? resolvedId(collection.name) : null;
    },

    load(id) {
      if (id === resolvedId(VINYL)) {
        return `export const vinyl = ${JSON.stringify(readVinyl(root, publicDir))};`;
      }
      if (id === resolvedId(NOW)) {
        return `export const now = ${JSON.stringify(readNow(root, publicDir))};`;
      }
      if (id === resolvedId(COMICS)) {
        return `export const comics = ${JSON.stringify(readComics(root, publicDir))};`;
      }
      if (id === resolvedId(FORTNITE)) {
        return `export const fortnite = ${JSON.stringify(readFortnite(root, publicDir))};`;
      }
      if (id === resolvedId(DAN_FM)) {
        return `export const danFm = ${JSON.stringify(readDanFm(root, publicDir, seedDanFm))};`;
      }

      const collection = COLLECTIONS.find((entry) => id === resolvedId(entry.name));
      return collection ? load(collection) : null;
    },

    configureServer(server) {
      // Editing, adding, or deleting an entry should refresh the browser.
      const invalidate = (file: string) => {
        const reload = (name: string) => {
          const module = server.moduleGraph.getModuleById(resolvedId(name));
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: "full-reload" });
        };

        // A local run of the Discogs fetch should show up without a restart.
        if (file === path.resolve(root, "src/content/vinyl.json")) return reload(VINYL);
        // A local run of the comics fetch should show up without a restart too.
        if (file === path.resolve(root, "src/content/comics.json")) return reload(COMICS);
        // Same for a local run of the Fortnite fetch, and for hand-edits to the
        // season calendar beside it.
        if (
          file === path.resolve(root, "src/content/fortnite.json") ||
          file === path.resolve(root, "src/content/fortnite-seasons.json")
        )
          return reload(FORTNITE);
        // The album log, and the fixture standing in for it until the first
        // fetch - editing either in dev should show up without a restart.
        if (
          file === path.resolve(root, "src/content/dan-fm.json") ||
          file === path.resolve(root, "src/content/dan-fm.seed.json")
        )
          return reload(DAN_FM);

        if (!file.endsWith(".md")) return;

        // The trailing separator keeps a future `src/content/now-*` sibling
        // from matching the prefix.
        if (file.startsWith(path.resolve(root, "src/content/now") + path.sep)) return reload(NOW);

        const collection = COLLECTIONS.find((entry) => file.startsWith(dirs.get(entry.name)!));
        if (!collection) return;

        return reload(collection.name);
      };

      server.watcher.on("add", invalidate);
      server.watcher.on("change", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}
