import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

import { MAX_SCORE, albumSummary, albumTitle, albumUrl } from "../src/lib/dan-fm-summary";
import { contentPlugin } from "../vite-plugin-content";

import type { Album, DanFmPayload } from "../src/lib/dan-fm";

/**
 * The album log, checked where it is actually decided: in Node, at build time.
 *
 * The validator and the pure modules the page reads are all reachable without a
 * browser, so they are asked here: `tests/images.spec.ts` already drives
 * `contentPlugin()`'s hooks over a throwaway source tree, and the same handle
 * works for a payload. Going in through `load` is what makes a corrupt payload
 * answerable at all - the failure it is being asked about happens in Node,
 * where a page has nothing to say about it.
 *
 * What the page does with these answers is `tests/dan-fm-page.spec.ts`, which
 * costs a browser and covers what a pure function cannot: that the station
 * light on screen is wired to `station()` below, and that the line under the
 * album names the album the lamp was lit for.
 */

/** What the throwaway `public/` holds, for the one row that names a cover. */
const COVER = "img/dan-fm/there.webp";

type Command = "build" | "serve";

/** The two files `readDanFm` chooses between, by the names it looks for. */
interface Sources {
  /** `src/content/dan-fm.json` - what the scheduled job writes. */
  log?: string;
  /** `src/content/dan-fm.seed.json` - the committed fixture. */
  seed?: string;
}

/**
 * Which build is asking. Both inputs are always set rather than defaulted from
 * the environment: `DANFM_SEED` is a real variable a shell may already carry,
 * and a test whose answer depends on who ran it is a test that reports the
 * wrong thing on somebody's machine.
 */
interface How {
  command?: Command;
  /** `DANFM_SEED`, or absent to run with the variable unset. */
  env?: string;
}

/**
 * Vite describes a plugin hook as either a function or an object wrapping one,
 * and this plugin writes the first. Typed by hand for the same reason
 * `tests/images.spec.ts` types `buildStart` by hand.
 */
interface Hooks {
  configResolved: (config: { root: string; publicDir: string; command: Command }) => void;
  resolveId: (id: string) => string | null;
  load: (id: string) => string | null;
  configureServer: (server: FakeServer) => void;
}

/** As much of a dev server as `configureServer` reaches into. */
interface FakeServer {
  watcher: { on: (event: string, handler: (file: string) => void) => void };
  moduleGraph: {
    getModuleById: (id: string) => { id: string };
    invalidateModule: (module: { id: string }) => void;
  };
  ws: { send: (payload: { type: string }) => void };
}

/** `export const danFm = <json>;`, which is the whole of what `load` returns. */
const EXPORTED = /^export const danFm = (.*);$/s;

/**
 * What the plugin calls `virtual:dan-fm` once it has resolved it.
 *
 * Asked for rather than spelled out, because the `\0` prefix is Rollup's
 * business and a test that hardcoded it would keep passing after the plugin
 * stopped answering to the name the app imports.
 */
const DAN_FM = (contentPlugin() as unknown as Hooks).resolveId("virtual:dan-fm");

/**
 * Files a content tree, asks the plugin for `virtual:dan-fm`, and hands back
 * the payload the page would import.
 *
 * Goes in through `resolveId` rather than spelling the resolved id, so a
 * virtual module the plugin stopped claiming fails here rather than being
 * quietly served by a test that knew the private spelling.
 */
function loadLog(sources: Sources, how: How = {}): DanFmPayload {
  const root = mkdtempSync(path.join(tmpdir(), "dan-fm-"));
  const before = process.env.DANFM_SEED;

  try {
    if (how.env === undefined) delete process.env.DANFM_SEED;
    else process.env.DANFM_SEED = how.env;

    const publicDir = path.join(root, "public");
    mkdirSync(path.join(publicDir, path.dirname(COVER)), { recursive: true });
    writeFileSync(path.join(publicDir, COVER), "");

    mkdirSync(path.join(root, "src", "content"), { recursive: true });
    if (sources.log !== undefined) {
      writeFileSync(path.join(root, "src", "content", "dan-fm.json"), sources.log);
    }
    if (sources.seed !== undefined) {
      writeFileSync(path.join(root, "src", "content", "dan-fm.seed.json"), sources.seed);
    }

    const plugin = contentPlugin() as unknown as Hooks;
    plugin.configResolved({ root, publicDir, command: how.command ?? "build" });

    expect(DAN_FM, "the plugin no longer claims `virtual:dan-fm`").not.toBeNull();

    const code = plugin.load(DAN_FM!);
    const json = EXPORTED.exec(code ?? "");
    expect(json, "`virtual:dan-fm` no longer exports `danFm` as one JSON literal").not.toBeNull();

    return JSON.parse(json![1]) as DanFmPayload;
  } finally {
    if (before === undefined) delete process.env.DANFM_SEED;
    else process.env.DANFM_SEED = before;
    rmSync(root, { recursive: true, force: true });
  }
}

/** The build error these sources would fail with, or `""` if the build goes through. */
function buildError(sources: Sources, how: How = {}): string {
  try {
    loadLog(sources, how);
    return "";
  } catch (error) {
    return (error as Error).message;
  }
}

/** A row the validator accepts, for a case to break one field of. */
function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: "2026-08-20",
    slug: "2026-08-20-the-standing-wave-low-tide-signals",
    artist: "The Standing Wave",
    album: "Low Tide Signals",
    score: 4,
    ...over,
  };
}

/** A payload document around some rows. */
function doc(albums: unknown[], over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    url: "https://example.test/sheet",
    fetched: "2026-08-29",
    albums,
    ...over,
  });
}

/**
 * The virtual modules a dev server would rebuild after `file` was edited,
 * named the way `resolveId` names them.
 *
 * No files are written: the watcher decides on the path alone, which is the
 * whole of what is being asked here.
 */
function reloadedAfterEditing(name: string): (string | null)[] {
  const root = mkdtempSync(path.join(tmpdir(), "dan-fm-"));

  try {
    const plugin = contentPlugin() as unknown as Hooks;
    plugin.configResolved({ root, publicDir: path.join(root, "public"), command: "serve" });

    const invalidated: string[] = [];
    const watching = new Map<string, (file: string) => void>();

    plugin.configureServer({
      watcher: { on: (event, handler) => void watching.set(event, handler) },
      moduleGraph: {
        getModuleById: (id) => ({ id }),
        invalidateModule: (module) => void invalidated.push(module.id),
      },
      ws: { send: () => {} },
    });

    const edited = watching.get("change");
    expect(edited, "a dev server no longer hears about an edited file").toBeDefined();
    edited!(path.resolve(root, name));

    return invalidated;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test.describe("which log a build reads", () => {
  test("a build with neither file ships an empty log", () => {
    /*
     * The control, and the shape that ships first: the repo has no fetched
     * payload today and will not have one until the job has run once. Without
     * this every assertion below could be satisfied by a plugin that returned
     * nothing at all, and none of them would prove the log was read.
     */
    expect(loadLog({})).toEqual({ url: "", fetched: "", albums: [] });
  });

  test("the fixture stays out of a build that did not ask for it", () => {
    /*
     * The one that keeps eight fictional albums off the live site. `deploy.yml`
     * builds without `DANFM_SEED`, so this is the production path, and the only
     * thing standing between a reader and a made-up review is this branch.
     */
    expect(loadLog({ seed: doc([row()]) })).toEqual({ url: "", fetched: "", albums: [] });
  });

  test("DANFM_SEED=1 lets the fixture stand in", () => {
    // What `ci.yml` sets, so the `dist` the sweeps walk has albums on it.
    const log = loadLog({ seed: doc([row({ artist: "FIXTURE" })]) }, { env: "1" });

    expect(log.albums.map((album) => album.artist)).toEqual(["FIXTURE"]);
  });

  test("DANFM_SEED=0 does not let the fixture stand in", () => {
    // Anyone spelling "off" this way means off. A truthiness check reads it as on.
    expect(loadLog({ seed: doc([row()]) }, { env: "0" }).albums).toEqual([]);
  });

  test("the dev server always allows the fixture", () => {
    // Otherwise `npm run dev` opens the page on an empty log and there is
    // nothing to build the thing against.
    const log = loadLog({ seed: doc([row({ artist: "FIXTURE" })]) }, { command: "serve" });

    expect(log.albums.map((album) => album.artist)).toEqual(["FIXTURE"]);
  });

  test("a fetched log wins over the fixture", () => {
    /*
     * How the fixture retires itself. The day the job commits a real payload,
     * a dev server and a CI build both stop reading the made-up one without
     * anybody remembering to delete it.
     */
    const log = loadLog(
      { log: doc([row({ artist: "FETCHED" })]), seed: doc([row({ artist: "FIXTURE" })]) },
      { command: "serve", env: "1" },
    );

    expect(log.albums.map((album) => album.artist)).toEqual(["FETCHED"]);
  });

  test("a fetched log is read by a build that does not allow the fixture", () => {
    // The deploy path once the job has run: no `DANFM_SEED`, and the real
    // payload still has to arrive on the page.
    const log = loadLog({ log: doc([row({ artist: "FETCHED" })]) });

    expect(log.albums.map((album) => album.artist)).toEqual(["FETCHED"]);
  });

  test("the log carries the sheet it came from", () => {
    // The source line under the page. Read off the payload rather than typed
    // into the component, so a build with no log has nothing to link to.
    expect(loadLog({ log: doc([]) })).toMatchObject({
      url: "https://example.test/sheet",
      fetched: "2026-08-29",
    });
  });
});

test.describe("a half-succeeded fetch fails the build", () => {
  test("a log that is not JSON fails the build", () => {
    expect(buildError({ log: "{ not json" })).toMatch(/could not be parsed as JSON/);
  });

  test("a log that is not an object fails the build", () => {
    /*
     * A job writing its rows straight out lands here rather than on a page of
     * nothing.
     *
     * Asserted as naming no row, because a row that is not an object fails one
     * level down with the same words. An assertion on those words alone would
     * not say which of the two checks answered, and would go on passing with
     * either one of them missing.
     */
    const message = buildError({ log: "[]" });

    expect(message).toMatch(/must be a JSON object/);
    expect(message).not.toContain("albums[");
  });

  test("a row that is not an object fails the build naming the row", () => {
    /*
     * What a fetch script writes when it maps a sheet row to nothing. Indexing
     * a field straight off one throws a `TypeError` that names neither the file
     * nor the row - a build failure with nothing in it to act on, and the one
     * shape the payload's own error format exists to prevent.
     *
     * All four spellings take the same path, and a guard that narrowed only the
     * null would leave the other three on it.
     */
    const unusable: [string, unknown][] = [
      ["null", null],
      ["a bare string", "2026-08-20"],
      ["an array", []],
      ["a number", 7],
    ];

    const misreported = unusable
      .filter(([, shape]) => {
        const message = buildError({ log: doc([shape]) });
        return (
          !message.includes("src/content/dan-fm.json") ||
          !message.includes("`albums[0]`") ||
          !message.includes("must be a JSON object")
        );
      })
      .map(([label]) => label);

    /*
     * The reason is asserted alongside the row, not just the fact of a failure.
     * A row that is a bare string reaches the date check and fails there, which
     * names the file and the row perfectly well - so a guard narrowing only the
     * null would satisfy an assertion that stopped at those two.
     */
    expect(misreported, "these rows are not rejected as the wrong shape").toEqual([]);
  });

  test("a log with no albums array fails the build", () => {
    expect(buildError({ log: JSON.stringify({ url: "", fetched: "" }) })).toMatch(
      /`albums` must be an array/,
    );
  });

  test("a row with no date fails the build", () => {
    expect(buildError({ log: doc([row({ date: "" })]) })).toMatch(/needs a `date`/);
  });

  test("a date that is not YYYY-MM-DD fails the build", () => {
    // The log's key and the thing every day boundary is compared against, so a
    // shape the comparison cannot read is a row that is never today.
    expect(buildError({ log: doc([row({ date: "2026-8-20" })]) })).toMatch(/needs a `date`/);
    expect(buildError({ log: doc([row({ date: "20 August 2026" })]) })).toMatch(/needs a `date`/);
  });

  test("a date the calendar does not have fails the build", () => {
    /*
     * The shape check passes these and nothing downstream says a word. The page
     * spells `2026-09-31` out as "September 31, 2026", the day count reads it as
     * October 1, and the station clock can never equal it - so that album is
     * filed, counted, and never on air.
     */
    expect(buildError({ log: doc([row({ date: "2026-09-31" })]) })).toMatch(/needs a `date`/);
    expect(buildError({ log: doc([row({ date: "2026-02-30" })]) })).toMatch(/needs a `date`/);
  });

  test("a month that does not exist fails the build rather than throwing", () => {
    // Its own case because it takes its own path: a month of 13 parses to
    // `NaN`, where the round-trip throws instead of handing back a day that
    // fails to match.
    expect(buildError({ log: doc([row({ date: "2026-13-01" })]) })).toMatch(/needs a `date`/);
  });

  test("a leap day is a day the log can be filed under", () => {
    /*
     * The control the rejections above need. A bound written by hand gets this
     * wrong in one direction or the other, and rejecting it loses a real
     * morning every four years while accepting the second one files a day that
     * did not happen.
     */
    expect(buildError({ log: doc([row({ date: "2024-02-29" })]) })).toBe("");
    expect(buildError({ log: doc([row({ date: "2026-02-29" })]) })).toMatch(/needs a `date`/);
  });

  test("two rows on one day fail the build", () => {
    /*
     * One album a day is the whole format. Two rows on a date would number
     * every later album wrong and leave the page showing one of them with no
     * way to tell which.
     */
    const message = buildError({
      log: doc([row(), row({ slug: "2026-08-20-someone-else-another-record" })]),
    });

    expect(message).toMatch(/repeats `date` 2026-08-20/);
  });

  test("a row with no slug fails the build", () => {
    // The permalink and the React key both - a blank one collapses every album
    // onto the same address.
    expect(buildError({ log: doc([row({ slug: "" })]) })).toMatch(/has no `slug`/);
  });

  test("a slug the host cannot serve fails the build", () => {
    /*
     * The slug is a URL path segment and a file name at once. A slash publishes
     * one album as a nested path that answers 404, and a capital or a space
     * answers differently depending on which host is serving - the failure that
     * shows up only once it is deployed somewhere else.
     *
     * The accepting half needs no case of its own: every other test in this
     * file files a real slug, so an over-strict pattern fails all of them.
     */
    for (const slug of ["a/b", "../etc", "Ivy Bellweather"]) {
      expect(buildError({ log: doc([row({ slug })]) }), slug).toMatch(/`slug`/);
    }
  });

  test("two rows at one address fail the build", () => {
    /*
     * A slug opens with a date that is already unique, so two rows reaching the
     * same address means the job derived the slug wrongly rather than two
     * albums clashing. Left alone it serves one of them at both addresses and
     * the other at none.
     */
    const message = buildError({
      log: doc([row(), row({ date: "2026-08-21" })]),
    });

    expect(message).toMatch(/repeats `slug`/);
  });

  test("a row with no artist fails the build", () => {
    expect(buildError({ log: doc([row({ artist: "" })]) })).toMatch(/has no `artist`/);
  });

  test("a row with no album fails the build", () => {
    expect(buildError({ log: doc([row({ album: "   " })]) })).toMatch(/has no `album`/);
  });

  test("a score off the half-step grid fails the build", () => {
    /*
     * The page draws the score as a fractional fill, so a 3.7 would settle
     * silently at a position the scale does not offer rather than say anything
     * about itself.
     */
    expect(buildError({ log: doc([row({ score: 3.7 })]) })).toMatch(/needs a `score`/);
  });

  test("a score under the bottom of the scale fails the build", () => {
    expect(buildError({ log: doc([row({ score: 0.5 })]) })).toMatch(/needs a `score`/);
  });

  test("a score over the top of the scale fails the build", () => {
    expect(buildError({ log: doc([row({ score: 5.5 })]) })).toMatch(/needs a `score`/);
  });

  test("a score that is not a number or the digits of one fails the build", () => {
    /*
     * `Number` is happy to turn either of these into a clean 1, which would be
     * filed as a real reading of a real record. A payload holding one is a
     * write that went wrong, and the coercion is what hides that.
     */
    expect(buildError({ log: doc([row({ score: true })]) })).toMatch(/needs a `score`/);
    expect(buildError({ log: doc([row({ score: [1] })]) })).toMatch(/needs a `score`/);
  });

  test("a score written as digits is still a score", () => {
    // The pair to the case above: a sheet hands its cells over as text, so
    // rejecting a string would reject every row rather than the broken ones.
    expect(buildError({ log: doc([row({ score: "4.5" })]) })).toBe("");
  });

  test("a row with no score at all fails the build", () => {
    // Every other field on a row is optional somewhere. The score is what the
    // mixtape is gated on, so a blank one is not a row that can be filed.
    expect(buildError({ log: doc([row({ score: "" })]) })).toMatch(/needs a `score`/);
  });

  test("the ends of the scale are scores the log can hold", () => {
    /*
     * The pair to the three above, and the half that can fail for the opposite
     * reason. Without it a bound tightened to 2-to-4 would satisfy every
     * rejection here and quietly fail the build on a real album.
     */
    expect(buildError({ log: doc([row({ score: 1 })]) })).toBe("");
    expect(buildError({ log: doc([row({ score: MAX_SCORE })]) })).toBe("");
  });

  test("a later score off the grid fails the build", () => {
    // The same scale, a second time, on the field that says what a record
    // turned into after living with it.
    expect(buildError({ log: doc([row({ later: 4.2 })]) })).toMatch(/needs a `later`/);
  });

  test("a later score over the top of the scale fails the build", () => {
    expect(buildError({ log: doc([row({ later: 6 })]) })).toMatch(/needs a `later`/);
  });

  test("a cover the site does not ship fails the build", () => {
    // A path pointing at nothing would ship as a broken tile, exactly like a
    // mistyped photo path in a show.
    const message = buildError({ log: doc([row({ cover: "/img/dan-fm/gone.webp" })]) });

    expect(message).toContain("public/img/dan-fm/gone.webp");
  });

  test("a cover the site does ship builds", () => {
    // The control for the case above: without it, a check that rejected every
    // cover would pass that one and fail every real album.
    expect(buildError({ log: doc([row({ cover: `/${COVER}` })]) })).toBe("");
  });

  test("the failure names the file to open and the row in it", () => {
    // A build error that says neither is a hunt through a generated file
    // nobody wrote by hand.
    const message = buildError({
      log: doc([row(), row({ date: "2026-08-21", slug: "s", artist: "" })]),
    });

    expect(message).toContain("src/content/dan-fm.json");
    expect(message).toContain("`albums[1]`");
  });

  test("a broken fixture names the fixture rather than the fetched log", () => {
    /*
     * The two files fail through the same code, and the message is the only
     * thing that says which one to open. Naming the fetched log for a fault in
     * the fixture sends the reader to a file that is not there.
     */
    const message = buildError({ seed: doc([row({ artist: "" })]) }, { env: "1" });

    expect(message).toContain("src/content/dan-fm.seed.json");
  });
});

test.describe("what the build derives rather than trusts", () => {
  const spread = [
    row({ date: "2026-08-25", slug: "c" }),
    row({ date: "2026-08-20", slug: "a" }),
    row({ date: "2026-08-28", slug: "d" }),
    row({ date: "2026-08-22", slug: "b" }),
  ];

  test("day one is the oldest album however the file is ordered", () => {
    /*
     * The ordinal is a position in the log rather than a field the file
     * carries, so a stale number can never disagree with the albums it counts.
     * The rows here arrive scrambled because a generated file is only ever as
     * ordered as whatever wrote it.
     */
    const log = loadLog({ log: doc(spread) });
    const byDate = Object.fromEntries(log.albums.map((album) => [album.date, album.ordinal]));

    expect(byDate).toEqual({
      "2026-08-20": 1,
      "2026-08-22": 2,
      "2026-08-25": 3,
      "2026-08-28": 4,
    });
  });

  test("the ordinal counts albums rather than days", () => {
    /*
     * Two of the four gaps above are longer than a day. "Day 47" means the
     * forty-seventh album, not the forty-seventh morning - a log that skipped
     * a Sunday would otherwise start claiming days nobody listened on.
     */
    const log = loadLog({ log: doc(spread) });

    expect(log.albums.map((album) => album.ordinal).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  test("the log comes back newest first", () => {
    // Every list on the page reads down from the most recent, so the order is
    // the build's to fix rather than each component's to remember.
    const log = loadLog({ log: doc(spread) });

    expect(log.albums.map((album) => album.date)).toEqual([
      "2026-08-28",
      "2026-08-25",
      "2026-08-22",
      "2026-08-20",
    ]);
  });

  test("a pressing year cannot outlive the year itself", () => {
    /*
     * "1998, this pressing" is a claim about where a number came from. With no
     * number there is nothing for it to be about, and the page would render a
     * qualifier attached to nothing.
     */
    const log = loadLog({ log: doc([row({ year: null, yearIsPressing: true })]) });

    expect(log.albums[0]).toMatchObject({ year: null, yearIsPressing: false });
  });

  test("a pressing year survives a year that is there", () => {
    // The control: the flag has to reach the page in the case it is for, or
    // every reissue date is printed as though it were the original.
    const log = loadLog({ log: doc([row({ year: 1998, yearIsPressing: true })]) });

    expect(log.albums[0]).toMatchObject({ year: 1998, yearIsPressing: true });
  });

  test("a year the log could not say is null rather than zero", () => {
    // `null` is what the page renders around. A `0` would print as a year.
    expect(loadLog({ log: doc([row({ year: "" })]) }).albums[0].year).toBeNull();
  });

  test("a year nobody could read drops out rather than failing the build", () => {
    /*
     * The deliberate asymmetry with the score, which stops the build on exactly
     * this input. A score is what an entry is for; a year is a detail the log
     * routinely omits, so one unreadable cell drops out rather than holding the
     * site at its last payload until someone edits a sheet.
     *
     * What it must not do either way is coerce. `true` reaches `Number` as a
     * clean 1, and a year nobody typed would print beside the genre as one.
     */
    for (const year of [true, [1985], 1985.5, "not a year"]) {
      const log = loadLog({ log: doc([row({ year })]) });

      expect(log.albums[0].year, JSON.stringify(year)).toBeNull();
    }
  });

  test("a year written as digits is still a year", () => {
    // A sheet hands its cells over as text, so a string has to survive or every
    // year in the log drops out.
    expect(loadLog({ log: doc([row({ year: "1985" })]) }).albums[0].year).toBe(1985);
  });

  test("blank tags are dropped and the rest trimmed", () => {
    // A sheet's three tag columns arrive with the unused ones empty, and a
    // blank chip is a chip.
    const log = loadLog({ log: doc([row({ tags: ["  piano ", "", "   ", "late night"] })]) });

    expect(log.albums[0].tags).toEqual(["piano", "late night"]);
  });

  test("no later score leaves the first reading standing", () => {
    // Absent is the normal case on every row, so it cannot be an error and it
    // cannot arrive as anything but `null`.
    expect(loadLog({ log: doc([row()]) }).albums[0].later).toBeNull();
    expect(loadLog({ log: doc([row({ later: null })]) }).albums[0].later).toBeNull();
  });

  test("a row that named no standout still has one", () => {
    /*
     * An album can be worth hearing without a favourite standing out. The page
     * reads `standout.name` either way, so the shape has to be there even when
     * the row said nothing.
     */
    const log = loadLog({ log: doc([row()]) });

    expect(log.albums[0]).toMatchObject({
      standout: { name: "", id: "" },
      skip: { name: "", id: "" },
    });
  });

  test("a track named with no match on the release keeps the name", () => {
    // The id is what Spotify could resolve; the name is what I wrote down.
    // Losing the second because the first came back empty loses the sentence.
    const log = loadLog({ log: doc([row({ standout: { name: "Harbour Lights" } })]) });

    expect(log.albums[0].standout).toEqual({ name: "Harbour Lights", id: "" });
  });

  test("a row that wrote no review is blank rather than absent", () => {
    /*
     * `/dan-fm` splits the review into paragraphs the moment it draws an album,
     * so `review` has to be a string on every row or the page throws on the
     * first one where it is not - and it throws while rendering, which takes
     * the whole route down rather than leaving a gap on it.
     *
     * All three reach the page. A payload written before the sheet grew the
     * column carries no field at all, `null` is what a job passing an empty
     * cell straight through writes, and a number is what a half-succeeded fetch
     * leaves behind.
     */
    for (const review of [undefined, null, 42]) {
      const written = review === undefined ? row() : row({ review });

      expect(loadLog({ log: doc([written]) }).albums[0].review, JSON.stringify(review)).toBe("");
    }
  });

  test("a review keeps the blank lines its paragraphs are split on", () => {
    /*
     * The one field the build must not tidy. The cell behind it is text typed
     * into a spreadsheet, where a newline is a break somebody meant, and the
     * page turns every line with something on it into a paragraph. A reader
     * that collapsed whitespace here - the way it collapses a tag two fields
     * up - would hand the page one wall of text and lose the shape of
     * everything ever written in that column, silently and for every album at
     * once.
     *
     * Trimmed at the ends is the other half, and the pair has to be asserted
     * together: a trim that reached inside would pass an assertion on the ends
     * alone.
     */
    const log = loadLog({
      log: doc([row({ review: "  First paragraph.\n\nSecond paragraph.\n\nThird.  " })]),
    });

    expect(log.albums[0].review).toBe("First paragraph.\n\nSecond paragraph.\n\nThird.");
  });
});

test.describe("editing the log while the dev server runs", () => {
  test("a fetched log that changed on disk refreshes the page", () => {
    // A local run of the fetch should show up without a restart, the way a
    // local run of the Discogs or comics fetch already does.
    expect(reloadedAfterEditing("src/content/dan-fm.json")).toEqual([DAN_FM]);
  });

  test("the fixture refreshes the page too", () => {
    /*
     * The file that is actually being edited until the job has run once, so
     * leaving it out would mean the whole page is built against a fixture no
     * dev server ever notices changing.
     */
    expect(reloadedAfterEditing("src/content/dan-fm.seed.json")).toEqual([DAN_FM]);
  });

  test("an edit somewhere else in the content folder leaves the log alone", () => {
    /*
     * The watcher decides on a path, and a prefix rather than an equality would
     * make every collection reload every other one. `dan-fm.json` and
     * `dan-fm.seed.json` also share a prefix with each other, which is the pair
     * a loose match would collapse first.
     */
    expect(reloadedAfterEditing("src/content/vinyl.json")).not.toContain(DAN_FM);
    expect(reloadedAfterEditing("src/content/blog/a-post.md")).not.toContain(DAN_FM);
  });
});

test.describe("how an album names itself", () => {
  /** A row as the page reads it, for the summary functions to describe. */
  const album = {
    date: "2026-08-20",
    slug: "2026-08-20-the-standing-wave-low-tide-signals",
    artist: "The Standing Wave",
    album: "Low Tide Signals",
    year: 2019,
    genre: "Post-punk",
    score: 4,
  };

  test("the title is the artist and the album", () => {
    expect(albumTitle(album)).toBe("The Standing Wave - Low Tide Signals");
  });

  test("the summary names the genre, the year, the score and the day", () => {
    expect(albumSummary(album)).toBe("Post-punk, 2019 · 4 out of 5 · August 20, 2026");
  });

  test("an album with no year still says what it is", () => {
    // A null year is a real row - neither the log nor Spotify could say - and
    // it must not leave a dangling comma in a link preview.
    expect(albumSummary({ ...album, year: null })).toBe("Post-punk · 4 out of 5 · August 20, 2026");
  });

  test("the summary is never empty", () => {
    /*
     * It is the meta description and the share sheet's second line, and a blank
     * one is a link that previews as nothing. A date and a score always exist,
     * which is the reason this is metadata rather than the written take.
     */
    expect(albumSummary({ ...album, genre: "", year: null })).toBe("4 out of 5 · August 20, 2026");
  });

  test("a date the formatter cannot read leaves no dangling separator", () => {
    /*
     * `longDate` answers "" rather than "Invalid Date" precisely so nothing
     * baked into a shipped HTML file says that. Dropping the word without
     * dropping the separator in front of it trades one visible defect for
     * another.
     */
    expect(albumSummary({ ...album, date: "not a date" })).toBe("Post-punk, 2019 · 4 out of 5");
  });

  test("the album's address is its slug under /dan-fm", () => {
    expect(albumUrl(album)).toBe("/dan-fm/2026-08-20-the-standing-wave-low-tide-signals");
  });

  test("the printed top of the scale is the top the build accepts", () => {
    /*
     * Two constants in two files - `MAX_SCORE` here and the validator's own
     * bound - and nothing but this connects them. Let them drift and the page
     * prints "7 out of 5" for a row the build was happy to accept.
     */
    expect(buildError({ log: doc([row({ score: MAX_SCORE })]) })).toBe("");
    expect(buildError({ log: doc([row({ score: MAX_SCORE + 0.5 })]) })).toMatch(/needs a `score`/);
  });
});

/**
 * The runtime half, loaded the way the app loads it.
 *
 * `src/lib/dan-fm.ts` imports `virtual:dan-fm`, which only the content plugin
 * can answer, so Playwright cannot import it directly and there is no route yet
 * to reach it through a page. Vite itself resolves it: an SSR load runs the
 * real `resolveId` and `load` and hands back the evaluated module, which also
 * makes this the one test that proves the virtual module is wired end to end
 * rather than merely returning a string when called by name.
 *
 * Loaded once per worker, and the server is closed as soon as the module has
 * evaluated - the exports are values by then and outlive it.
 */
type DanFmModule = typeof import("../src/lib/dan-fm");

let pending: Promise<DanFmModule> | undefined;

function danFm(): Promise<DanFmModule> {
  pending ??= (async () => {
    const server = await createServer({
      root: path.resolve(),
      logLevel: "error",
      appType: "custom",
      /*
       * This exists to evaluate one module. A watcher left running would
       * outlive the test that made it, and the HMR socket binds a fixed port -
       * with a worker per test file, the second one to start would report a
       * clash it has no use for.
       */
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    });

    try {
      return (await server.ssrLoadModule("/src/lib/dan-fm.ts")) as DanFmModule;
    } finally {
      await server.close();
    }
  })();

  return pending;
}

/** Albums carrying nothing but the dates, which is all the span is read from. */
function dated(...dates: string[]): Album[] {
  // Cast rather than filled out: `statsFor` is documented as reading the dates
  // and nothing else, and fourteen fields nobody looks at would hide that.
  return dates.map((date) => ({ date }) as Album);
}

test.describe("the station's clock", () => {
  test("the station day is a date the log can be compared against", async () => {
    /*
     * `Album.date` is `YYYY-MM-DD` and this is compared against it with `===`.
     * The shape comes from `en-CA` rather than from a format string, so an ICU
     * that spelled it `2026-08-30, ` or `30/08/2026` would not throw - it would
     * quietly mean the station is never on air.
     */
    const { stationDate } = await danFm();

    expect(stationDate(new Date("2026-08-30T19:00:00Z"))).toBe("2026-08-30");
  });

  test("a visitor in UTC past midnight is still on the station's yesterday", async () => {
    /*
     * The whole reason there is a station clock. 06:30 UTC is 23:30 the day
     * before in California, and a reader in London at that hour has to be told
     * what is playing rather than that the station is dark.
     */
    const { stationDate } = await danFm();

    expect(stationDate(new Date("2026-08-31T06:30:00Z"))).toBe("2026-08-30");
    expect(stationDate(new Date("2026-08-31T07:30:00Z"))).toBe("2026-08-31");
  });

  test("the day boundary follows the station through the winter", async () => {
    /*
     * The same pair in January, when California is an hour further from UTC.
     * A fixed offset would satisfy the August pair above and put the boundary
     * an hour wrong for four months of the year.
     */
    const { stationDate } = await danFm();

    expect(stationDate(new Date("2026-01-15T07:30:00Z"))).toBe("2026-01-14");
    expect(stationDate(new Date("2026-01-15T08:30:00Z"))).toBe("2026-01-15");
  });
});

test.describe("what the log adds up to", () => {
  test("an empty log has no first and no latest", async () => {
    /*
     * The state the site ships in until the job has run once, so it is the
     * only one guaranteed to happen. Nothing here may throw and nothing may
     * come back as a number the page would print.
     */
    const { statsFor } = await danFm();

    expect(statsFor([])).toEqual({ total: 0, days: 0, first: undefined, latest: undefined });
  });

  test("one album spans one day", async () => {
    // Both ends counted. The first morning is day one, not day zero.
    const { statsFor } = await danFm();

    expect(statsFor(dated("2026-08-20"))).toMatchObject({ total: 1, days: 1 });
  });

  test("the span counts the days the log missed", async () => {
    /*
     * The reason the page shows both numbers: eleven albums over fourteen days
     * is a different claim from eleven over eleven. Four albums across a week
     * with three mornings missed is the same shape.
     */
    const { statsFor } = await danFm();

    const stats = statsFor(dated("2026-08-20", "2026-08-22", "2026-08-25", "2026-08-26"));

    expect(stats).toMatchObject({ total: 4, days: 7 });
  });

  test("the span is read off the dates rather than the order", async () => {
    /*
     * The list arrives newest-first from the build, and a caller may have
     * filtered or sorted it. Trusting position would report the span backwards
     * on exactly the list the build hands over.
     */
    const { statsFor } = await danFm();

    const stats = statsFor(dated("2026-08-26", "2026-08-20", "2026-08-22"));

    expect(stats.first?.date).toBe("2026-08-20");
    expect(stats.latest?.date).toBe("2026-08-26");
    expect(stats.days).toBe(7);
  });

  test("a span across a month keeps counting", async () => {
    // The arithmetic is a subtraction on two UTC midnights, so nothing about a
    // month's length or a clock change can reach it.
    const { statsFor } = await danFm();

    expect(statsFor(dated("2026-08-30", "2026-09-02")).days).toBe(4);
  });

  test("a date the span cannot read counts no days rather than one", async () => {
    /*
     * The span counts both ends, so it adds a day to the distance - and the
     * distance is now absent rather than zero for a string that is not a date.
     * Adding to the fallback instead of dropping it reports a one-day log for a
     * row nothing can place on a calendar, and the page prints that number
     * beside the album count as though it had been measured.
     *
     * The validator keeps such a row out of a build, so this is about what the
     * fallback is worth rather than about a row anyone will file.
     */
    const { statsFor } = await danFm();

    expect(statsFor(dated("not a date")).days).toBe(0);
    expect(statsFor(dated("2026-08-20", "not a date")).days).toBe(0);
  });
});

test.describe("the mixtape", () => {
  test("an album at the bar is on the tape", async () => {
    const { mixtape, MIXTAPE_SCORE } = await danFm();

    const kept = mixtape([{ slug: "a", score: MIXTAPE_SCORE } as Album]);

    expect(kept.map((album) => album.slug)).toEqual(["a"]);
  });

  test("an album under the bar is not", async () => {
    // Half a step below, which is the closest a score can get and still be one
    // I tolerated rather than one I liked.
    const { mixtape, MIXTAPE_SCORE } = await danFm();

    expect(mixtape([{ slug: "a", score: MIXTAPE_SCORE - 0.5 } as Album])).toEqual([]);
  });

  test("an empty log makes an empty tape", async () => {
    const { mixtape } = await danFm();

    expect(mixtape([])).toEqual([]);
  });

  test("the tape keeps the order it was handed", async () => {
    // Newest first, which is the order the build fixes and every list on the
    // page reads down from.
    const { mixtape } = await danFm();

    const kept = mixtape([
      { slug: "newest", score: 5 },
      { slug: "middle", score: 2 },
      { slug: "oldest", score: 4 },
    ] as Album[]);

    expect(kept.map((album) => album.slug)).toEqual(["newest", "oldest"]);
  });

  test("the tape defaults to the whole log", async () => {
    /*
     * The page's mixtape section calls this with nothing, so the default is
     * what it renders. Any other default renders an empty section rather than
     * an error, which is the shape nobody files a bug about.
     */
    const { albums, mixtape } = await danFm();

    expect(albums.length, "no albums in the log - nothing below is being asked").toBeGreaterThan(0);
    expect(mixtape().length, "no album in the log clears the bar").toBeGreaterThan(0);
    expect(mixtape()).toEqual(mixtape(albums));
  });

  test("an album with no favourite track still makes the tape", async () => {
    /*
     * Gated on the score alone, which is the only field every row has. Gating
     * on a standout as well would silently drop the best album of the month
     * because I never picked a single off it.
     */
    const { mixtape } = await danFm();

    const kept = mixtape([{ slug: "a", score: 5, standout: { name: "", id: "" } } as Album]);

    expect(kept.map((album) => album.slug)).toEqual(["a"]);
  });
});

test.describe("what is playing", () => {
  test("today's album is the one dated the station's today", async () => {
    const { albums, todaysAlbum } = await danFm();

    expect(albums.length, "no albums in the log - nothing below is being asked").toBeGreaterThan(0);

    // 18:00 UTC is late morning in California on the same date, in either half
    // of the year, so this holds whatever dates the log carries.
    const newest = albums[0];

    expect(todaysAlbum(new Date(`${newest.date}T18:00:00Z`))?.slug).toBe(newest.slug);
  });

  test("nothing is playing on a day the log never covered", async () => {
    // The empty state the page renders, and the one every day before the log
    // started falls into.
    const { todaysAlbum } = await danFm();

    expect(todaysAlbum(new Date("1970-01-01T18:00:00Z"))).toBeUndefined();
  });

  test("an album is not on air until the station's midnight, not the visitor's", async () => {
    /*
     * 04:00 UTC on an album's own date is 21:00 the evening before in
     * California. Reading the visitor's clock would put the next day's album on
     * air seven hours early for anyone east of the Atlantic - which is the same
     * bug as the station being dark, seen from the other side.
     */
    const { albums, todaysAlbum } = await danFm();

    expect(albums.length, "no albums in the log - nothing below is being asked").toBeGreaterThan(0);

    const newest = albums[0];

    expect(todaysAlbum(new Date(`${newest.date}T04:00:00Z`))?.slug).not.toBe(newest.slug);
  });
});

test.describe("the station light", () => {
  test("an empty log has nothing to feature and an unlit lamp", async () => {
    /*
     * Launch day, and every day after it until the job commits its first row -
     * the state the site actually ships in. Nothing here may throw, and
     * `featured` has to come back absent rather than as a row the page would
     * then try to draw a cover and a score off.
     */
    const { station } = await danFm();

    expect(station([])).toEqual({ lamp: "off-air", featured: undefined });
  });

  test("an album in the log lights the lamp", async () => {
    const { station } = await danFm();

    expect(station(dated("2026-08-30"))).toMatchObject({ lamp: "on-air" });
  });

  test("the lamp is decided by the log rather than by a clock", async () => {
    /*
     * An album logged one evening is what is playing the next day, so age is
     * not currently what the light follows - having anything in the log is.
     *
     * Named for what it checks rather than for what it forbids. A rule about
     * how stale the newest album may be would narrow this, and a case called
     * "no elapsed time takes it off air" would have to be deleted to allow
     * that, which reads as removing a guarantee rather than tightening one.
     */
    const { station } = await danFm();

    expect(station(dated("2026-08-20"))).toMatchObject({
      lamp: "on-air",
      featured: expect.objectContaining({ date: "2026-08-20" }),
    });
  });

  test("the featured album is the newest by date rather than the first in the list", async () => {
    /*
     * The build hands the page a newest-first payload, but nothing in the
     * signature says a caller's list is sorted. Taking the head would light the
     * lamp off whichever row happened to be first and put the wrong album on
     * the front page while every date on it still read correctly.
     */
    const { station } = await danFm();

    const now = station(dated("2026-08-25", "2026-08-30", "2026-08-20"));

    expect(now.featured?.date).toBe("2026-08-30");
    expect(now.lamp).toBe("on-air");
  });

  test("the station defaults to the whole log", async () => {
    /*
     * `/dan-fm` calls this with no list at all, so the default is what the page
     * renders. Any other default leaves the lamp permanently dark and the front
     * page permanently on its launch-day copy - a failure nobody files a bug
     * about, because it looks like a station that has not started yet.
     */
    const { albums, station } = await danFm();

    expect(albums.length, "no albums in the log - nothing below is being asked").toBeGreaterThan(0);

    expect(station()).toEqual(station(albums));
    expect(station().featured).toBeDefined();
  });
});
