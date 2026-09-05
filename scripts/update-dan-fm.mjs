/**
 * Refreshes the album log in `src/content/dan-fm.json` from a published Google
 * Sheet: one row a day, one album a day.
 *
 * The sheet is the only interface. Every field is typed there and nothing else
 * writes this file, so an album is added, corrected or withdrawn by editing a
 * row and waiting for the next run.
 *
 * Why it is read here rather than from the browser is the answer the other
 * fetched pages give. The site's one standing promise is that nothing phones
 * home except the visitor counter, which `tests/links.spec.ts` asserts on every
 * run. And the payload is validated at build time by `vite-plugin-content.ts`,
 * which can only happen to a file that is in the repo.
 *
 * ## Reading the sheet
 *
 * By header name, never by column position, so inserting a column in the sheet
 * cannot silently shift every field one to the left. Every name in `COLUMNS`
 * has to be present or the run fails before a single row is trusted; extra
 * columns are ignored, because adding a helper column to a spreadsheet should
 * not take the site down.
 *
 * A sheet that is no longer published answers 200 with a page of HTML, and that
 * is caught by the parse rather than by the header check: the first quoted
 * attribute in the markup is not valid CSV, so it fails before any header is
 * compared. The header check is for a body that does parse and is simply not
 * this log. Both name the sheet, and neither writes anything.
 *
 * ## What stops a run
 *
 * A row the log cannot take stops the whole run: nothing is written, the
 * committed payload stands, and the page keeps showing what it showed before.
 * Every problem is reported at once rather than one per run, because a run
 * happens every four hours and finding typos one at a time would take a day.
 *
 * An empty log is not one of those problems. It is where the log starts, and a
 * job that treated it as a failed read would be red every four hours until the
 * first album. What is refused is an empty log while a payload with albums in
 * it is committed, which is a broken read rather than an edit - deleting one
 * mistyped row is an edit, and is written out as one.
 *
 * ## Blank cells
 *
 * Normalised here, not by the reader. A published sheet exports an empty cell
 * as "", so a job that passed cells through verbatim would write `later: ""`
 * and fail the build, which `vite-plugin-content.ts` documents as deliberate:
 * a reader that accepted "" as "no number" for `later` would have to accept it
 * for `score`, where there is no absent to fall back on. Absent is `null` or
 * "" as the payload's own shape requires, decided here.
 *
 * ## Cover art
 *
 * A sleeve is fetched from Spotify once and kept in `public/img/dan-fm/`, keyed
 * by the album id the Link column already carries. An album whose sleeve is
 * already on disk costs no request at all, and that check runs before a
 * credential is so much as read: an outage, a fork of this repo, or a secret
 * that went missing can therefore never take a cover away from an album that
 * has one.
 *
 * The id is looked up directly and nothing is ever searched for. A search
 * matches artist and album as free text and answers confidently with the wrong
 * record, and a wrong sleeve is worse than none: the page would be stating
 * something untrue about the album rather than admitting it has no picture. So
 * a row with no Link gets no cover, permanently, and that is the right answer.
 *
 * Covers are an enhancement and never a precondition, which is why every way
 * this half can fail - no credential, a token refused, a 404, a fetch that dies
 * - is a line on stdout and a blank `cover` rather than anything louder. The
 * log is written either way.
 *
 * Run it the way CI does:
 *
 *   node scripts/update-dan-fm.mjs
 *
 * The sheet is published to the web, so reading the log needs no credential.
 * `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are what buy the sleeves, and
 * a run without them writes the same log with whatever sleeves are already
 * saved. Get a pair at https://developer.spotify.com/dashboard - the album
 * endpoint is a public read, so the app needs no scopes and no redirect URI.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";

import { parse } from "csv-parse/sync";
import { fromMarkdown } from "mdast-util-from-markdown";
import sharp from "sharp";

const ACCOUNTS = new URL("../src/content/accounts.json", import.meta.url);
const OUT_JSON = new URL("../src/content/dan-fm.json", import.meta.url);
const COVER_DIR = new URL("../public/img/dan-fm/", import.meta.url);
/** Where the site serves what `COVER_DIR` holds. */
const COVER_PATH = "/img/dan-fm";

/** Spotify's token exchange and its Web API, as their documentation names them. */
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

/**
 * The widest sleeve Spotify offers. The front page lays one out at 352 CSS px,
 * so this covers a 2x screen with a little to spare, and nothing is ever
 * enlarged past the size that actually came back.
 */
const COVER_PX = 640;

/**
 * Matching what the vinyl and comics grids write theirs at, so a sleeve on this
 * page is not visibly softer or crisper than a sleeve on those.
 */
const COVER_QUALITY = 82;

/**
 * Every column the job needs to find. `Stars` and `Streak` are read and thrown
 * away - the score is the number that counts, and the streak counts something
 * the payload does not carry - but they are named here anyway, because their
 * absence means the header being looked at is not this log's.
 */
const COLUMNS = [
  "Date",
  "Artist",
  "Album",
  "Link",
  "Year",
  "Genre",
  "Source",
  "From",
  "Score",
  "Stars",
  "Shelf",
  "Standout",
  "Skip",
  "Take",
  "Review",
  "Tag1",
  "Tag2",
  "Tag3",
  "Later",
  "Streak",
];

/** The top of the scale, mirroring `MAX_RATING` in `src/lib/shows.ts`. */
const MAX_SCORE = 5;

/**
 * The log's first day. A row before it is a mistyped year rather than a
 * backfill: a daily log started on a date is never extended backwards past its
 * own start.
 *
 * This is a day the sheet was still empty, so it is the earliest date any row
 * could honestly carry. Move it forward to the date of the first row once the
 * log has one, which tightens the bound to the truth. It never moves backwards.
 *
 * There is no tolerated band in the past the way there is in the future. A past
 * date is publishable the moment it is read, so there is nothing to hold back;
 * the asymmetry between the two bounds is deliberate.
 */
const LOG_EPOCH = "2026-08-31";

/**
 * How far ahead a row may be dated and still be a plan rather than a typo.
 * Logging a day or two ahead is reasonable and must not turn the job red;
 * a row dated next year is a mistyped year and has to be said out loud, or it
 * would sit outside the payload forever with nothing reporting it.
 */
const FUTURE_DAYS = 7;

/**
 * The station's clock, mirroring `SITE_TIME_ZONE` in `src/lib/site.ts`.
 *
 * The runner's day is UTC, which is already tomorrow through the whole
 * California evening. Measuring "ahead of today" against that would publish a
 * row dated tomorrow as soon as it was typed.
 */
const SITE_TIME_ZONE = "America/Los_Angeles";

const STATION_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** How much of the artist and album a slug carries before it is cut short. */
const SLUG_NAME_MAX = 60;

/**
 * A Spotify album id: exactly 22 characters, pinned rather than matched
 * loosely.
 *
 * Spelled once because two things have to agree on it. It is what a link is
 * read for, and it is the name a saved sleeve takes - so the prune below can
 * recognise a file this job wrote by its shape alone, and a shape that had
 * drifted between the two would leave sleeves nothing ever clears.
 */
const ALBUM_ID = "[A-Za-z0-9]{22}";

/**
 * A Spotify album link, and the id inside it. `intl-de` and friends appear in a
 * share link copied from a localised client and address the same album.
 */
const ALBUM_LINK = new RegExp(
  `^https://open\\.spotify\\.com/(?:intl-[a-z-]+/)?album/(${ALBUM_ID})$`,
);

/**
 * A sleeve this job saved. The prune deletes what matches this and nothing
 * else, so `spotify-logo.svg` and the fixture sleeves a seeded build draws are
 * not files a run that has never heard of them can remove.
 */
const COVER_FILE = new RegExp(`^${ALBUM_ID}\\.webp$`);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The station's current day, which is the one the log is filed against. */
function stationDate() {
  return STATION_DAY.format(new Date());
}

/**
 * A `YYYY-MM-DD` naming a day that exists. Round-tripped through `Date` rather
 * than range-checked by hand, which gets leap years right for free and rejects
 * `2026-09-31`: a date no calendar has and the station clock can never equal,
 * so an album filed under it never airs.
 */
function isLogDate(value) {
  if (!ISO_DATE.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A day some number of days after another, as `YYYY-MM-DD`. */
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** One cell, trimmed. Missing and blank are the same thing in a spreadsheet. */
function cell(row, column) {
  return (row[column] ?? "").trim();
}

/**
 * A score the scale can hold, or `null`: a quarter step from 1 to `MAX_SCORE`.
 * The page draws a score as a fractional fill, so a 3.7 would settle silently
 * at a position the scale does not offer rather than say anything about itself.
 */
function asQuarterStep(text) {
  const score = Number(text);
  if (!Number.isFinite(score) || score < 1 || score > MAX_SCORE) return null;

  return (score * 4) % 1 === 0 ? score : null;
}

/*
 * ---- The markdown contract, mirrored --------------------------------------
 *
 * The one spelling lives in `src/lib/dan-fm-markdown.ts`, which the build
 * validator imports; this file cannot (its spec stages the script standalone
 * with only `node_modules` beside it), so the rules are mirrored here the way
 * `asQuarterStep` above mirrors the build's. `tests/markdown-cases.ts` holds
 * the two in step: a construct decision landing on one side without the other
 * fails the other side's spec. Bare CommonMark on both sides - no GFM - so
 * parity needs no extension bookkeeping.
 */

/** Protocols a link may carry, plus site-relative paths starting `/`. */
const LINK_OK = /^(?:https:|http:|mailto:|\/(?!\/))/;

/** The node's first source line, for quoting back at the author. */
function quotedSource(text, node) {
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? start;
  const line = text.slice(start, end).split("\n", 1)[0].trim();
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

/** Every node in the tree, document order, depth first. */
function walkMarkdown(nodes, visit) {
  for (const node of nodes) {
    visit(node);
    if (node.children) walkMarkdown(node.children, visit);
  }
}

/** What a Review cell may not carry. Empty means valid, blank included. */
function reviewProblems(text) {
  const problems = [];

  walkMarkdown(fromMarkdown(text).children, (node) => {
    if (node.type === "heading") {
      problems.push(
        `holds a heading ("${quotedSource(text, node)}"). The log's markdown is emphasis, links, lists and quotes.`,
      );
    } else if (node.type === "image" || node.type === "imageReference") {
      problems.push(
        `holds an image ("${quotedSource(text, node)}"). A pasted picture either leaves the origin or answers 404; the cover is the album's picture.`,
      );
    } else if (node.type === "html") {
      problems.push(
        `holds raw HTML ("${quotedSource(text, node)}"), which the page would silently skip rather than render.`,
      );
    } else if (node.type === "code") {
      problems.push(
        `holds a code block ("${quotedSource(text, node)}") - a fence, or four leading spaces, reads as code. Write plain text flush left.`,
      );
    } else if (node.type === "thematicBreak") {
      problems.push(
        `holds a "---" divider, which would render as a bare rule the page never styles.`,
      );
    } else if (node.type === "break") {
      problems.push(
        `holds a hard line break (two trailing spaces or a backslash before the newline) - invisible syntax in a cell that shows no trailing whitespace.`,
      );
    } else if (node.type === "link" || node.type === "definition") {
      if (!LINK_OK.test(node.url)) {
        problems.push(
          `links to "${node.url}", which is not a link the page will carry. A link is https:, http:, mailto:, or a path starting "/".`,
        );
      }
    }
  });

  return problems;
}

/** A Take is one sentence: a Review's rules plus blocks and second paragraphs. */
function takeProblems(text) {
  const problems = reviewProblems(text);
  const tree = fromMarkdown(text);

  walkMarkdown(tree.children, (node) => {
    if (node.type === "list") {
      problems.push(`holds a list, and a take is one sentence. The long piece belongs in Review.`);
    } else if (node.type === "blockquote") {
      problems.push(`holds a quote, and a take is one sentence. The long piece belongs in Review.`);
    } else if (node.type === "definition") {
      problems.push(
        `holds a link definition ("${quotedSource(text, node)}"). Reference-style links belong in Review, where they have room.`,
      );
    }
  });

  const paragraphs = tree.children.filter((node) => node.type === "paragraph").length;
  if (paragraphs > 1) {
    problems.push(
      `holds a blank line, and a take is one paragraph. The long piece belongs in Review.`,
    );
  }

  return problems;
}

/** Every link target in a cell - `link` and `definition` URLs, document order. */
function markdownLinks(text) {
  const urls = [];
  walkMarkdown(fromMarkdown(text).children, (node) => {
    if (node.type === "link" || node.type === "definition") urls.push(node.url);
  });
  return urls;
}

/**
 * Whether any paragraph spans a lone newline. The old contract split
 * paragraphs on every line; markdown keeps a single break inside its
 * paragraph, so this is the one habit worth a warning without turning the
 * job red - the `Year` treatment.
 */
function holdsLoneNewline(text) {
  let found = false;
  walkMarkdown(fromMarkdown(text).children, (node) => {
    if (node.type !== "paragraph" || !node.position) return;
    if (text.slice(node.position.start.offset, node.position.end.offset).includes("\n")) {
      found = true;
    }
  });
  return found;
}

/** A name reduced to the characters a URL segment may hold. */
function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The album's address: the date it is filed under, then as much of the artist
 * and album as fits. The date carries the uniqueness - one album a day, checked
 * before this is called - so the name part is free to be cut short, and a name
 * that reduces to nothing at all (a title in a script this drops entirely)
 * leaves a slug that is just the date rather than one that is empty.
 */
function albumSlug(date, artist, album) {
  const name = `${slugify(artist)}-${slugify(album)}`
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_NAME_MAX)
    .replace(/-+$/, "");

  return name ? `${date}-${name}` : date;
}

/** The published sheet's own page, which is the CSV export minus the export. */
function asSheetPage(csvUrl) {
  const url = new URL(csvUrl);
  url.searchParams.delete("output");
  return url.toString();
}

/**
 * The published sheet as text, decoded as UTF-8 - which drops a byte-order mark
 * if the export ever carries one, so nothing downstream has to. Anything short
 * of a clean read throws, naming the sheet.
 */
async function fetchSheet(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: "text/csv" } });
  } catch (error) {
    throw new Error(
      `could not reach the published sheet (${error.cause?.message ?? error.message})`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new Error(
      `the published sheet answered ${response.status}. Check that it is still published to ` +
        "the web, under File > Share > Publish to web.",
    );
  }

  // The body is read inside the guard too. A connection that drops after the
  // headers throws from here rather than from `fetch`, and unguarded it reaches
  // the top of the file as a bare "terminated" that names neither the sheet nor
  // the cause.
  try {
    return await response.text();
  } catch (error) {
    throw new Error(
      `the published sheet stopped sending part-way through ` +
        `(${error.cause?.message ?? error.message})`,
      { cause: error },
    );
  }
}

/**
 * The sheet's data rows, each paired with the line it ends on so a problem can
 * name where to go and fix it. Read by header name, and nothing is trusted
 * before every expected name has been found.
 */
function readRows(csv) {
  let header = null;

  let rows;
  try {
    rows = parse(csv, {
      // Called once with the header row, before any record exists, so an empty
      // sheet still proves its header. Left null only when the body had no
      // first line at all.
      columns: (found) => {
        header = found;
        return found;
      },
      info: true,
      skip_empty_lines: true,
      // A row whose width does not match the header is one row's problem, and
      // the parser's default is to throw on the first one - which would abort
      // before any row is checked and report a single line number instead of
      // everything wrong with the sheet. Relaxed, a short row arrives with its
      // trailing cells absent, which reads as blank and joins the same
      // collected report as any other blank. A row wider than the header drops
      // what has no column name, which is the rule the header already follows.
      relax_column_count: true,
    });
  } catch (error) {
    throw new Error(`the sheet could not be parsed as CSV (${error.message})`, { cause: error });
  }

  if (!header) throw new Error("the sheet came back empty - not even a header row");

  const missing = COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(
      `the sheet is missing ${missing.length === 1 ? "a column" : "columns"}: ` +
        `${missing.join(", ")}. What came back begins "${header.join(",").slice(0, 120)}".`,
    );
  }

  return rows;
}

/** How many albums are committed right now, which is what a shrink is measured against. */
async function committedAlbumCount() {
  if (!existsSync(OUT_JSON)) return 0;

  let payload;
  try {
    payload = JSON.parse(await readFile(OUT_JSON, "utf8"));
  } catch (error) {
    throw new Error(`src/content/dan-fm.json is not readable JSON (${error.message})`, {
      cause: error,
    });
  }

  return Array.isArray(payload.albums) ? payload.albums.length : 0;
}

/**
 * Every row turned into an album, with the ones that cannot be turned into one
 * collected rather than thrown at.
 *
 * Three outcomes, and the difference between the first two is whether the sheet
 * needs editing. A problem is a mistake only a person can settle, so the run
 * fails and the last good payload keeps serving. A row dated ahead of today is
 * not a mistake - it is simply not true yet - so it is held back rather than
 * published, and the first run on or after its date picks it up. Everything
 * else the sheet leaves blank is recorded as blank.
 */
function collectAlbums(rows, today) {
  const albums = [];
  const problems = [];
  const warnings = [];
  const held = [];
  const filed = new Map();
  // Internal links are resolved after the loop, because a review may point at
  // an album further down the sheet - the whole sheet is the address book.
  const sheetSlugs = new Set();
  const internalLinks = [];

  const horizon = addDays(today, FUTURE_DAYS);

  for (const { record, info } of rows) {
    const at = `line ${info.lines}`;
    const before = problems.length;

    const date = cell(record, "Date");
    if (!date) {
      problems.push(`${at}: no Date. Every album is filed under the day it was heard.`);
    } else if (!isLogDate(date)) {
      problems.push(`${at}: Date "${date}" is not a real YYYY-MM-DD day.`);
    } else if (filed.has(date)) {
      problems.push(
        `${at}: Date ${date} is already used on ${filed.get(date)}, and the log takes one album a day.`,
      );
    } else if (date < LOG_EPOCH) {
      problems.push(
        `${at}: Date ${date} is before the log began on ${LOG_EPOCH}, so it is a mistyped year rather than a backfill.`,
      );
    } else if (date > horizon) {
      problems.push(
        `${at}: Date ${date} is more than ${FUTURE_DAYS} days after ${today}, so it is a mistyped year rather than a plan.`,
      );
    } else {
      // Filed before the rest of the row is checked, and filed even for a day
      // still to come: the day is taken either way, and a second row on it is
      // the same mistake whichever row is the good one.
      filed.set(date, at);
    }

    const artist = cell(record, "Artist");
    if (!artist) problems.push(`${at}: no Artist.`);

    const album = cell(record, "Album");
    if (!album) problems.push(`${at}: no Album.`);

    const scoreText = cell(record, "Score");
    const score = asQuarterStep(scoreText);
    if (!scoreText) {
      problems.push(
        `${at}: no Score. An album in the log is one that has been listened to and rated.`,
      );
    } else if (score === null) {
      problems.push(`${at}: Score "${scoreText}" is not a quarter step from 1 to ${MAX_SCORE}.`);
    }

    // A second reading after living with the record. Blank is the ordinary
    // case and means the first one still stands, but a number that is not on
    // the scale is a typo worth stopping for rather than dropping: nothing
    // downstream would ever say it had been ignored.
    const laterText = cell(record, "Later");
    const later = laterText ? asQuarterStep(laterText) : null;
    if (laterText && later === null) {
      problems.push(`${at}: Later "${laterText}" is not a quarter step from 1 to ${MAX_SCORE}.`);
    }

    // Everything from "?" on is Spotify's share tracking, and it is not part of
    // the album's address.
    const link = cell(record, "Link");
    const url = link.split(/[?#]/)[0].replace(/\/$/, "");
    const spotifyId = ALBUM_LINK.exec(url)?.[1] ?? "";
    if (link && !spotifyId) {
      problems.push(
        `${at}: Link "${link}" is not a Spotify album link. Paste the album's share link, or leave the cell empty.`,
      );
    }

    // A year is hand-typed and routinely left out, so an unreadable one drops
    // to blank rather than holding the whole log at its last payload. That is
    // the deliberate difference from a score, which is what the entry is for.
    const yearText = cell(record, "Year");
    const typedYear = Number(yearText);
    const year = Number.isInteger(typedYear) && typedYear > 0 ? typedYear : null;
    if (yearText && year === null) {
      warnings.push(
        `${at}: Year "${yearText}" is not a year, so the album is recorded without one.`,
      );
    }

    const take = cell(record, "Take");
    const takeTrouble = takeProblems(take);
    for (const problem of takeTrouble) problems.push(`${at}: Take ${problem}`);

    const review = cell(record, "Review");
    const reviewTrouble = reviewProblems(review);
    for (const problem of reviewTrouble) problems.push(`${at}: Review ${problem}`);

    // Only for a review the run is otherwise taking: a cell already being
    // refused has louder things to say than a merged paragraph.
    if (reviewTrouble.length === 0 && holdsLoneNewline(review)) {
      warnings.push(
        `${at}: Review holds a single line break, which stays inside its paragraph - leave a blank line to start a new one.`,
      );
    }

    for (const url of markdownLinks(take)) internalLinks.push({ at, field: "Take", url });
    for (const url of markdownLinks(review)) internalLinks.push({ at, field: "Review", url });

    if (problems.length > before) continue;

    // Filed for the link check even when held: a review may name a day still
    // to come, and by publication time the slug answers.
    const slug = albumSlug(date, artist, album);
    sheetSlugs.add(slug);

    if (date > today) {
      held.push(date);
      continue;
    }

    albums.push({
      date,
      slug,
      artist,
      album,
      year,
      // Nothing here asks a release database anything, so every year in the
      // payload is the one that was typed.
      yearIsPressing: false,
      genre: cell(record, "Genre"),
      source: cell(record, "Source"),
      from: cell(record, "From"),
      score,
      shelf: cell(record, "Shelf"),
      standout: { name: cell(record, "Standout"), id: "" },
      skip: { name: cell(record, "Skip"), id: "" },
      take: cell(record, "Take"),
      // The long piece, and free text like `take`. A cell holding several
      // paragraphs is the ordinary case, so `cell`'s trim at the ends is
      // deliberately all that happens to it - the newlines inside are what the
      // page splits on.
      review: cell(record, "Review"),
      tags: [
        ...new Set(["Tag1", "Tag2", "Tag3"].map((column) => cell(record, column)).filter(Boolean)),
      ],
      later,
      spotifyId,
      url,
      cover: "",
    });
  }

  /*
   * The one rule build-time validation cannot check for the sheet: an
   * internal album link has to name a row, and only the sheet knows its
   * rows. The nightly job commits and deploys without Playwright, so this
   * gate is the only one real content passes.
   */
  for (const { at, field, url } of internalLinks) {
    const target = url.split(/[?#]/)[0];
    const match = /^\/dan-fm\/(.+)$/.exec(target);
    if (match && !sheetSlugs.has(match[1])) {
      problems.push(`${at}: ${field} links to "${url}", which no row in the sheet answers to.`);
    }
  }

  return { albums, problems, warnings, held };
}

/**
 * The Spotify token this run uses, as a promise so it is asked for at most
 * once. Two albums missing a sleeve would otherwise each open their own token
 * exchange, and the second buys nothing the first did not already have.
 *
 * `null` is "not asked yet". An empty string is the settled answer "no token
 * this run", which every caller reads as "no cover today" rather than as a
 * failure.
 */
let tokenRequest = null;

function accessToken() {
  tokenRequest ??= requestToken();
  return tokenRequest;
}

/**
 * One Client Credentials exchange: the pair as HTTP Basic, the grant in the
 * body, which is the shape Spotify's own tutorial documents.
 *
 * Everything is reported on stdout rather than stderr. A run with no covers is
 * a working run - it reads the sheet and writes the log exactly as it always
 * did - and colouring it red would train everyone to ignore a job that is right
 * to be red about the log itself.
 */
async function requestToken() {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim();
  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!id || !secret) {
    console.log(
      "dan-fm: no SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET, so no sleeve is fetched. " +
        "Saved ones are untouched.",
    );
    return "";
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.log(`dan-fm: Spotify answered ${response.status} to the token request`);
      return "";
    }

    const payload = await response.json();
    const granted = typeof payload.access_token === "string" ? payload.access_token : "";
    if (!granted) console.log("dan-fm: Spotify's token response carried no access_token");

    return granted;
  } catch (error) {
    console.log(`dan-fm: could not reach Spotify for a token (${error.message})`);
    return "";
  }
}

/**
 * The widest image Spotify holds for one album, or "" for an album it will not
 * answer for.
 *
 * By id, never by search. A search matches artist and album as free text and
 * answers confidently with the wrong record, which would print a false claim
 * about the album rather than leave a square empty.
 */
async function coverSource(spotifyId, token) {
  let payload;

  try {
    const response = await fetch(`${API_URL}/albums/${spotifyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.log(`dan-fm: Spotify answered ${response.status} for album ${spotifyId}`);
      return "";
    }

    payload = await response.json();
  } catch (error) {
    console.log(`dan-fm: could not reach Spotify for album ${spotifyId} (${error.message})`);
    return "";
  }

  // Documented as widest first, and compared by width anyway: the widths are
  // nullable in the same response, so an order taken on trust is one a missing
  // number quietly reverses. The documented first entry is the fallback for a
  // response that gives no widths at all.
  const images = Array.isArray(payload.images) ? payload.images : [];
  const widest = images.reduce(
    (best, image) => ((image?.width ?? 0) > (best?.width ?? 0) ? image : best),
    images[0] ?? null,
  );

  if (typeof widest?.url !== "string" || !widest.url) {
    console.log(`dan-fm: Spotify has no cover art for album ${spotifyId}`);
    return "";
  }

  return widest.url;
}

/**
 * The sleeve for one album, fetched once and kept.
 *
 * The file on disk is checked first and answers on its own, before a credential
 * is read or a token asked for. That order is the whole guarantee: a run where
 * every album already has its sleeve makes no Spotify request at all, so no
 * outage and no missing secret can cost an album a cover it already has.
 *
 * Anything that goes wrong returns "", which draws the placeholder the card
 * already has for an album with no link, and the next run tries again.
 */
async function saveCover(spotifyId) {
  const name = `${spotifyId}.webp`;
  const file = new URL(name, COVER_DIR);
  if (existsSync(file)) return `${COVER_PATH}/${name}`;

  // Neither of the two returns below says anything of its own: each has
  // already put its reason on stdout, once for the token and once for the
  // album, and repeating it here would say it twice per missing sleeve.
  const token = await accessToken();
  if (!token) return "";

  const source = await coverSource(spotifyId, token);
  if (!source) return "";

  try {
    const response = await fetch(source);
    if (!response.ok) {
      console.log(`dan-fm: the sleeve for ${spotifyId} answered ${response.status}`);
      return "";
    }

    const encoded = await sharp(Buffer.from(await response.arrayBuffer()))
      // Sleeves are square already, and `cover` is what holds that true for one
      // that is not, rather than letterboxing it into a grid of squares.
      .resize(COVER_PX, COVER_PX, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: COVER_QUALITY })
      // Encoded whole before anything is written, so a download that will not
      // decode leaves no file at all. Half a file would pass the build's
      // existence gate and ship as a broken tile that nothing ever retries.
      .toBuffer();

    await writeFile(file, encoded);
    console.log(`dan-fm: saved the sleeve for ${spotifyId}`);

    return `${COVER_PATH}/${name}`;
  } catch (error) {
    console.log(`dan-fm: could not save the sleeve for ${spotifyId} (${error.message})`);
    return "";
  }
}

/**
 * Sleeves for albums the sheet no longer carries.
 *
 * Only a file named the way this job names one is ever deleted, which is what
 * lets the directory hold anything else: Spotify's mark, and the fixture
 * sleeves a seeded build draws, neither of which the log will ever name.
 */
async function pruneCovers(albums) {
  const wanted = new Set(albums.map((album) => `${album.spotifyId}.webp`));

  for (const name of await readdir(COVER_DIR)) {
    if (COVER_FILE.test(name) && !wanted.has(name)) {
      await unlink(new URL(name, COVER_DIR));
      console.log(`dan-fm: pruned ${name}`);
    }
  }
}

async function main() {
  const accounts = JSON.parse(await readFile(ACCOUNTS, "utf8"));
  const sheet = accounts.danFmSheet?.trim();

  if (!sheet) {
    throw new Error("no `danFmSheet` in src/content/accounts.json");
  }

  const rows = readRows(await fetchSheet(sheet));
  const today = stationDate();
  const { albums, problems, warnings, held } = collectAlbums(rows, today);

  for (const warning of warnings) console.warn(`dan-fm: ${warning}`);

  if (problems.length > 0) {
    throw new Error(
      `the sheet has ${problems.length} ${problems.length === 1 ? "problem" : "problems"}. ` +
        "The committed log stands, so the page is showing whatever it last read.\n  " +
        problems.join("\n  "),
    );
  }

  if (held.length > 0) {
    console.warn(
      `dan-fm: ${held.length} ${held.length === 1 ? "row is" : "rows are"} dated ahead of ` +
        `${today} and held back until then: ${held.sort().join(", ")}`,
    );
  }

  // An empty log is measured after the rows are read rather than before, so a
  // sheet holding nothing but days still to come is the same case as a sheet
  // holding nothing at all.
  if (albums.length === 0) {
    const committed = await committedAlbumCount();
    if (committed > 0) {
      throw new Error(
        `the sheet has nothing on or before ${today} while ${committed} ` +
          `${committed === 1 ? "album is" : "albums are"} committed. That is a read that went ` +
          "wrong rather than an edit, so the committed log stands.",
      );
    }

    // Deliberately no file. An empty payload says nothing the absence of one
    // does not already say, and committing one would take precedence over
    // `dan-fm.seed.json` and leave a seeded build looking at an empty page.
    console.log(`dan-fm: nothing logged on or before ${today}. Writing nothing.`);
    return;
  }

  // Newest first, the order every list on the page reads in. The ordinal is not
  // written: the build derives it from position, so a number in the file could
  // only ever disagree with the albums it counts.
  albums.sort((a, b) => b.date.localeCompare(a.date));

  await mkdir(COVER_DIR, { recursive: true });

  // Serially, because the first missing sleeve is what buys the token every
  // later one spends, and firing them together would open a token exchange per
  // album instead.
  for (const album of albums) {
    if (album.spotifyId) album.cover = await saveCover(album.spotifyId);
  }

  // Only ever alongside a write. A run that decided to leave the committed log
  // alone has no business deleting the art that log points at.
  await pruneCovers(albums);

  const payload = {
    // The same sheet asked for as a page rather than as a CSV, which is where
    // the source line under the page sends a reader.
    url: asSheetPage(sheet),
    /** UTC, so the line reads the same for everyone who sees it. */
    fetched: new Date().toISOString().slice(0, 10),
    albums,
  };

  await writeFile(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `dan-fm: wrote ${albums.length} ${albums.length === 1 ? "album" : "albums"} to ` +
      "src/content/dan-fm.json",
  );
}

try {
  await main();
} catch (error) {
  /*
   * Loud, and a non-zero exit, the same way the other fetch jobs fail. Warning
   * and returning 0 makes a run that read nothing look exactly like a run where
   * nothing had changed: a green tick, no commit, and a page quietly getting
   * older.
   */
  console.error(`dan-fm: ${error.message}`);
  process.exit(1);
}
