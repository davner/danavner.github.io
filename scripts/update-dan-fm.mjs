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
 * Run it the way CI does:
 *
 *   node scripts/update-dan-fm.mjs
 *
 * No credential. The sheet is published to the web, so this is a public read.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { parse } from "csv-parse/sync";

const ACCOUNTS = new URL("../src/content/accounts.json", import.meta.url);
const OUT_JSON = new URL("../src/content/dan-fm.json", import.meta.url);

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
 * A Spotify album link, and the id inside it. `intl-de` and friends appear in a
 * share link copied from a localised client and address the same album.
 *
 * The id is exactly 22 characters, which is worth pinning rather than matching
 * loosely: it is the name a saved cover file takes, and the prune that clears
 * covers the log does not name recognises them by that shape alone.
 */
const ALBUM_LINK = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]{22})$/;

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
 * A score the scale can hold, or `null`: a half step from 1 to `MAX_SCORE`.
 * The page draws a score as a fractional fill, so a 3.7 would settle silently
 * at a position the scale does not offer rather than say anything about itself.
 */
function asHalfStep(text) {
  const score = Number(text);
  if (!Number.isFinite(score) || score < 1 || score > MAX_SCORE) return null;

  return (score * 2) % 1 === 0 ? score : null;
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
    const score = asHalfStep(scoreText);
    if (!scoreText) {
      problems.push(
        `${at}: no Score. An album in the log is one that has been listened to and rated.`,
      );
    } else if (score === null) {
      problems.push(`${at}: Score "${scoreText}" is not a half step from 1 to ${MAX_SCORE}.`);
    }

    // A second reading after living with the record. Blank is the ordinary
    // case and means the first one still stands, but a number that is not on
    // the scale is a typo worth stopping for rather than dropping: nothing
    // downstream would ever say it had been ignored.
    const laterText = cell(record, "Later");
    const later = laterText ? asHalfStep(laterText) : null;
    if (laterText && later === null) {
      problems.push(`${at}: Later "${laterText}" is not a half step from 1 to ${MAX_SCORE}.`);
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

    if (problems.length > before) continue;

    if (date > today) {
      held.push(date);
      continue;
    }

    albums.push({
      date,
      slug: albumSlug(date, artist, album),
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

  return { albums, problems, warnings, held };
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
