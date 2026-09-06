import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

import {
  danFmLinks,
  plainParagraphs,
  plainText,
  reviewProblems,
  takeProblems,
} from "../src/lib/dan-fm-markdown";
import { MAX_SCORE, albumSummary, albumTitle, albumUrl } from "../src/lib/dan-fm-summary";
import { tierFor } from "../src/lib/rating-heat";
import { contentPlugin } from "../vite-plugin-content";

import type { Album, Board, DanFmCharts, DanFmPayload, Selection } from "../src/lib/dan-fm";
import { ALLOWED, REFUSALS } from "./markdown-cases";

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
/** The landing page's digest, which every collection edit also makes stale. */
const SITE_INDEX = (contentPlugin() as unknown as Hooks).resolveId("virtual:site-index");

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

  test("a fetched log wins over a fixture the build only allows", () => {
    /*
     * How the fixture retires itself at a dev server. The day the job commits a
     * real payload, `npm run dev` stops reading the made-up one without anybody
     * remembering to delete it.
     */
    const log = loadLog(
      { log: doc([row({ artist: "FETCHED" })]), seed: doc([row({ artist: "FIXTURE" })]) },
      { command: "serve" },
    );

    expect(log.albums.map((album) => album.artist)).toEqual(["FETCHED"]);
  });

  test("a fixture the build asked for by name wins over a fetched log", () => {
    /*
     * The other half, and the reason the two are different questions. A sweep
     * asks for the fixture because it needs what the fixture has - several
     * albums, a score over the tape's bar, a second review. The real log is
     * whatever was heard, and on its first day that was one album scoring 3.5.
     * Retire the fixture here too and every case written against it stops
     * testing anything, without one of them going red to say so.
     */
    const log = loadLog(
      { log: doc([row({ artist: "FETCHED" })]), seed: doc([row({ artist: "FIXTURE" })]) },
      { command: "build", env: "1" },
    );

    expect(log.albums.map((album) => album.artist)).toEqual(["FIXTURE"]);
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

  test("a score off the quarter-step grid fails the build", () => {
    /*
     * The page draws the score as a fractional fill, so a 3.7 would settle
     * silently at a position the scale does not offer rather than say anything
     * about itself.
     */
    expect(buildError({ log: doc([row({ score: 3.7 })]) })).toMatch(/needs a `score`/);
  });

  test("a quarter step is a score the build takes", () => {
    /*
     * The grid the sheet is scored on. Every other row in this file files a
     * whole number, so a validator still pinned to half steps would satisfy all
     * of them and refuse the log the moment a real score landed here.
     */
    const log = loadLog({ log: doc([row({ score: 4.25, later: 3.75 })]) });

    expect(log.albums[0]).toMatchObject({ score: 4.25, later: 3.75 });
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
    expect(reloadedAfterEditing("src/content/dan-fm.json")).toEqual([DAN_FM, SITE_INDEX]);
  });

  test("the fixture refreshes the page too", () => {
    /*
     * The file that is actually being edited until the job has run once, so
     * leaving it out would mean the whole page is built against a fixture no
     * dev server ever notices changing.
     */
    expect(reloadedAfterEditing("src/content/dan-fm.seed.json")).toEqual([DAN_FM, SITE_INDEX]);
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
    later: null,
  };

  test("the title is the artist and the album", () => {
    expect(albumTitle(album)).toBe("The Standing Wave - Low Tide Signals");
  });

  test("the summary names the genre, the year, the score and the day", () => {
    expect(albumSummary(album)).toBe("Post-punk, 2019 · 4 out of 5 · August 20, 2026");
  });

  test("a rescored album's summary states where it stands", () => {
    // The preview is one number with no room for history: a link saying 3
    // while the page's stars draw 4.5 is a link contradicting the page it
    // opens.
    expect(albumSummary({ ...album, score: 3, later: 4.5 })).toBe(
      "Post-punk, 2019 · 4.5 out of 5 · August 20, 2026",
    );
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
    /*
     * Named so the module evaluates against the fixture rather than the fetched
     * log. The cases below that take no argument are asking what the page's own
     * sections render, and those want the several albums and the score over the
     * tape's bar that the fixture is built to hold - the committed log is
     * whatever was actually heard, and a quiet week of nothing above the bar
     * would turn "the tape defaults to the whole log" red without anything
     * being wrong with the tape.
     */
    const before = process.env.DANFM_SEED;
    process.env.DANFM_SEED = "1";

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
      if (before === undefined) delete process.env.DANFM_SEED;
      else process.env.DANFM_SEED = before;
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

/**
 * Midday on a station day, as an instant.
 *
 * 19:00 UTC is late morning in California in either half of the year, so the
 * station's day is the one named here whichever side of a daylight-saving
 * change it falls. Every case that asserts what the lamp reads passes one of
 * these rather than letting `station` reach for the machine's clock, which
 * would make the answer depend on the day the suite happened to run.
 */
function noon(date: string): Date {
  return new Date(`${date}T19:00:00Z`);
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

  test("a second reading that clears the bar puts the album on the tape", async () => {
    /*
     * The whole point of logging a second score. A record that grew on me is
     * one I would put on a tape, and reading the first score here meant that
     * second thought could be typed into the sheet and change nothing anyone
     * could see.
     */
    const { mixtape, MIXTAPE_SCORE } = await danFm();

    const kept = mixtape([
      { slug: "grew-on-me", score: MIXTAPE_SCORE - 1, later: MIXTAPE_SCORE } as Album,
    ]);

    expect(kept.map((album) => album.slug)).toEqual(["grew-on-me"]);
  });

  test("a second reading under the bar takes the album off the tape", async () => {
    /*
     * The same rule in the direction that is easier to leave out. A promotion
     * and a demotion are one act of changing my mind, and a tape that took the
     * second reading only when it flattered the record would be a tape of
     * whichever number was kinder.
     */
    const { mixtape, MIXTAPE_SCORE } = await danFm();

    expect(
      mixtape([{ slug: "talked-myself-into-it", score: 5, later: MIXTAPE_SCORE - 0.5 } as Album]),
    ).toEqual([]);
  });

  test("no second reading leaves the first one standing", async () => {
    // The ordinary row, and the one every other case here is written on: an
    // album nobody scored twice is still on the tape on the score it has.
    const { mixtape, MIXTAPE_SCORE } = await danFm();

    const kept = mixtape([{ slug: "a", score: MIXTAPE_SCORE, later: null } as Album]);

    expect(kept.map((album) => album.slug)).toEqual(["a"]);
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

    expect(station(dated("2026-08-30"), noon("2026-08-30"))).toMatchObject({ lamp: "on-air" });
  });

  test("an album the station has aged out of takes the lamp with it", async () => {
    /*
     * What the light follows now: the age of the newest album rather than the
     * mere existence of one. `AIR_DAYS` is the album's own day and the one
     * after, so two days on is the first the badge reads quiet.
     *
     * The album is still featured while it does, and that half matters as much
     * as the lamp - the page has to go on showing the record it has gone quiet
     * about, or a missed day empties the front page.
     */
    const { station } = await danFm();

    expect(station(dated("2026-08-20"), noon("2026-08-22"))).toMatchObject({
      lamp: "off-air",
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

    const now = station(dated("2026-08-25", "2026-08-30", "2026-08-20"), noon("2026-08-30"));

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

    // One instant for both calls. Two reads of the machine's clock can land
    // either side of the station's midnight, which is a difference in the lamp
    // and nothing to do with which list was passed.
    const at = new Date();

    expect(station(undefined, at)).toEqual(station(albums, at));
    expect(station(undefined, at).featured).toBeDefined();
  });
});

/*
 * The archive's filters.
 *
 * All of this is decided before a browser exists: which controls the bar
 * offers, what each one holds, and which rows a set of them leaves standing.
 * `tests/dan-fm-page.spec.ts` covers the half that cannot be answered here -
 * that the controls on the page are wired to these, and that a link carries
 * what they were set to.
 */

/**
 * An album carrying the four things a row files itself under, and a score.
 *
 * Cast rather than filled out, for the reason `dated` is. Every field is always
 * present rather than left to the caller to remember, because a facet is
 * offered or dropped on what the *whole* list holds: one row accidentally
 * missing a genre changes the answer for every other row in the case.
 */
function filed(over: Partial<Album> = {}): Album {
  return { slug: "", genre: "", source: "", shelf: "", tags: [], score: 3, ...over } as Album;
}

/**
 * A selection with the named controls set and every other one left alone.
 *
 * Built by walking `FILTER_KEYS` rather than written out, so a control added to
 * the archive without being added here fails as a missing key rather than as a
 * quietly unfiltered one.
 */
function set(
  { ALL, FILTER_KEYS }: Pick<DanFmModule, "ALL" | "FILTER_KEYS">,
  over: Partial<Selection> = {},
): Selection {
  return { ...(Object.fromEntries(FILTER_KEYS.map((key) => [key, ALL])) as Selection), ...over };
}

/** One album at every score the log can hold, for the bands to cut up. */
function theWholeScale(): Album[] {
  const scale: Album[] = [];
  for (let score = 1; score <= MAX_SCORE; score += 0.5) scale.push(filed({ score }));

  return scale;
}

test.describe("what the archive offers to filter by", () => {
  test("a log of one album offers nothing to filter it by", async () => {
    /*
     * The rule the whole bar hangs off, and the state the site is in today. One
     * album has one genre, one source and one shelf, so every control over it
     * is a control that cannot be moved to any effect - and a reader has to
     * open all five to find that out. The score pills go the same way, for the
     * same reason.
     */
    const { facetsFor, bandsFor } = await danFm();

    const only = [
      filed({ genre: "Jazz", source: "A crate dig", shelf: "Keeping", tags: ["piano"], score: 5 }),
    ];

    expect(facetsFor(only)).toEqual([]);
    expect(bandsFor(only)).toEqual([]);
  });

  test("an empty log offers nothing to filter it by", async () => {
    // Launch day, and every day until the job commits its first row. Nothing
    // here may throw, and no control may come back over a vocabulary read off
    // no rows at all.
    const { facetsFor, bandsFor } = await danFm();

    expect(facetsFor([])).toEqual([]);
    expect(bandsFor([])).toEqual([]);
  });

  test("a facet is offered only where the log disagrees", async () => {
    /*
     * Decided per facet and not per bar. Two albums found the same way, put on
     * the same shelf, under the same tag differ only in genre, and the genre is
     * the only one of the four worth a control. Dropping the bar wholesale, or
     * keeping it wholesale, both satisfy a case that only counts the controls.
     */
    const { facetsFor } = await danFm();

    const list = [
      filed({ genre: "Jazz", source: "A crate dig", shelf: "Keeping", tags: ["piano"] }),
      filed({ genre: "Post-punk", source: "A crate dig", shelf: "Keeping", tags: ["piano"] }),
    ];

    expect(facetsFor(list).map((facet) => facet.id)).toEqual(["genre"]);
  });

  test("the controls come back in the order the bar reads them", async () => {
    // Written out rather than compared against `FACET_IDS`, which is the same
    // list and would agree with itself however it had been scrambled on the way
    // through. This is the left-to-right order of the bar on screen.
    const { facetsFor } = await danFm();

    const list = [
      filed({ genre: "Jazz", source: "A crate dig", shelf: "Keeping", tags: ["piano"] }),
      filed({ genre: "Post-punk", source: "The radio", shelf: "Not for me", tags: ["loud"] }),
    ];

    expect(facetsFor(list).map((facet) => facet.id)).toEqual(["genre", "tag", "source", "shelf"]);
  });

  test("a blank cell is not something to filter by", async () => {
    /*
     * A row may leave any of the four empty, and the fetched log does. A blank
     * arriving as an option puts an entry labelled with nothing in the dropdown
     * - and it makes the facet look like it narrows, when all it would narrow
     * to is the rows that said nothing.
     */
    const { facetsFor } = await danFm();

    const list = [filed({ genre: "Jazz" }), filed({ genre: "" })];

    expect(facetsFor(list)).toEqual([
      expect.objectContaining({ id: "genre", options: [{ value: "Jazz", count: 1 }] }),
    ]);
  });

  test("options are alphabetical rather than ranked by what the log holds most of", async () => {
    /*
     * A dropdown is scanned for a value the reader already has in mind, and a
     * list that reorders itself as the log fills is one they have to read
     * twice. These three arrive in one order, rank by count in a second and
     * sort into a third, so neither of the other two can satisfy this.
     *
     * The counts are the second half: they are out of the whole log rather than
     * out of what is currently on screen.
     */
    const { facetsFor } = await danFm();

    const list = [
      filed({ genre: "Post-punk" }),
      filed({ genre: "Post-punk" }),
      filed({ genre: "Post-punk" }),
      filed({ genre: "Ambient folk" }),
      filed({ genre: "Jazz" }),
      filed({ genre: "Jazz" }),
    ];

    expect(facetsFor(list)[0].options).toEqual([
      { value: "Ambient folk", count: 1 },
      { value: "Jazz", count: 2 },
      { value: "Post-punk", count: 3 },
    ]);
  });

  test("an album is filed under every tag it carries", async () => {
    /*
     * The one facet that is a list rather than a cell. Read as a single value
     * it would offer "piano, late night" as an option no other row could ever
     * match. The untagged row counts towards the total and towards no option,
     * which is what leaves "piano" narrowing anything at all.
     */
    const { facetsFor } = await danFm();

    const list = [
      filed({ tags: ["piano", "late night"] }),
      filed({ tags: ["piano"] }),
      filed({ tags: [] }),
    ];

    expect(facetsFor(list)).toEqual([
      expect.objectContaining({
        id: "tag",
        options: [
          { value: "late night", count: 1 },
          { value: "piano", count: 2 },
        ],
      }),
    ]);
  });
});

test.describe("the archive's score bands", () => {
  test("a log inside one band offers no score control", async () => {
    // `facetsFor`'s rule, over the scale. A good run is three keepers, and a
    // row of pills whose only live one is already showing everything is
    // furniture for the same reason a one-option dropdown is.
    const { bandsFor } = await danFm();

    expect(bandsFor([filed({ score: 4 }), filed({ score: 4.5 }), filed({ score: 5 })])).toEqual([]);
  });

  test("a band nothing fell into is not offered", async () => {
    // Every pill prints its own tally, so a band kept at zero is a pill reading
    // 0 that empties the list when it is pressed.
    const { bandsFor } = await danFm();

    expect(bandsFor([filed({ score: 5 }), filed({ score: 1 })]).map((band) => band.id)).toEqual([
      "keepers",
      "low",
    ]);
  });

  test("every score the log can hold lands in exactly one band", async () => {
    /*
     * The bands are a partition of the scale and nothing in the code says so:
     * they are three predicates written separately, and a `>` where a `>=`
     * belongs leaves a score in none of them or in two. Neither reports itself
     * - a score in no band is a row no pill can reach, and one in two is
     * counted twice in a tally the pills print beside their labels.
     */
    const { bandsFor } = await danFm();

    const scale = theWholeScale();
    const bands = bandsFor(scale);

    for (const album of scale) {
      expect(
        bands.filter((band) => band.holds(album.score)).map((band) => band.id),
        `a score of ${album.score} is not in exactly one band`,
      ).toHaveLength(1);
    }

    expect(
      bands.reduce((running, band) => running + band.count, 0),
      "the pills' tallies do not add up to the log they were counted from",
    ).toBe(scale.length);
  });

  test("the bands are read best first", async () => {
    const { bandsFor } = await danFm();

    expect(bandsFor(theWholeScale()).map((band) => band.id)).toEqual([
      "keepers",
      "middling",
      "low",
    ]);
  });

  test("the top band is the mixtape's bar rather than a figure of its own", async () => {
    /*
     * The two surfaces cut the scale in the same place, which is why the band
     * is written off `MIXTAPE_SCORE` rather than off a number beside it.
     * Counted against `mixtape` rather than against a figure here, so the claim
     * is checked through two independent readings of the bar: an album sitting
     * exactly on it is on the tape and in the top band, and a `>` in either one
     * moves it out of one and not the other.
     */
    const { bandsFor, mixtape, MIXTAPE_SCORE } = await danFm();

    const scale = theWholeScale();
    const keepers = bandsFor(scale).find((band) => band.id === "keepers");

    expect(keepers?.count).toBe(mixtape(scale).length);
    expect(keepers?.label, "the top pill advertises a bar the tape does not take").toBe(
      `${MIXTAPE_SCORE} and up`,
    );
  });

  test("a band is drawn on the standing score, so it cannot hide what the tape plays", async () => {
    /*
     * Both halves of the pill on one album: the count behind it and the rows it
     * leaves standing. A band still reading the first score would offer a "4
     * and up" filter that answered with nothing while the tape above it played
     * the promoted album - the reconciliation the bar exists to avoid.
     */
    const { bandsFor, filterAlbums, mixtape, ALL, FILTER_KEYS, MIXTAPE_SCORE } = await danFm();

    const grew = filed({ slug: "grew-on-me", score: MIXTAPE_SCORE - 1, later: MIXTAPE_SCORE });
    const log = [grew, filed({ slug: "middling", score: MIXTAPE_SCORE - 1 })];

    expect(bandsFor(log).find((band) => band.id === "keepers")?.count).toBe(1);
    expect(
      filterAlbums(log, set({ ALL, FILTER_KEYS }, { score: "keepers" })).map((album) => album.slug),
    ).toEqual(["grew-on-me"]);
    expect(mixtape(log).map((album) => album.slug)).toEqual(["grew-on-me"]);
  });
});

test.describe("narrowing the archive", () => {
  test("nothing set leaves the log exactly as it arrived", async () => {
    /*
     * Order included. The rows are read newest first because the build hands
     * them over that way, so a matcher that sorted or grouped on the way
     * through would reorder the whole archive the moment anyone touched a
     * control - and put it back the moment they cleared it.
     */
    const module = await danFm();

    const list = [filed({ slug: "c" }), filed({ slug: "a" }), filed({ slug: "b" })];

    expect(module.filterAlbums(list, set(module))).toEqual(list);
  });

  test("two controls narrow to the rows both agree on", async () => {
    // An `or` here shows a reader who asked for two things the rows that
    // answered either, which is more rows than they started with on one of
    // them.
    const module = await danFm();

    const list = [
      filed({ slug: "both", genre: "Jazz", shelf: "Keeping" }),
      filed({ slug: "genre-only", genre: "Jazz", shelf: "Passing it on" }),
      filed({ slug: "shelf-only", genre: "Post-punk", shelf: "Keeping" }),
    ];

    expect(
      module
        .filterAlbums(list, set(module, { genre: "Jazz", shelf: "Keeping" }))
        .map((a) => a.slug),
    ).toEqual(["both"]);
  });

  test("a tag matches an album carrying it among others", async () => {
    const module = await danFm();

    const list = [
      filed({ slug: "several", tags: ["piano", "late night"] }),
      filed({ slug: "one", tags: ["loud"] }),
      filed({ slug: "none", tags: [] }),
    ];

    expect(
      module.filterAlbums(list, set(module, { tag: "late night" })).map((a) => a.slug),
    ).toEqual(["several"]);
  });

  test("a band narrows on the score and nothing else", async () => {
    // Against `mixtape` again rather than against a list written out here, so
    // the pills and the tape go on agreeing about which records are the good
    // ones.
    const module = await danFm();

    const scale = theWholeScale();

    expect(module.filterAlbums(scale, set(module, { score: "keepers" }))).toEqual(
      module.mixtape(scale),
    );
  });

  test("a score no band names shows the log rather than nothing", async () => {
    /*
     * What a link should do once a band has been renamed underneath it: show
     * the archive. Taking it literally answers with an empty list and nothing
     * on the page to say why it is empty.
     *
     * This is also how `all` is handled - there is no case for it, only a band
     * lookup that finds nothing - so a matcher that started rejecting unknown
     * ids would empty the archive for every reader who had not touched a
     * control.
     */
    const module = await danFm();

    const list = [filed({ slug: "a", score: 5 }), filed({ slug: "b", score: 1 })];

    expect(module.filterAlbums(list, set(module, { score: "tepid" }))).toEqual(list);
  });

  test("a facet value the log does not hold matches nothing", async () => {
    /*
     * The facets are taken literally where the score is not, and the split is
     * deliberate: a facet value that is not in the log is screened out by the
     * page before it reaches here, against the vocabulary it built the control
     * from. Falling back here as well would put a control set to something the
     * log has stopped holding behind a full archive that looks untouched.
     */
    const module = await danFm();

    const list = [filed({ slug: "a", genre: "Jazz" }), filed({ slug: "b", genre: "Post-punk" })];

    expect(module.filterAlbums(list, set(module, { genre: "Doo-wop" }))).toEqual([]);
  });

  test("nothing set is not filtering, and any one control on its own is", async () => {
    /*
     * What puts the Clear link on the page. Every key is asked rather than one,
     * because a control left out of the check leaves a reader who set only that
     * one looking at three rows with nothing on screen offering to put the rest
     * back.
     */
    const module = await danFm();

    expect(module.isFiltered(set(module))).toBe(false);

    for (const key of module.FILTER_KEYS) {
      expect(
        module.isFiltered(set(module, { [key]: "anything" } as Partial<Selection>)),
        `a ${key} on its own does not count as filtering`,
      ).toBe(true);
    }
  });
});

/*
 * The charts.
 *
 * Four boards and a line, and every figure on any of them is decided here.
 * `tests/dan-fm-page.spec.ts` covers the half that needs a browser: that the
 * section on screen is drawing these answers, and that a bar is as long as the
 * number printed beside it.
 */

/**
 * An album carrying the five fields a board reads, and nothing else.
 *
 * Cast rather than filled out, for the reason `dated` and `filed` are: the
 * boards read five fields and eighteen more would hide which. Every one of them
 * is always set rather than left to the caller, because a board decides what to
 * draw on what the *whole* list holds - one row accidentally missing a genre
 * changes whether the genre board draws at all.
 */
function heard(over: Partial<Album> = {}): Album {
  return {
    date: "2026-08-20",
    genre: "",
    source: "",
    from: "",
    year: null,
    score: 3,
    ...over,
  } as Album;
}

/** One board out of a set, by the id it is filed under. */
function board(charts: DanFmCharts, id: string): Board {
  const found = charts.boards.find((one) => one.id === id);

  expect(found, `the charts no longer hold a \`${id}\` board`).toBeDefined();
  return found!;
}

/** `count` albums filed the same way, which is how a board earns a row. */
function repeated(count: number, over: Partial<Album>): Album[] {
  return Array.from({ length: count }, () => heard(over));
}

/**
 * `names` distinct values in one column, `each` albums behind every one of
 * them, labelled `<prefix> 0` upwards.
 *
 * The prefix is what lets one log hold two sets of names in the same column,
 * which is how a board is given more names than it can draw and more again
 * that never clear the minimum.
 */
function grouped(field: "from" | "source", prefix: string, names: number, each: number): Album[] {
  return Array.from({ length: names }, (_, index) =>
    repeated(each, { [field]: `${prefix} ${index}` }),
  ).flat();
}

/**
 * How many rows a ranked board draws, read off the genre board.
 *
 * `BOARD_ROWS` is private to the module, and reading the cap off the board
 * under test would let a dropped `slice` carry the expected size along with it
 * instead of failing. The genre board slices the same constant, and its own cut
 * is pinned above against a written-out count.
 */
async function boardRows(): Promise<number> {
  const { chartsFor } = await danFm();

  const pool = 40;
  const genres = Array.from({ length: pool }, (_, index) => heard({ genre: `Genre ${index}` }));
  const drawn = board(chartsFor(genres), "genre").rows.length;

  expect(drawn, "the ranked boards no longer cut a tail at all").toBeLessThan(pool);
  return drawn;
}

test.describe("what the whole log adds up to", () => {
  test("an empty log averages nothing rather than zero", async () => {
    /*
     * The state the site ships in, and the one number on the section that is
     * not a board. Zero is a score outside the scale, so a page printing it
     * would be claiming the log averages worse than its worst possible album.
     */
    const { chartsFor } = await danFm();

    expect(chartsFor([]).average).toBeNull();
  });

  test("an empty log draws no line and no rows, and every board still says why", async () => {
    // Nothing here may throw and nothing may come back as a figure the page
    // would draw a bar to.
    const { chartsFor } = await danFm();

    const charts = chartsFor([]);

    expect(charts.line).toEqual([]);
    for (const one of charts.boards) {
      expect(one.rows, `the ${one.id} board drew rows off an empty log`).toEqual([]);
      expect(one.empty, `the ${one.id} board has nothing to say for an empty log`).not.toBe("");
      expect(one.title, `the ${one.id} board no longer names itself`).not.toBe("");
    }
  });

  test("the average is over every album, to one decimal", async () => {
    const { chartsFor } = await danFm();

    // 13 over three, which is 4.333... - a mean the scale cannot hold and the
    // page has to round before it prints.
    expect(chartsFor([heard({ score: 4 }), heard({ score: 5 }), heard({ score: 4 })]).average).toBe(
      4.3,
    );
  });

  test("an average that lands on a whole number is printed as one", async () => {
    /*
     * `Rating`'s rule, on a log somebody keeps by hand: 4, not 4.0. The
     * rounding is a `toFixed`, which hands back a string, and a board that
     * printed that string would read "4.0" everywhere the arithmetic came out
     * even.
     */
    const { chartsFor } = await danFm();

    expect(chartsFor([heard({ score: 3.5 }), heard({ score: 4.5 })]).average).toBe(4);
  });

  test("the score line reads oldest first however the log arrives", async () => {
    /*
     * The one board with time on an axis, and the only place the log's order
     * is visible as a shape rather than as a list. The payload arrives
     * newest-first, so a line that trusted position would draw every run
     * backwards - rising where the log fell - with every score on it correct.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      heard({ date: "2026-08-26", score: 5 }),
      heard({ date: "2026-08-20", score: 2 }),
      heard({ date: "2026-08-22", score: 4 }),
    ]);

    expect(charts.line).toEqual([2, 4, 5]);
  });

  test("the boards come back in the order the section draws them", async () => {
    // Written out rather than read off the boards, which would agree with
    // itself however they had been scrambled. This is the reading order of the
    // grid on screen.
    const { chartsFor } = await danFm();

    expect(chartsFor([]).boards.map((one) => one.id)).toEqual([
      "genre",
      "decade",
      "source",
      "from",
    ]);
  });

  test("a share board is drawn against the log and an average against the scale", async () => {
    /*
     * What `top` is for, and the two boards read it for opposite reasons. A
     * share board given the rating scale draws every bar at a fifth of the
     * length it owes; an average board given the log's size draws a 5 as a
     * sliver on any log longer than five albums. Neither reports itself - both
     * are bars of the wrong length beside figures that are still right.
     */
    const { chartsFor } = await danFm();

    const list = [
      ...repeated(2, { genre: "Jazz", from: "Alexis", score: 4 }),
      ...repeated(2, { genre: "Post-punk", source: "A crate dig", score: 5 }),
    ];
    const charts = chartsFor(list);

    expect(board(charts, "genre").top).toBe(list.length);
    expect(board(charts, "decade").top).toBe(list.length);
    expect(board(charts, "source").top).toBe(MAX_SCORE);
    expect(board(charts, "from").top).toBe(MAX_SCORE);
  });
});

test.describe("the boards that count what the log is made of", () => {
  test("one genre is not something to set against anything", async () => {
    /*
     * `facetsFor`'s rule, applied to a board instead of a control: a single row
     * draws one bar at full width, which claims the log is all one thing. The
     * sentence in its place says that better, and says it without a chart that
     * looks like a measurement.
     */
    const { chartsFor } = await danFm();

    expect(board(chartsFor(repeated(3, { genre: "Jazz" })), "genre").rows).toEqual([]);
  });

  test("two genres are", async () => {
    // The other side of the same boundary. One is furniture and two is a
    // comparison, and nothing between them exists.
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(2, { genre: "Jazz" }),
      ...repeated(1, { genre: "Post-punk" }),
    ]);

    expect(board(charts, "genre").rows).toEqual([
      { name: "Jazz", count: 2, value: 2 },
      { name: "Post-punk", count: 1, value: 1 },
    ]);
  });

  test("a genre the log never named is not a genre", async () => {
    /*
     * A row may leave the cell empty and the fetched log does. A blank arriving
     * as a name puts a bar on the board labelled with nothing - and it counts
     * as the second genre that lets the board draw at all, so a log of one
     * genre and one blank would draw the comparison this board refuses.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([...repeated(2, { genre: "Jazz" }), ...repeated(2, { genre: "" })]);

    expect(board(charts, "genre").rows).toEqual([]);
  });

  test("genres are ranked by share, and ties broken alphabetically", async () => {
    /*
     * These three arrive in one order, rank in a second and sort into a third,
     * so neither of the other two can satisfy this. The tie is the second half:
     * two genres level on count have to come back in an order that does not
     * depend on which was logged first, or the board reshuffles itself every
     * time a record lands.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(1, { genre: "Post-punk" }),
      ...repeated(2, { genre: "Noise rock" }),
      ...repeated(3, { genre: "Jazz" }),
      ...repeated(2, { genre: "Ambient folk" }),
    ]);

    expect(board(charts, "genre").rows.map((row) => row.name)).toEqual([
      "Jazz",
      "Ambient folk",
      "Noise rock",
      "Post-punk",
    ]);
  });

  test("a ranked board leaves its tail to a line of text", async () => {
    /*
     * Nine genres into eight rows. "Aardvark" is the one that has to go, and it
     * sorts first alphabetically - so a board that cut the tail off the wrong
     * ordering keeps it and drops a genre the log holds twice as much of.
     *
     * The note is the other half: eight bars off a log of nine genres is a
     * board that reads as the whole log unless it says otherwise.
     */
    const { chartsFor } = await danFm();

    const many = "BCDEFGHI"
      .split("")
      .flatMap((letter) => repeated(2, { genre: `${letter} genre` }));
    const charts = chartsFor([...repeated(1, { genre: "Aardvark" }), ...many]);

    const rows = board(charts, "genre").rows;

    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.name)).not.toContain("Aardvark");
    expect(board(charts, "genre").note).toBe("Top 8 of 9 genres");
  });

  test("a board that fits says nothing about a tail", async () => {
    // Exactly the eight it draws. A note counting "Top 8 of 8" is a footnote
    // about nothing, and it reads as though something were missing.
    const { chartsFor } = await danFm();

    const charts = chartsFor(
      "ABCDEFGH".split("").flatMap((letter) => repeated(1, { genre: `${letter} genre` })),
    );

    expect(board(charts, "genre").rows).toHaveLength(8);
    expect(board(charts, "genre").note).toBeUndefined();
  });

  test("decades come back chronological rather than ranked", async () => {
    /*
     * A run of decades is read as a timeline. Ranking it files the 1970s
     * between the 2010s and the 1990s, which is not a mistake anybody makes
     * twice and is exactly what sharing one sort with the genre board would do.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(3, { year: 2019 }),
      ...repeated(1, { year: 1975 }),
      ...repeated(2, { year: 1998 }),
    ]);

    expect(board(charts, "decade").rows).toEqual([
      { name: "1970s", count: 1, value: 1 },
      { name: "1990s", count: 2, value: 2 },
      { name: "2010s", count: 3, value: 3 },
    ]);
  });

  test("a record with no year gets no bar and is counted underneath", async () => {
    /*
     * A row the log could not date is not a point in time, and a bucket for
     * them would sit in the timeline as though it were one. Leaving them out
     * silently is the other failure: the bars are shares of the whole log, so
     * the missing ones have to be accounted for somewhere or the board is
     * quietly drawn against a number it never names.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(1, { year: 2019 }),
      ...repeated(1, { year: 1998 }),
      ...repeated(2, { year: null }),
    ]);

    expect(board(charts, "decade").rows.map((row) => row.name)).toEqual(["1990s", "2010s"]);
    expect(board(charts, "decade").note).toBe("2 with no year");
  });

  test("a log the whole of one decade draws no decade board", async () => {
    // The share rule again, and the undated rows cannot make up the second row
    // it needs - they are not a decade.
    const { chartsFor } = await danFm();

    const charts = chartsFor([...repeated(3, { year: 2019 }), ...repeated(2, { year: null })]);

    expect(board(charts, "decade").rows).toEqual([]);
  });

  test("the decade board is not capped where the ranked boards are", async () => {
    /*
     * Uncapped on purpose: how many decades a record can come from is bounded
     * by how long records have existed, and a timeline with its oldest end cut
     * off is a different claim about the log rather than a shorter one.
     */
    const { chartsFor } = await danFm();

    const century = Array.from({ length: 12 }, (_, step) => heard({ year: 1900 + step * 10 }));

    expect(board(chartsFor(century), "decade").rows).toHaveLength(12);
  });
});

test.describe("the boards that score what the log came from", () => {
  test("one album behind a name is not a track record on either board", async () => {
    /*
     * The rule `vinyl.ts` applies to its collected-most boards. An average over
     * one album is that album, and a single lucky 5 would otherwise top a
     * leaderboard on it - on both of these boards, which are the same
     * arithmetic over two different columns and are exactly the pair a later
     * refactor flattens into one.
     */
    const { chartsFor, RECOMMENDER_MINIMUM } = await danFm();

    expect(RECOMMENDER_MINIMUM).toBeGreaterThan(1);

    const charts = chartsFor([
      heard({ source: "A crate dig", from: "Sam", score: 5 }),
      heard({ source: "The radio", from: "Alexis", score: 5 }),
    ]);

    expect(board(charts, "source").rows, "a source with one album behind it scored").toEqual([]);
    expect(board(charts, "from").rows, "a name with one album behind it scored").toEqual([]);
  });

  test("one qualifying row is a board where one genre is not", async () => {
    /*
     * The asymmetry, in one log. A count of one is a fact and an average of one
     * is not: the share boards refuse a lone row because a share means nothing
     * without the shares beside it, and an averaging board draws one because an
     * average is a number on a scale the reader already knows the ends of.
     *
     * Two rules, and they are not in the plan. Flattening them into one takes
     * out either the lone bar at full width or the only row a young log can
     * earn, and whichever goes, the other board still looks right.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor(repeated(2, { genre: "Jazz", year: 2019, from: "Alexis", score: 4 }));

    expect(board(charts, "genre").rows, "one genre drew a board").toEqual([]);
    expect(board(charts, "decade").rows, "one decade drew a board").toEqual([]);
    expect(board(charts, "from").rows).toEqual([{ name: "Alexis", count: 2, value: 4 }]);
  });

  test("a recommendation nobody signed is not somebody's track record", async () => {
    /*
     * "" is how the log records my own pick, and there are more of those than
     * of anyone else's. Grouped as a name they add up to a row on the board
     * with no label, sitting among people.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor(repeated(3, { from: "", score: 5 }));

    expect(board(charts, "from").rows).toEqual([]);
  });

  test("an averaging board is ranked best first, and ties broken alphabetically", async () => {
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(2, { from: "Zoe", score: 5 }),
      ...repeated(2, { from: "Sam", score: 4 }),
      ...repeated(2, { from: "Alexis", score: 5 }),
    ]);

    expect(board(charts, "from").rows.map((row) => row.name)).toEqual(["Alexis", "Zoe", "Sam"]);
  });

  test("a row says what its average is over as well as what it is", async () => {
    /*
     * Two people at 4.5 off two albums and off eight are not the same claim,
     * and the board is read as a leaderboard either way. The count is what
     * stops the second one being taken for the first.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(1, { from: "Alexis", score: 4 }),
      ...repeated(1, { from: "Alexis", score: 5 }),
      ...repeated(1, { from: "Alexis", score: 4 }),
      ...repeated(2, { from: "Sam", score: 4 }),
    ]);

    expect(board(charts, "from").rows).toEqual([
      { name: "Alexis", count: 3, value: 4.3 },
      { name: "Sam", count: 2, value: 4 },
    ]);
  });

  test("a board that drew nothing keeps its rule to itself", async () => {
    /*
     * The note under an averaging board states the minimum a name has to clear.
     * On a board with no rows the sentence in place of them already says it,
     * and printing both leaves the reader with the rule twice and the reason
     * once.
     */
    const { chartsFor } = await danFm();

    const empty = board(chartsFor(repeated(2, { from: "Alexis", score: 4 })), "source");

    expect(empty.rows).toEqual([]);
    expect(empty.note).toBeUndefined();
    expect(empty.empty).not.toBe("");
  });

  test("a board that drew something owes the reader its rule", async () => {
    // The other side: a leaderboard that silently drops everyone with one
    // album behind them reads as everyone.
    const { chartsFor } = await danFm();

    const drawn = board(chartsFor(repeated(2, { from: "Alexis", score: 4 })), "from");

    expect(drawn.rows).toHaveLength(1);
    expect(drawn.note, "a board that filtered its names does not say so").toBeTruthy();
  });

  test("a cut board of names says in one sentence how many cleared the bar", async () => {
    /*
     * A ranked board that dropped names reads as the whole field, which is what
     * the genre board's tail note answers - and this says it in that shape, so
     * two boards side by side are read the same way.
     *
     * The count and the rule are one sentence rather than two, because a "Top 8
     * of 12 names" over a separate "2 recommendations before a name appears."
     * leaves the reader working out whether the 12 already had the bar applied
     * to it. No full stop on it: this is a label over the rows, like "Top 8 of
     * 9 genres", and not the sentence the untruncated board prints.
     */
    const { chartsFor, RECOMMENDER_MINIMUM } = await danFm();
    const rows = await boardRows();
    const names = rows + 4;

    const charts = chartsFor(grouped("from", "Name", names, RECOMMENDER_MINIMUM));

    expect(board(charts, "from").rows).toHaveLength(rows);
    expect(board(charts, "from").note).toBe(
      `Top ${rows} of ${names} names with ${RECOMMENDER_MINIMUM} recommendations or more`,
    );
  });

  test("a cut board of sources counts albums, not recommendations", async () => {
    /*
     * The same sentence over the other column, and the two nouns are the whole
     * of what differs between them. Both boards are one piece of arithmetic
     * filed under two fields, so a pair of notes worded the same way is a
     * source board crediting recommendations nobody made - with every figure
     * on it still correct.
     */
    const { chartsFor, RECOMMENDER_MINIMUM } = await danFm();
    const rows = await boardRows();
    const sources = rows + 2;

    const charts = chartsFor(grouped("source", "Source", sources, RECOMMENDER_MINIMUM));

    expect(board(charts, "source").rows).toHaveLength(rows);
    expect(board(charts, "source").note).toBe(
      `Top ${rows} of ${sources} sources with ${RECOMMENDER_MINIMUM} albums or more`,
    );
  });

  test("the count in a cut note is of the names that cleared the bar", async () => {
    /*
     * As many one-off names in the log as there are names on the board. Counted
     * before the minimum is applied, the sentence is false in its own terms: it
     * would claim a field of eighteen names with two recommendations or more
     * while half of them have one, and the reader has no way to see it.
     *
     * One name over the cap as well, which is the smallest board that gets a
     * tail note at all.
     */
    const { chartsFor, RECOMMENDER_MINIMUM } = await danFm();
    const rows = await boardRows();
    const names = rows + 1;

    const charts = chartsFor([
      ...grouped("from", "Name", names, RECOMMENDER_MINIMUM),
      ...grouped("from", "One-off", names, 1),
    ]);

    expect(board(charts, "from").rows).toHaveLength(rows);
    expect(board(charts, "from").rows.map((row) => row.name)).not.toContain("One-off 0");
    expect(board(charts, "from").note).toBe(
      `Top ${rows} of ${names} names with ${RECOMMENDER_MINIMUM} recommendations or more`,
    );
  });

  test("a board that fits keeps the plain rule, full stop and all", async () => {
    /*
     * Exactly the rows it draws, which is the other side of the boundary the
     * cut note reads. A `>=` there prints "Top 8 of 8 names with 2
     * recommendations or more" - a footnote about nothing, which reads as
     * though a name had been left off.
     *
     * The full stop is the tell that the two notes are different kinds of
     * thing: a sentence stating the board's rule, against a label counting its
     * rows.
     */
    const { chartsFor, RECOMMENDER_MINIMUM } = await danFm();
    const rows = await boardRows();

    const charts = chartsFor(grouped("from", "Name", rows, RECOMMENDER_MINIMUM));

    expect(board(charts, "from").rows).toHaveLength(rows);
    expect(board(charts, "from").note).toBe(
      `${RECOMMENDER_MINIMUM} recommendations before a name appears.`,
    );
  });

  test("a board whose names all fall under the bar prints no note at all", async () => {
    /*
     * Not the same emptiness as a column nobody filled: every one of these
     * names is in the log, and the minimum is what leaves the board with
     * nothing to draw. The sentence standing in for the rows already states the
     * rule, so a note under it hands the reader the rule twice and the reason
     * once.
     */
    const { chartsFor, RECOMMENDER_MINIMUM } = await danFm();
    const rows = await boardRows();

    const charts = chartsFor(grouped("from", "Name", rows + 4, RECOMMENDER_MINIMUM - 1));

    expect(board(charts, "from").rows).toEqual([]);
    expect(board(charts, "from").note).toBeUndefined();
    expect(board(charts, "from").empty).not.toBe("");
  });

  test("the two averaging boards score their own column", async () => {
    /*
     * One `pick` swapped for the other is a pair of boards that agree with each
     * other and describe one column twice - and the titles above them would
     * still read correctly.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor([
      ...repeated(2, { source: "A crate dig", from: "Alexis", score: 5 }),
      ...repeated(2, { source: "The radio", from: "Sam", score: 2 }),
    ]);

    expect(board(charts, "source").rows.map((row) => row.name)).toEqual([
      "A crate dig",
      "The radio",
    ]);
    expect(board(charts, "from").rows.map((row) => row.name)).toEqual(["Alexis", "Sam"]);
  });

  test("a board counts the score given on the day rather than the second reading", async () => {
    /*
     * A row can carry a `later` score, and a board that quietly preferred it
     * would be averaging one number for those albums and a different one for
     * the rest. What living with a record did to it is printed beside the
     * record, where both figures are shown.
     */
    const { chartsFor } = await danFm();

    const charts = chartsFor(repeated(2, { from: "Alexis", score: 5, later: 1 }));

    expect(board(charts, "from").rows).toEqual([{ name: "Alexis", count: 2, value: 5 }]);
    expect(chartsFor(repeated(2, { score: 5, later: 1 })).average).toBe(5);
  });
});

test.describe("the markdown contract's one spelling", () => {
  /*
   * The shared table from `markdown-cases.ts`, run against the module the
   * build validates with; `update-dan-fm.spec.ts` runs the same table against
   * the script's mirror, and the two halves are what keep the mirrors in
   * step.
   */
  for (const refusal of REFUSALS) {
    test(`${refusal.construct} is refused`, () => {
      expect(takeProblems(refusal.cell).join("\n")).toContain(refusal.names);

      if (refusal.fields === "both") {
        expect(reviewProblems(refusal.cell).join("\n")).toContain(refusal.names);
      } else {
        expect(reviewProblems(refusal.cell), "a review refused what only a take refuses").toEqual(
          [],
        );
      }
    });
  }

  for (const allowed of ALLOWED) {
    test(`${allowed.construct} passes`, () => {
      expect(reviewProblems(allowed.cell)).toEqual([]);
      if (!allowed.reviewOnly) expect(takeProblems(allowed.cell)).toEqual([]);
    });
  }

  test("a blank field is valid everywhere - not every album gets a piece", () => {
    expect(reviewProblems("")).toEqual([]);
    expect(takeProblems("")).toEqual([]);
    expect(plainParagraphs("")).toEqual([]);
  });

  test("no GFM: tildes and pipes stay the characters the author typed", () => {
    expect(plainParagraphs("~~struck~~ gold")).toEqual(["~~struck~~ gold"]);
    expect(reviewProblems("| a | b |")).toEqual([]);
  });
});

test.describe("stripping a review to plain text", () => {
  /*
   * `share.spec.ts` makes these same claims of `nowParagraphs`; they are
   * re-made here because this is a different parser (bare CommonMark, no
   * GFM) whose stripper must not inherit the failure cases by accident.
   */
  test("a link keeps its label whatever its destination holds", () => {
    expect(plainParagraphs("Check out [this link](http://example.com/a_(b)) for more.")).toEqual([
      "Check out this link for more.",
    ]);
    expect(
      plainParagraphs("See [it](https://en.wikipedia.org/wiki/Now_(album)_(disambiguation)) here."),
    ).toEqual(["See it here."]);
    expect(plainParagraphs("Read [a [b] c](https://example.com) today.")).toEqual([
      "Read a [b] c today.",
    ]);
  });

  test("an unclosed bracket does not swallow the next link", () => {
    expect(
      plainParagraphs(
        "Bought a new phone [finally and here's [the review](https://example.com) online.",
      ),
    ).toEqual(["Bought a new phone [finally and here's the review online."]);
  });

  test("a reference link unwraps and its definition is not a paragraph", () => {
    expect(plainParagraphs("Heard [here][src] first.\n\n[src]: https://example.com")).toEqual([
      "Heard here first.",
    ]);
  });

  test("marks come off, and list items arrive as their own paragraphs", () => {
    expect(plainText("It *lands* and `stays`.\n\nTwo sides:\n\n- the A side\n- the B side")).toBe(
      "It lands and stays. Two sides: the A side the B side",
    );
  });

  test("danFmLinks reads inline and reference targets in order", () => {
    expect(danFmLinks("See [a](/vinyl) then [b][r].\n\n[r]: https://example.com")).toEqual([
      "/vinyl",
      "https://example.com",
    ]);
  });
});

test.describe("markdown the payload cannot carry", () => {
  /*
   * The same shared table, this time through `loadLog` - the gate that guards
   * the hand-written seed and any hand-edited payload, which never pass
   * through the fetch script's mirror.
   */
  for (const refusal of REFUSALS) {
    test(`${refusal.construct} fails the build naming the row`, () => {
      const take = buildError({ log: doc([row({ take: refusal.cell })]) });
      expect(take).toContain("albums[0]");
      expect(take).toContain(refusal.names);

      if (refusal.fields === "both") {
        expect(buildError({ log: doc([row({ review: refusal.cell })]) })).toContain(refusal.names);
      } else {
        expect(
          buildError({ log: doc([row({ review: refusal.cell })]) }),
          "the build refused a review for what only a take refuses",
        ).toBe("");
      }
    });
  }

  for (const allowed of ALLOWED) {
    test(`${allowed.construct} passes and lands verbatim`, () => {
      const fields = allowed.reviewOnly
        ? { review: allowed.cell }
        : { review: allowed.cell, take: allowed.cell };
      const log = loadLog({ log: doc([row(fields)]) });

      expect(log.albums[0].review).toBe(allowed.cell);
      if (!allowed.reviewOnly) expect(log.albums[0].take).toBe(allowed.cell);
    });
  }

  test("an internal album link has to name an album in the payload", () => {
    const error = buildError({
      log: doc([row({ review: "Better than [that one](/dan-fm/2026-09-99-nobody-nothing)." })]),
    });

    expect(error).toContain(
      '`albums[0]`.review links to "/dan-fm/2026-09-99-nobody-nothing", which no album in the payload answers to',
    );
  });

  test("an internal album link may name any album, tracking stripped", () => {
    const other = {
      date: "2026-08-21",
      slug: "2026-08-21-other-band-other-record",
      artist: "Other Band",
      album: "Other Record",
      score: 3,
    };
    const log = loadLog({
      log: doc([
        row({ review: "See [the other one](/dan-fm/2026-08-21-other-band-other-record?ref=1)." }),
        other,
      ]),
    });

    expect(log.albums).toHaveLength(2);
  });
});

test.describe("the star ladder's tiers", () => {
  test("the quarter-step boundaries land where the specimen drew them", () => {
    // The exact steps either side of each threshold: the ladder is the
    // design, so a drifted comparison operator shows up here by name.
    expect(tierFor(3.75)).toBe("base");
    expect(tierFor(4)).toBe("ember");
    expect(tierFor(4.25)).toBe("ember");
    expect(tierFor(4.5)).toBe("gold");
    expect(tierFor(4.75)).toBe("gold");
    expect(tierFor(5)).toBe("blue");
  });
});
