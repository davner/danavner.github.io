import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { MAX_SCORE } from "../src/lib/dan-fm-summary";
import { contentPlugin } from "../vite-plugin-content";

import type { AddressInfo } from "node:net";
import type { DanFmPayload } from "../src/lib/dan-fm";

/**
 * The scheduled job, checked where it actually runs: as a process, against a
 * sheet it fetches, writing a file.
 *
 * `scripts/update-dan-fm.mjs` exports nothing and runs its work on import, so
 * the command line is its whole surface and the exit code is half of what CI
 * reads from it. Every case here copies the script into a throwaway tree and
 * runs that copy. The script resolves both `src/content/accounts.json` and its
 * own output relative to `import.meta.url`, so the copy reads and writes the
 * throwaway tree and cannot reach the repo - which is what makes it safe to
 * assert on a job whose whole point is overwriting a committed file.
 *
 * Nothing here reaches Google. The sheet is a loopback server on a port the
 * kernel picked, which is also the only way to say what a 404, a dropped
 * connection, or a page of HTML does.
 */

/** The job, and the source the two policy constants below are read out of. */
const SCRIPT = path.resolve("scripts", "update-dan-fm.mjs");
const SOURCE = readFileSync(SCRIPT, "utf8");

/**
 * A policy constant, read from the script rather than copied into this file.
 *
 * Both of them are documented as movable: `LOG_EPOCH` is meant to be dragged
 * forward to the first row's date once the log has one, and the horizon is a
 * judgement about how far ahead a plan is still a plan. A suite that spelled
 * either out would go red on a deliberate edit and say nothing about it, so the
 * cases below assert what happens *at* the boundary and let the boundary move.
 */
function policy(name: string, shape: RegExp): string {
  const found = shape.exec(SOURCE);
  if (!found) {
    throw new Error(`scripts/update-dan-fm.mjs no longer declares ${name} in the shape this reads`);
  }

  return found[1];
}

const LOG_EPOCH = policy("LOG_EPOCH", /^const LOG_EPOCH = "(\d{4}-\d{2}-\d{2})";$/m);
const FUTURE_DAYS = Number(policy("FUTURE_DAYS", /^const FUTURE_DAYS = (\d+);$/m));

/** A day some number of days after another, for building fixtures around today. */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The station day every case is frozen on: far enough in to have a past and a future. */
const TODAY = addDays(LOG_EPOCH, 3);

/** The last day a row may be dated and still be held back rather than refused. */
const HORIZON = addDays(TODAY, FUTURE_DAYS);

/**
 * An instant on a station day.
 *
 * 19:00 UTC is the middle of the California morning whichever side of the clock
 * change it falls on, so the UTC date and the station date are the same day and
 * a case can name one date and mean both.
 */
function at(day: string, time = "19:00:00"): string {
  return `${day}T${time}Z`;
}

/**
 * Freezes the clock in the child, at the instant `DAN_FM_NOW` names.
 *
 * The job reads the wall clock twice, once for the day rows are filed against
 * and once for the `fetched` stamp, so a case that left it running would mean
 * something different tomorrow: the row dated "tomorrow" quietly becomes the
 * row dated "today" and the case that proved a holdback stops proving it.
 * Only the no-argument construction moves - every parsed or arithmetic date is
 * the real one - so nothing the job does to a date it read is affected.
 */
const CLOCK = `
const FROZEN = Date.parse(process.env.DAN_FM_NOW);
if (Number.isNaN(FROZEN)) throw new Error("DAN_FM_NOW is not an instant");

const Real = Date;

globalThis.Date = class extends Real {
  constructor(...args) {
    super(...(args.length === 0 ? [FROZEN] : args));
  }

  static now() {
    return FROZEN;
  }
};
`;

/**
 * Every column the sheet has to carry, spelled out rather than read from the
 * script.
 *
 * This is the one place a copy is the point. The list is a contract with a
 * spreadsheet a person keeps by hand, so a column the job started requiring has
 * to fail this suite until the fixtures below say the sheet grew it.
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
] as const;

/** A row of the sheet, by the names the columns carry. */
type Row = Partial<Record<(typeof COLUMNS)[number], string>>;

/** A row the job takes, for a case to break one cell of. */
function row(over: Row = {}): Row {
  return {
    Date: TODAY,
    Artist: "The Standing Wave",
    Album: "Low Tide Signals",
    Score: "4",
    ...over,
  };
}

/** The slug the job gives {@link row}, which every case that keeps its name expects. */
const SLUG = "the-standing-wave-low-tide-signals";

/**
 * The album a row with nothing in it but the cells the log requires produces.
 *
 * Shared rather than written out twice, because it is the claim two separate
 * cases make: a row whose trailing cells are empty and a row whose trailing
 * cells were never sent at all have to arrive at the same album, or a sheet
 * with a ragged row in it means something different from the sheet it looks
 * like.
 */
function blankAlbum(date: string): Record<string, unknown> {
  return {
    date,
    slug: `${date}-${SLUG}`,
    artist: "The Standing Wave",
    album: "Low Tide Signals",
    year: null,
    yearIsPressing: false,
    genre: "",
    source: "",
    from: "",
    score: 4,
    shelf: "",
    standout: { name: "", id: "" },
    skip: { name: "", id: "" },
    take: "",
    review: "",
    tags: [],
    later: null,
    spotifyId: "",
    url: "",
    cover: "",
  };
}

/** A row written out at a width of its own, for the cases about ragged rows. */
function ragged(...cells: string[]): string {
  return `${cells.map(field).join(",")}\n`;
}

/** One CSV field, quoted only when it holds something that would end it early. */
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** A sheet body under a header of its own, for the cases about the header. */
function bodyUnder(header: readonly string[], rows: Row[], eol = "\n"): string {
  const cells = (entry: Row) => header.map((name) => (entry as Record<string, string>)[name] ?? "");

  return [header, ...rows.map(cells)].map((line) => line.map(field).join(",")).join(eol) + eol;
}

/** A published sheet: the header the job insists on, then the rows. */
function sheet(...rows: Row[]): string {
  return bodyUnder(COLUMNS, rows);
}

/** How a case answers, and what the tree it runs against already holds. */
interface How {
  /** The CSV the published sheet answers with. */
  body?: string;
  /** The status to answer with, for a sheet that is not readable. */
  status?: number;
  /** Hang up before answering at all, which is what a dropped connection looks like. */
  hangUp?: boolean;
  /** Answer, then hang up part way through the body, which is a truncated read. */
  truncate?: boolean;
  /** The instant to freeze the station's clock at. */
  now?: string;
  /** `src/content/dan-fm.json` as already committed, or absent for a repo without one. */
  committed?: string;
  /** `src/content/accounts.json`, for the cases about the sheet's address. */
  accounts?: string;
}

/** What one run of the job did. */
interface Ran {
  code: number | null;
  stdout: string;
  stderr: string;
  /** `src/content/dan-fm.json` as the job left it, or `null` when it wrote none. */
  written: string | null;
}

/** The published sheet's address, carrying the export parameter a real one carries. */
function sheetUrl(port: number): string {
  return `http://127.0.0.1:${port}/pub?gid=46855817&single=true&output=csv`;
}

/** Runs the job once over a tree of its own, and reports everything it left behind. */
async function run(how: How = {}): Promise<Ran> {
  const root = mkdtempSync(path.join(tmpdir(), "dan-fm-job-"));
  const server = createServer((_request, response) => {
    if (how.hangUp) {
      response.socket?.destroy();
      return;
    }

    if (how.truncate) {
      // A length that promises more than arrives, so the read fails rather
      // than ending early and looking like a shorter sheet.
      response.writeHead(200, { "content-type": "text/csv", "content-length": "4096" });
      response.write(how.body ?? "");
      setTimeout(() => response.socket?.destroy(), 20);
      return;
    }

    response.writeHead(how.status ?? 200, { "content-type": "text/csv" });
    response.end(how.body ?? "");
  });

  try {
    await new Promise<void>((resolve) => void server.listen(0, "127.0.0.1", resolve));

    // The job's `csv-parse` import resolves from the copy's own directory, so
    // the tree needs the repo's modules rather than a second install of them.
    symlinkSync(path.resolve("node_modules"), path.join(root, "node_modules"), "dir");

    mkdirSync(path.join(root, "scripts"));
    copyFileSync(SCRIPT, path.join(root, "scripts", "update-dan-fm.mjs"));
    writeFileSync(path.join(root, "clock.mjs"), CLOCK);

    const content = path.join(root, "src", "content");
    mkdirSync(content, { recursive: true });
    writeFileSync(
      path.join(content, "accounts.json"),
      how.accounts ??
        JSON.stringify({ danFmSheet: sheetUrl((server.address() as AddressInfo).port) }),
    );
    if (how.committed !== undefined) {
      writeFileSync(path.join(content, "dan-fm.json"), how.committed);
    }

    const child = spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(path.join(root, "clock.mjs")).href,
        path.join(root, "scripts", "update-dan-fm.mjs"),
      ],
      {
        /*
         * UTC, which is the runner's zone and is deliberately not the
         * station's. The job names `America/Los_Angeles` outright, so nothing
         * correct here reads the ambient zone - and a job that started reading
         * it would agree with the station on a laptop in California and
         * disagree with it in CI, which is the one place nobody is watching.
         */
        env: { ...process.env, TZ: "UTC", DAN_FM_NOW: how.now ?? at(TODAY) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (chunk: Buffer) => void (stdout += chunk));
    child.stderr!.on("data", (chunk: Buffer) => void (stderr += chunk));

    const code = await new Promise<number | null>((resolve) => void child.on("close", resolve));
    const out = path.join(content, "dan-fm.json");

    return {
      code,
      stdout,
      stderr,
      written: existsSync(out) ? readFileSync(out, "utf8") : null,
    };
  } finally {
    server.closeAllConnections();
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

/** The payload a run wrote, having asserted that it wrote one and said so. */
async function wrote(how: How = {}): Promise<DanFmPayload> {
  const ran = await run(how);

  expect(ran.stderr, "the job failed on a sheet it should have taken").toBe("");
  expect(ran.code, "the job did not exit clean on a sheet it should have taken").toBe(0);
  expect(ran.written, "the job wrote no payload for a sheet it should have taken").not.toBeNull();

  return JSON.parse(ran.written!) as DanFmPayload;
}

/**
 * What the job said about a sheet it refused, having asserted that refusing
 * means writing nothing and exiting non-zero.
 *
 * Both halves matter and neither implies the other: an exit code nobody sets
 * is a green tick over a page getting older, and a file written beside it is
 * the committed log lost to the run that was supposed to protect it.
 */
async function refusal(how: How = {}): Promise<string> {
  const ran = await run(how);

  expect(ran.written, "the job wrote a payload for a sheet it should have refused").toBeNull();
  expect(ran.code, "the job exited clean on a sheet it should have refused").toBe(1);

  return ran.stderr;
}

test.describe("reaching the sheet", () => {
  test("a sheet nobody published fails rather than being read as a log", async () => {
    /*
     * An unpublished sheet answers 200 with a page of HTML, which is the one
     * failure that could otherwise be written out as a log: it is a clean read
     * of the wrong thing. This is a real Drive error page, and the quote in
     * `lang="en"` is what the CSV reader stops on.
     */
    const stderr = await refusal({
      body:
        '<!DOCTYPE html>\n<html lang="en">\n<head><title>Google Drive - Page Not Found</title>' +
        "</head>\n<body>Sorry, unable to open the file at this time.</body>\n</html>\n",
    });

    expect(stderr).toContain("the sheet could not be parsed as CSV");
  });

  test("a sheet that answers an error says which error, and what to check", async () => {
    const stderr = await refusal({ status: 404, body: "" });

    expect(stderr).toContain("the published sheet answered 404");
    expect(stderr).toContain("Publish to web");
  });

  test("a connection that drops mid-read fails rather than reading an empty sheet", async () => {
    /*
     * A hang-up before any headers, which is the shape of a network that went
     * away. It has to be told apart from a sheet that is genuinely empty: the
     * empty sheet is a valid state that writes nothing and exits clean, so a
     * dropped connection landing in that branch would be a silent no-op every
     * four hours.
     */
    const stderr = await refusal({ hangUp: true });

    expect(stderr).toContain("could not reach the published sheet");
  });

  test("a read that stops half way is refused, and says which sheet stopped", async () => {
    /*
     * The sheet answers, some of it arrives, and the connection goes. This is
     * the failure that could quietly cost albums rather than fail: every row
     * above the cut parses cleanly, so a job that kept what it got would
     * commit a log missing everything below it, and nothing downstream would
     * ever say the read had been truncated.
     *
     * The body is read after the response has been handed over, so it throws
     * from somewhere an unreachable sheet never reaches. Left outside the
     * guard it surfaces as a bare "terminated" that names neither the sheet
     * nor the cause, which is a red run nobody can act on.
     */
    const stderr = await refusal({ truncate: true, body: sheet(row()) });

    expect(stderr).toContain("the published sheet stopped sending part-way through");
  });

  test("no sheet in the accounts file fails before anything is fetched", async () => {
    const stderr = await refusal({ accounts: JSON.stringify({ discogs: "dnafam" }) });

    expect(stderr).toContain("no `danFmSheet` in src/content/accounts.json");
  });

  test("a sheet address of nothing but whitespace is no address at all", async () => {
    // What clearing the cell and leaving the space behind produces.
    const stderr = await refusal({ accounts: JSON.stringify({ danFmSheet: "   " }) });

    expect(stderr).toContain("no `danFmSheet` in src/content/accounts.json");
  });
});

test.describe("reading the header", () => {
  test("a sheet with no header row at all fails", async () => {
    /*
     * The other half of the header check, and the half that only exists
     * because the CSV reader reports an empty body by never calling back at
     * all. A run that read this as "no rows" would write nothing, exit clean,
     * and look exactly like a log that had not started yet.
     */
    const stderr = await refusal({ body: "" });

    expect(stderr).toContain("the sheet came back empty - not even a header row");
  });

  test("a sheet with a header and no rows is a log that has not started", async () => {
    /*
     * The state the log ships in, and the reason an empty read cannot simply be
     * treated as a failure: this runs six times a day until the first album,
     * and every one of those runs has to be green.
     *
     * It is also the load-bearing library behaviour underneath the case above.
     * The header is proved from a body that has no records in it, which only
     * works because the reader hands over the header before the first record
     * exists.
     */
    const ran = await run({ body: sheet() });

    expect(ran.stderr).toBe("");
    expect(ran.code).toBe(0);
    expect(ran.written, "an empty sheet wrote a payload over the seed fixture").toBeNull();
    expect(ran.stdout).toContain(`nothing logged on or before ${TODAY}`);
  });

  test("a missing column is named, and the sheet is not read", async () => {
    const stderr = await refusal({
      body: bodyUnder(
        COLUMNS.filter((name) => name !== "Later"),
        [row()],
      ),
    });

    expect(stderr).toContain("the sheet is missing a column: Later");
  });

  test("several missing columns are all named at once", async () => {
    // One run a person can act on, rather than one column per four hours.
    const stderr = await refusal({
      body: bodyUnder(
        COLUMNS.filter((name) => name !== "Skip" && name !== "Take"),
        [row()],
      ),
    });

    expect(stderr).toContain("the sheet is missing columns: Skip, Take");
  });

  test("a helper column somebody added is ignored", async () => {
    // Adding a column to a spreadsheet must not take the site down.
    const payload = await wrote({ body: bodyUnder([...COLUMNS, "Notes to self"], [row()]) });

    expect(payload.albums).toHaveLength(1);
    expect(payload.albums[0].artist).toBe("The Standing Wave");
  });

  test("the columns are read by name rather than by where they sit", async () => {
    /*
     * The whole reason the header is read at all. Artist and Album are swapped
     * here and nothing else is: a job reading by position would file the album
     * under the artist's name and never say anything about it.
     */
    const shuffled = ["Album", "Artist", ...COLUMNS.filter((n) => n !== "Artist" && n !== "Album")];
    const payload = await wrote({ body: bodyUnder(shuffled, [row()]) });

    expect(payload.albums[0].artist).toBe("The Standing Wave");
    expect(payload.albums[0].album).toBe("Low Tide Signals");
  });

  test("a sheet in the shape a published export sends is read", async () => {
    /*
     * A Google export opens with a byte order mark and ends every line with
     * CRLF, and neither would appear in a fixture written by hand.
     *
     * The line ending is the half this can fail on: a reader pinned to `\n`
     * leaves a carriage return glued to `Streak`, and the run dies naming a
     * missing column rather than saying anything about encoding. The mark
     * cannot fail here, because `Response.text()` decodes as UTF-8 and drops a
     * leading mark before the CSV reader is ever handed the body. It is in the
     * fixture because it is on the wire, not because anything downstream of
     * the fetch could still see it.
     */
    const payload = await wrote({ body: `\uFEFF${bodyUnder(COLUMNS, [row()], "\r\n")}` });

    expect(payload.albums).toHaveLength(1);
  });

  test("a review written in paragraphs survives a published export", async () => {
    /*
     * The routine shape of the sheet now that a row carries a long piece, and
     * the combination nothing else here covers: a cell with newlines inside it,
     * in a body whose own lines end CRLF, with another row under it.
     *
     * A reader that took the wrong thing for the end of a record either stops
     * the row inside the review or files everything below it one row late, and
     * both of those arrive as albums rather than as anything anyone would see.
     * The second row is the whole point of the second row.
     *
     * Compared as the lines with something on them rather than byte for byte,
     * because that is what the page draws: an export writes the newlines inside
     * a cell the way it writes the ones between rows, and `/dan-fm` trims each
     * line before it makes a paragraph of it.
     */
    const older = addDays(TODAY, -1);
    const payload = await wrote({
      body: `\uFEFF${bodyUnder(
        COLUMNS,
        [
          row({ Review: "First paragraph.\r\n\r\nSecond paragraph.\r\n\r\nThird." }),
          row({ Date: older, Album: "Second Listen" }),
        ],
        "\r\n",
      )}`,
    });

    expect(payload.albums.map((album) => album.date)).toEqual([TODAY, older]);

    const paragraphs = payload.albums[0].review
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    expect(paragraphs).toEqual(["First paragraph.", "Second paragraph.", "Third."]);
  });

  test("a blank line between rows is not a row", async () => {
    /*
     * A sheet with a gap left in it. Read as a record, a blank line is a row
     * with no Date, no Artist and no Score, and it would fail the run with
     * three problems nobody can find in the sheet.
     */
    const payload = await wrote({
      body: `${bodyUnder(COLUMNS, [row(), row({ Date: addDays(TODAY, -1) })]).replace("\n", "\n\n")}`,
    });

    expect(payload.albums).toHaveLength(2);
  });

  test("a row that stops short of the last column is read rather than thrown at", async () => {
    /*
     * A row the sheet ended early, which is what an export of a range somebody
     * trimmed produces. The parser's own default is to throw on the first one,
     * and throwing here would abort before a single row was classified.
     *
     * What the cells that never arrived have to mean is "blank" - the same
     * album a row that sent them empty produces - because the header is what
     * says a column exists and the row is only saying it ran out.
     */
    const payload = await wrote({
      body: `${sheet()}${ragged(TODAY, "The Standing Wave", "Low Tide Signals", "", "", "", "", "", "4")}`,
    });

    expect(payload.albums).toEqual([blankAlbum(TODAY)]);
  });

  test("a row that stops short is reported beside every other problem", async () => {
    /*
     * The regression that matters most about a short row, and the one a case
     * about a single short row cannot see: throwing on it takes the whole run
     * down at the first one, so the three real typos further down the sheet go
     * unreported and come back one run at a time.
     *
     * A short row missing its Score is an ordinary problem, and it has to
     * arrive in the same collected report as an unrelated bad score below it.
     */
    const short = addDays(TODAY, -1);
    const bad = addDays(TODAY, -2);
    const stderr = await refusal({
      body:
        `${sheet(row())}` +
        `${ragged(short, "Another Band", "Another Record")}` +
        `${bodyUnder(COLUMNS, [row({ Date: bad, Score: "9" })])
          .split("\n")
          .slice(1)
          .join("\n")}`,
    });

    expect(stderr).toContain("the sheet has 2 problems");
    expect(stderr).toContain("line 3: no Score.");
    expect(stderr).toContain(`line 4: Score "9" is not a half step from 1 to ${MAX_SCORE}`);
  });

  test("a row wider than the header drops what has no column name", async () => {
    /*
     * The other direction, relaxed on purpose so that the row rule and the
     * header rule say the same thing: a helper column added to the sheet is
     * ignored, and so is a cell sitting past the last column that names one.
     *
     * Asserted against the whole album, so a surplus cell arriving under a
     * position rather than a name fails here rather than being committed.
     */
    /*
     * Padded out to the header's own width rather than by hand. A column added
     * to the sheet slides a hand-counted row's surplus back under a name, and
     * the case then passes while asking nothing at all - the two cells below
     * have to start past the last column that has one, or this is a test about
     * `Streak`.
     */
    const named: string[] = COLUMNS.map((column) => (column === "Score" ? "4" : ""));
    named[COLUMNS.indexOf("Date")] = TODAY;
    named[COLUMNS.indexOf("Artist")] = "The Standing Wave";
    named[COLUMNS.indexOf("Album")] = "Low Tide Signals";

    const payload = await wrote({
      body: `${sheet()}${ragged(...named, "a note to self", "and another")}`,
    });

    expect(payload.albums).toEqual([blankAlbum(TODAY)]);
  });

  test("a body that is not CSV fails as a read rather than as a row", async () => {
    // A quote opened and never closed, which is what a truncated download of a
    // sheet with a comma in a Take looks like.
    const stderr = await refusal({ body: `${sheet()}${TODAY},"The Standing\n` });

    expect(stderr).toContain("the sheet could not be parsed as CSV");
  });
});

test.describe("rows the log cannot take", () => {
  test("a row with no date is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Date: "" })) });

    expect(stderr).toContain("line 2: no Date.");
  });

  test("a date the calendar does not have is refused", async () => {
    /*
     * The one a shape check misses. `2026-09-31` spells out as a date, counts
     * as one, and can never equal the station's day, so the album it files
     * would silently never air.
     */
    const stderr = await refusal({ body: sheet(row({ Date: "2026-09-31" })) });

    expect(stderr).toContain('Date "2026-09-31" is not a real YYYY-MM-DD day');
  });

  test("a date that is not a date is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Date: "last tuesday" })) });

    expect(stderr).toContain('Date "last tuesday" is not a real YYYY-MM-DD day');
  });

  test("two albums on one day are refused, naming the row that took it", async () => {
    // One album a day is the whole format, and the date is the log's key.
    const stderr = await refusal({
      body: sheet(row(), row({ Album: "Second Listen" })),
    });

    expect(stderr).toContain(`line 3: Date ${TODAY} is already used on line 2`);
  });

  test("a day taken by a row still to come is still taken", async () => {
    /*
     * The row dated tomorrow is held back rather than published, so nothing
     * downstream would ever see the collision. Checking it here is what makes
     * the second row a mistake today rather than in a week.
     */
    const tomorrow = addDays(TODAY, 1);
    const stderr = await refusal({
      body: sheet(row({ Date: tomorrow }), row({ Date: tomorrow, Album: "Second Listen" })),
    });

    expect(stderr).toContain(`line 3: Date ${tomorrow} is already used on line 2`);
  });

  test("a date before the log began is refused as a mistyped year", async () => {
    const stderr = await refusal({ body: sheet(row({ Date: addDays(LOG_EPOCH, -1) })) });

    expect(stderr).toContain(`is before the log began on ${LOG_EPOCH}`);
  });

  test("the log's first day is a day the log takes", async () => {
    // The bound is the epoch itself, not the day after it.
    const payload = await wrote({ body: sheet(row({ Date: LOG_EPOCH })) });

    expect(payload.albums.map((album) => album.date)).toEqual([LOG_EPOCH]);
  });

  test("a row with no artist is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Artist: "" })) });

    expect(stderr).toContain("line 2: no Artist.");
  });

  test("a row with no album is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Album: "" })) });

    expect(stderr).toContain("line 2: no Album.");
  });

  test("a row with no score is refused", async () => {
    // An album in the log is one that was listened to and rated.
    const stderr = await refusal({ body: sheet(row({ Score: "" })) });

    expect(stderr).toContain("line 2: no Score.");
  });

  test("a score off the half-step grid is refused", async () => {
    // The page draws a score as a fractional fill, so 3.7 would settle at a
    // position the scale does not offer rather than say anything about itself.
    const stderr = await refusal({ body: sheet(row({ Score: "3.7" })) });

    expect(stderr).toContain(`Score "3.7" is not a half step from 1 to ${MAX_SCORE}`);
  });

  test("a score over the top of the scale is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Score: String(MAX_SCORE + 0.5) })) });

    expect(stderr).toContain(`is not a half step from 1 to ${MAX_SCORE}`);
  });

  test("a score under the bottom of the scale is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Score: "0.5" })) });

    expect(stderr).toContain(`is not a half step from 1 to ${MAX_SCORE}`);
  });

  test("a score that is not a number is refused", async () => {
    const stderr = await refusal({ body: sheet(row({ Score: "great" })) });

    expect(stderr).toContain('Score "great" is not a half step');
  });

  test("the ends of the scale are scores the log takes", async () => {
    /*
     * Both bounds, and the top one read from the module the page prints it
     * from. A job that stopped at 4.5 while the page kept saying "out of 5"
     * would refuse the best album of the year and blame the sheet.
     */
    const payload = await wrote({
      body: sheet(row({ Score: "1" }), row({ Date: addDays(TODAY, -1), Score: String(MAX_SCORE) })),
    });

    expect(payload.albums.map((album) => album.score).sort()).toEqual([1, MAX_SCORE]);
  });

  test("a second score that is off the scale is refused rather than dropped", async () => {
    /*
     * The deliberate difference from a year. A later score nobody can read is
     * a typo in a number that was typed on purpose, and dropping it silently
     * would leave nothing downstream able to say it had been ignored.
     */
    const stderr = await refusal({ body: sheet(row({ Later: "0" })) });

    expect(stderr).toContain(`Later "0" is not a half step from 1 to ${MAX_SCORE}`);
  });

  test("a link that is not an album is refused", async () => {
    // A track's share link, which is the mistake worth catching: it is a real
    // Spotify link to the wrong kind of thing.
    const stderr = await refusal({
      body: sheet(row({ Link: "https://open.spotify.com/track/1A2b3C4d5E6f7G8h9I0jKl" })),
    });

    expect(stderr).toContain("is not a Spotify album link");
  });

  test("an album id of the wrong shape is refused", async () => {
    /*
     * A link cut short in the paste. The id is exactly 22 characters and that
     * length is what the saved cover file is named after, so a shorter one
     * would be taken as an album, saved under a name the cover prune does not
     * recognise, and swept away by it.
     */
    const stderr = await refusal({
      body: sheet(row({ Link: "https://open.spotify.com/album/1A2b3C4d" })),
    });

    expect(stderr).toContain("is not a Spotify album link");
  });

  test("every problem in the sheet is reported in one run", async () => {
    /*
     * The job runs six times a day and a person fixes the sheet between runs,
     * so a report that stopped at the first problem would take a day to hand
     * over three typos.
     */
    const stderr = await refusal({
      body: sheet(
        row({ Artist: "" }),
        row({ Date: addDays(TODAY, -1), Score: "6" }),
        row({ Date: addDays(TODAY, -2), Album: "" }),
      ),
    });

    expect(stderr).toContain("the sheet has 3 problems");
    expect(stderr).toContain("line 2: no Artist.");
    expect(stderr).toContain("line 3: Score");
    expect(stderr).toContain("line 4: no Album.");
  });

  test("a problem names the line to open, counting a cell that wrapped", async () => {
    /*
     * The line a Take with a newline in it pushes everything below onto. The
     * number comes from the reader rather than from the row's position, and
     * counting rows instead would send someone to line 3 for a problem on
     * line 4 - the one number in the message that has to be right.
     */
    const stderr = await refusal({
      body: sheet(row({ Take: "Two lines\nof it" }), row({ Date: addDays(TODAY, -1), Album: "" })),
    });

    expect(stderr).toContain("line 4: no Album.");
  });

  test("a refused sheet leaves the committed log exactly as it was", async () => {
    /*
     * The promise the whole failure path exists for. The page keeps showing
     * what it last read, which is only true if the file is untouched rather
     * than merely un-rewritten.
     */
    const committed = `${JSON.stringify(
      { url: "https://example.test/sheet", fetched: LOG_EPOCH, albums: [{ date: LOG_EPOCH }] },
      null,
      2,
    )}\n`;
    const ran = await run({ body: sheet(row({ Score: "3.7" })), committed });

    expect(ran.code).toBe(1);
    expect(ran.written).toBe(committed);
  });
});

test.describe("the days the log holds back", () => {
  test("a row dated ahead of today is held back and said out loud", async () => {
    /*
     * Not a mistake, just not true yet. It has to be reported rather than
     * dropped: a row that sat outside the payload with nothing naming it would
     * be indistinguishable from a row nobody typed.
     */
    const tomorrow = addDays(TODAY, 1);
    const ran = await run({ body: sheet(row(), row({ Date: tomorrow, Album: "Tomorrow" })) });

    expect(ran.code).toBe(0);
    expect(ran.stderr).toContain(`1 row is dated ahead of ${TODAY} and held back until then`);
    expect(ran.stderr).toContain(tomorrow);
    expect(JSON.parse(ran.written!).albums.map((album: { date: string }) => album.date)).toEqual([
      TODAY,
    ]);
  });

  test("every held row is named, and counted", async () => {
    const ran = await run({
      body: sheet(
        row(),
        row({ Date: addDays(TODAY, 2), Album: "Later" }),
        row({ Date: addDays(TODAY, 1), Album: "Sooner" }),
      ),
    });

    expect(ran.stderr).toContain("2 rows are dated ahead of");
    expect(ran.stderr).toContain(`${addDays(TODAY, 1)}, ${addDays(TODAY, 2)}`);
  });

  test("a held row publishes itself on the day it names", async () => {
    /*
     * The point of holding rather than refusing, and the only case that proves
     * the two ends join up: the same sheet, read a day later, with nobody
     * having touched it.
     */
    const tomorrow = addDays(TODAY, 1);
    const body = sheet(row({ Date: tomorrow }));

    expect((await run({ body })).written, "a row dated tomorrow was published today").toBeNull();

    const payload = await wrote({ body, now: at(tomorrow) });

    expect(payload.albums.map((album) => album.date)).toEqual([tomorrow]);
  });

  test("the last day inside the window is held rather than refused", async () => {
    const ran = await run({ body: sheet(row({ Date: HORIZON })) });

    expect(ran.code, `a row dated ${HORIZON} was refused rather than held`).toBe(0);
    expect(ran.stderr).toContain(HORIZON);
  });

  test("a day past the window is a mistyped year, and is refused", async () => {
    const beyond = addDays(HORIZON, 1);
    const stderr = await refusal({ body: sheet(row({ Date: beyond })) });

    // The message quotes the same window the boundary above is measured
    // against, so a job whose horizon and whose complaint disagreed would say
    // one number here and behave like another.
    expect(stderr).toContain(`Date ${beyond} is more than ${FUTURE_DAYS} days after ${TODAY}`);
  });

  test("a row is held against the station's day rather than the runner's", async () => {
    /*
     * 06:30 UTC is half past eleven the night before in California, in either
     * half of the year. The runner's day is UTC and is already tomorrow through
     * the whole California evening, so a job measuring "ahead of today" against
     * it would publish a row the moment it was typed.
     */
    const held = await run({ body: sheet(row({ Date: TODAY })), now: at(TODAY, "06:30:00") });

    expect(held.written, "tomorrow's album went out on the visitor's clock").toBeNull();

    // 08:30 UTC is the small hours of the same California morning, and the same
    // row is on air.
    const payload = await wrote({ body: sheet(row({ Date: TODAY })), now: at(TODAY, "08:30:00") });

    expect(payload.albums.map((album) => album.date)).toEqual([TODAY]);
  });
});

test.describe("what the job writes", () => {
  test("a row with nothing but the cells the log requires is written with blanks", async () => {
    /*
     * The normalising the build refuses to do, asserted whole because every
     * one of these is a shape the reader either takes or fails on. `later` is
     * the one that matters most: a sheet exports an empty cell as "", the
     * reader rejects `later: ""` on purpose, and passing the cell through
     * verbatim fails the build rather than reading as "no second listen".
     */
    const payload = await wrote({ body: sheet(row()) });

    expect(payload.albums).toEqual([blankAlbum(TODAY)]);
  });

  test("a filled row carries every cell the sheet typed, and nothing it did not", async () => {
    /*
     * Whole again, which is what pins `Stars` and `Streak` out of the payload:
     * both are read off the sheet to prove the header is this log's, and
     * neither is anything the page counts.
     */
    const payload = await wrote({
      body: sheet(
        row({
          Link: "https://open.spotify.com/album/1A2b3C4d5E6f7G8h9I0jKl",
          Year: "1999",
          Genre: "Post-rock",
          Source: "Recommendation",
          From: "A friend",
          Score: "4.5",
          Stars: "*****",
          Shelf: "Keep",
          Standout: "Low Tide",
          Skip: "Interlude",
          Take: "Holds up, quietly",
          Review: "Two paragraphs of it.\n\nAnd the second one.",
          Tag1: "loud",
          Tag2: "warm",
          Later: "5",
          Streak: "12",
        }),
      ),
    });

    expect(payload.albums).toEqual([
      {
        date: TODAY,
        slug: `${TODAY}-${SLUG}`,
        artist: "The Standing Wave",
        album: "Low Tide Signals",
        year: 1999,
        yearIsPressing: false,
        genre: "Post-rock",
        source: "Recommendation",
        from: "A friend",
        score: 4.5,
        shelf: "Keep",
        standout: { name: "Low Tide", id: "" },
        skip: { name: "Interlude", id: "" },
        take: "Holds up, quietly",
        review: "Two paragraphs of it.\n\nAnd the second one.",
        tags: ["loud", "warm"],
        later: 5,
        spotifyId: "1A2b3C4d5E6f7G8h9I0jKl",
        url: "https://open.spotify.com/album/1A2b3C4d5E6f7G8h9I0jKl",
        cover: "",
      },
    ]);
  });

  test("a year nobody can read is dropped, and the run stays green", async () => {
    /*
     * The asymmetry with a score, and the one warning that is not a holdback.
     * A year is hand-typed and routinely left out, so one cell nobody can read
     * must not hold the whole log at its last payload - but it cannot vanish
     * silently either, or nothing would ever say the album lost its year.
     */
    const ran = await run({ body: sheet(row({ Year: "nineteen ninety" })) });

    expect(ran.code).toBe(0);
    expect(ran.stderr).toContain('line 2: Year "nineteen ninety" is not a year');
    expect(JSON.parse(ran.written!).albums[0].year).toBeNull();
  });

  test("a share link leaves its tracking behind", async () => {
    // Everything from the "?" on is Spotify's share tracking, and it is not
    // part of the album's address.
    const payload = await wrote({
      body: sheet(
        row({ Link: "https://open.spotify.com/album/1A2b3C4d5E6f7G8h9I0jKl?si=8f0c1d2e3a4b5c6d" }),
      ),
    });

    expect(payload.albums[0].url).toBe("https://open.spotify.com/album/1A2b3C4d5E6f7G8h9I0jKl");
    expect(payload.albums[0].spotifyId).toBe("1A2b3C4d5E6f7G8h9I0jKl");
  });

  test("a link copied from a localised client names the same album", async () => {
    const payload = await wrote({
      body: sheet(row({ Link: "https://open.spotify.com/intl-de/album/1A2b3C4d5E6f7G8h9I0jKl" })),
    });

    expect(payload.albums[0].spotifyId).toBe("1A2b3C4d5E6f7G8h9I0jKl");
  });

  test("a tag typed twice is carried once", async () => {
    /*
     * The reader does not dedupe, so this is the only place it happens. A
     * repeated tag would draw the same chip twice and count double wherever
     * tags are counted.
     */
    const payload = await wrote({ body: sheet(row({ Tag1: "loud", Tag2: "loud", Tag3: "warm" })) });

    expect(payload.albums[0].tags).toEqual(["loud", "warm"]);
  });

  test("a name that reduces to nothing leaves the date as the address", async () => {
    /*
     * A title in a script the slug drops entirely. The date carries the
     * uniqueness, so the name part is free to disappear - what may not happen
     * is an empty slug, which the build refuses and which would collapse every
     * such album onto one address.
     */
    const payload = await wrote({ body: sheet(row({ Artist: "!!!", Album: "()" })) });

    expect(payload.albums[0].slug).toBe(TODAY);
  });

  test("a long name is cut short without leaving a dash hanging", async () => {
    /*
     * The cut lands exactly on the join here, so the slug ends in a dash
     * unless something trims it - and a slug ending in a dash is not a URL
     * segment the build will take.
     */
    const payload = await wrote({
      body: sheet(row({ Artist: "A".repeat(59), Album: "Low Tide Signals" })),
    });

    expect(payload.albums[0].slug).toBe(`${TODAY}-${"a".repeat(59)}`);
  });

  test("the log comes back newest first", async () => {
    // The order every list on the page reads down from, fixed here rather than
    // left to the order the sheet happens to be sorted in.
    const payload = await wrote({
      body: sheet(
        row({ Date: addDays(TODAY, -2) }),
        row({ Date: TODAY, Album: "Newest" }),
        row({ Date: addDays(TODAY, -1), Album: "Middle" }),
      ),
    });

    expect(payload.albums.map((album) => album.date)).toEqual([
      TODAY,
      addDays(TODAY, -1),
      addDays(TODAY, -2),
    ]);
  });

  test("the log names the sheet's page rather than its export", async () => {
    // Where the source line under the page sends a reader. Left as the CSV
    // address, the link downloads a file instead of opening a sheet.
    const payload = await wrote({ body: sheet(row()) });

    expect(payload.url).toContain("gid=46855817");
    expect(payload.url, "the source link still points at the CSV export").not.toContain("output=");
  });

  test("the log is stamped with the day it was read", async () => {
    const payload = await wrote({ body: sheet(row()), now: at(TODAY) });

    expect(payload.fetched).toBe(TODAY);
  });

  test("the job says how many albums it wrote", async () => {
    const ran = await run({ body: sheet(row(), row({ Date: addDays(TODAY, -1) })) });

    expect(ran.stdout).toContain("wrote 2 albums to src/content/dan-fm.json");
  });
});

test.describe("an empty log", () => {
  test("a sheet holding nothing but days to come writes nothing", async () => {
    /*
     * Emptiness is measured after the holdback rather than on the rows that
     * were read, so a sheet of nothing but plans is the same case as a sheet
     * of nothing at all. Measured on the row count instead, this would write a
     * payload with an empty album list.
     */
    const ran = await run({ body: sheet(row({ Date: addDays(TODAY, 1) })) });

    expect(ran.code).toBe(0);
    expect(ran.written).toBeNull();
    expect(ran.stdout).toContain(`nothing logged on or before ${TODAY}`);
  });

  test("an empty log against a committed one is a read that went wrong", async () => {
    /*
     * The shape of a fetch that half-succeeded: the sheet answers, the header
     * is right, and every row is gone. Written out, that empties the page.
     * Deleting one mistyped row is an edit and is written out as one, which is
     * the case below.
     */
    const committed = JSON.stringify({
      url: "https://example.test/sheet",
      fetched: LOG_EPOCH,
      albums: [{ date: LOG_EPOCH }, { date: TODAY }],
    });
    const ran = await run({ body: sheet(), committed });

    expect(ran.code).toBe(1);
    expect(ran.stderr).toContain(`nothing on or before ${TODAY} while 2 albums are committed`);
    expect(ran.written).toBe(committed);
  });

  test("an empty log against a committed empty one is not a shrink", async () => {
    // Nothing to lose, so nothing to refuse. The bound is the number of albums
    // committed rather than whether a file is there.
    const committed = JSON.stringify({ url: "", fetched: "", albums: [] });
    const ran = await run({ body: sheet(), committed });

    expect(ran.code).toBe(0);
    expect(ran.stdout).toContain("Writing nothing");
  });

  test("a committed log nobody can read stops the run rather than being overwritten", async () => {
    /*
     * A truncated commit, which is the one state where "how many are committed"
     * cannot be answered. Treated as zero, the run would write over it; the
     * only safe reading of an unreadable file is to stop and say so.
     */
    const committed = "{ this is not json";
    const ran = await run({ body: sheet(), committed });

    expect(ran.code).toBe(1);
    expect(ran.stderr).toContain("src/content/dan-fm.json is not readable JSON");
    expect(ran.written, "the unreadable file was written over instead of being left").toBe(
      committed,
    );
  });

  test("the last album can still be deleted from the sheet", async () => {
    /*
     * The edit the refusal above must not catch. One row removed from a sheet
     * that still has others is an ordinary correction, and it has to be
     * written out or the deleted album stays on the page forever.
     */
    const committed = JSON.stringify({
      url: "https://example.test/sheet",
      fetched: LOG_EPOCH,
      albums: [{ date: LOG_EPOCH }, { date: TODAY }],
    });
    const payload = await wrote({ body: sheet(row({ Date: LOG_EPOCH })), committed });

    expect(payload.albums.map((album) => album.date)).toEqual([LOG_EPOCH]);
  });
});

/** As much of the content plugin as reading a payload back reaches into. */
interface Hooks {
  configResolved: (config: { root: string; publicDir: string; command: "build" }) => void;
  resolveId: (id: string) => string | null;
  load: (id: string) => string | null;
}

/**
 * What a build would make of a payload the job wrote.
 *
 * The job's output and the build's input are two halves of one contract that
 * nothing else compares: `tests/dan-fm.spec.ts` proves the reader against
 * payloads written by hand, and everything above proves the writer against a
 * shape written by hand. Only this reads the bytes the job actually produced.
 */
function builtFrom(written: string): DanFmPayload {
  const root = mkdtempSync(path.join(tmpdir(), "dan-fm-build-"));

  try {
    mkdirSync(path.join(root, "src", "content"), { recursive: true });
    mkdirSync(path.join(root, "public"), { recursive: true });
    writeFileSync(path.join(root, "src", "content", "dan-fm.json"), written);

    const plugin = contentPlugin() as unknown as Hooks;
    // A fetched payload always wins over the fixture, so `DANFM_SEED` cannot
    // reach this whatever the shell running the suite already carries.
    plugin.configResolved({ root, publicDir: path.join(root, "public"), command: "build" });

    const id = plugin.resolveId("virtual:dan-fm");
    expect(id, "the plugin no longer claims `virtual:dan-fm`").not.toBeNull();

    const exported = /^export const danFm = (.*);$/s.exec(plugin.load(id!) ?? "");
    expect(
      exported,
      "`virtual:dan-fm` no longer exports `danFm` as one JSON literal",
    ).not.toBeNull();

    return JSON.parse(exported![1]) as DanFmPayload;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test.describe("the payload the build reads back", () => {
  test("what the job writes is what the build takes", async () => {
    /*
     * The seam between the two PRs, and the failure neither side can see
     * alone. The reader refuses a blank where a number belongs, a slug that is
     * not a URL segment, and two rows on one day - all of them shapes this job
     * decides. A run that wrote any of them would commit a payload that fails
     * the next build rather than the run that produced it, which is a red
     * deploy with nobody's name on it.
     *
     * The rows are chosen for the corners: one with every cell blank that may
     * be, one with a name the slug drops entirely, and one with every cell
     * filled.
     */
    const ran = await run({
      body: sheet(
        row(),
        row({ Date: addDays(TODAY, -1), Artist: "!!!", Album: "()" }),
        row({
          Date: addDays(TODAY, -2),
          Album: "Second Listen",
          Link: "https://open.spotify.com/album/1A2b3C4d5E6f7G8h9I0jKl?si=8f0c",
          Year: "1999",
          Score: "4.5",
          Later: "5",
          Tag1: "loud",
        }),
      ),
    });

    expect(ran.written, "the job wrote nothing to hand the build").not.toBeNull();

    const built = builtFrom(ran.written!);

    expect(built.albums.map((album) => album.date)).toEqual([
      TODAY,
      addDays(TODAY, -1),
      addDays(TODAY, -2),
    ]);
    // Absent rather than blank, which is the whole reason the job normalises.
    expect(built.albums[0].later).toBeNull();
    // Numbered by the build from the oldest album up, which only works if the
    // job wrote a date the build could read on every row.
    expect(built.albums.map((album) => album.ordinal)).toEqual([3, 2, 1]);
  });
});
