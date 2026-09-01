import path from "node:path";

import { expect, test } from "@playwright/test";
import * as cheerio from "cheerio";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { createServer } from "vite";

import { albumUrl } from "../src/lib/dan-fm-summary";

import type { Album } from "../src/lib/dan-fm";

/**
 * The Charts and Mixtape sections, rendered in Node.
 *
 * These two sections have states the committed log cannot put on a page. The
 * fixture is eight albums with a standout and a Spotify link on every keeper,
 * so the rows that name no favourite track and the ones the log has no link
 * for are unreachable from a browser - and the log below the chart minimum is
 * the state `ci.yml` deliberately never builds. Growing the fixture until it
 * held all of them would change every count the archive's cases are measured
 * against, to cover branches that are decided by a prop.
 *
 * So the components are asked directly, the way `tests/dan-fm.spec.ts` asks the
 * modules behind them: Vite resolves `virtual:dan-fm` for the imports on the
 * way in, and `renderToStaticMarkup` runs the same render React runs. What is
 * left for `tests/dan-fm-page.spec.ts` is everything about the section as it
 * actually ships - that it is on the page, wired to the committed log, and
 * drawn with bars the right length.
 *
 * Loaded once per worker, and the server is closed as soon as the modules have
 * evaluated - the exports outlive it.
 */
interface Sections {
  charts: typeof import("../src/components/dan-fm-charts");
  mixtape: typeof import("../src/components/dan-fm-mixtape");
  lib: typeof import("../src/lib/dan-fm");
}

let pending: Promise<Sections> | undefined;

function sections(): Promise<Sections> {
  pending ??= (async () => {
    const server = await createServer({
      root: path.resolve(),
      logLevel: "error",
      appType: "custom",
      /*
       * The same server settings `tests/dan-fm.spec.ts` evaluates the log
       * under, and for the same reasons: a watcher left running outlives the
       * test that made it, and the HMR socket binds a fixed port that a second
       * worker would clash on.
       */
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    });

    try {
      const [charts, mixtape, lib] = await Promise.all([
        server.ssrLoadModule("/src/components/dan-fm-charts.tsx"),
        server.ssrLoadModule("/src/components/dan-fm-mixtape.tsx"),
        server.ssrLoadModule("/src/lib/dan-fm.ts"),
      ]);

      return { charts, mixtape, lib } as Sections;
    } finally {
      await server.close();
    }
  })();

  return pending;
}

/**
 * A section's markup, wrapped the way the app wraps it.
 *
 * The router is what the tape's rows need to render a `Link` at all; the charts
 * hold none and are wrapped anyway, so a link added to a board is a rendered
 * link rather than a thrown error.
 */
function drawn(node: ReactElement) {
  return cheerio.load(renderToStaticMarkup(createElement(MemoryRouter, null, node)));
}

/**
 * An album filed under everything a section reads.
 *
 * The dates are distinct and ascending with `day`, because both sections are
 * handed the payload's own newest-first order and one of them draws a line off
 * the dates - a batch of albums sharing one day would let a component that
 * sorted for itself pass on a list it could not reorder.
 */
function heard(day: number, over: Partial<Album> = {}): Album {
  return {
    date: new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10),
    slug: `album-${day}`,
    artist: `Artist ${day}`,
    album: `Album ${day}`,
    year: 2000 + day,
    genre: `Genre ${day}`,
    source: `Source ${day}`,
    from: `Person ${day}`,
    score: 3,
    standout: { name: `Standout ${day}`, id: "" },
    url: `https://open.spotify.com/album/${day}`,
    later: null,
    ...over,
  } as Album;
}

/** A log of `count` albums, every one of them filed differently. */
function logOf(count: number, over: Partial<Album> = {}): Album[] {
  return Array.from({ length: count }, (_, day) => heard(day, over));
}

/**
 * `names` people with `each` albums apiece, which is what an averaging board
 * needs before it draws a row for any of them.
 */
function recommended(names: number, each: number): Album[] {
  return Array.from({ length: names * each }, (_, day) =>
    heard(day, { from: `Person ${day % names}` }),
  );
}

/** The chart panels, which is what a board that has gone missing is missing from. */
function panels($: cheerio.CheerioAPI) {
  return $("[data-slot='chart-board']");
}

test.describe("the charts section", () => {
  test("a log short of the minimum counts down rather than drawing", async () => {
    /*
     * One album short, which is the last day the section is allowed to be a
     * sentence. Counted down from the constant rather than named as a month,
     * since the log misses days and a date would drift off the count the first
     * time one is skipped.
     *
     * `ci.yml` builds the fixture and the fixture clears the minimum, so this
     * state never reaches a browser under CI - which is exactly why it is asked
     * here rather than left to the page.
     */
    const { charts, lib } = await sections();

    const $ = drawn(createElement(charts.DanFmCharts, { albums: logOf(lib.CHART_MINIMUM - 1) }));

    expect(panels($), "a log under the minimum drew boards").toHaveLength(0);
    expect($("body").text()).toContain("1 to go");
  });

  test("a log at the minimum exactly draws every board", async () => {
    /*
     * The other side of the same boundary, and the reason it is worth pinning
     * from both: the gate reads `<`, and the `<=` that looks the same in a diff
     * holds the whole section back a day for a log that has earned it.
     */
    const { charts, lib } = await sections();

    const albums = logOf(lib.CHART_MINIMUM);
    const $ = drawn(createElement(charts.DanFmCharts, { albums }));

    expect($("body").text(), "a log at the minimum was still counting down").not.toContain("to go");
    for (const board of lib.chartsFor(albums).boards) {
      expect(
        $("h3")
          .toArray()
          .map((heading) => $(heading).text()),
        `the ${board.id} board is not on the page`,
      ).toContain(board.title);
    }
  });

  test("a board with nothing to show says so in its own panel", async () => {
    /*
     * Every album the same genre, out of the same decade, found the same
     * unrecorded way and recommended by nobody - a log that clears the gate and
     * gives all four boards nothing to draw.
     *
     * Each of them has to keep its panel and print its own sentence. Dropping
     * out of the grid instead leaves a section whose shape changes with the log,
     * and a reader who came back for a board goes looking for one that has not
     * gone anywhere.
     */
    const { charts, lib } = await sections();

    const albums = logOf(lib.CHART_MINIMUM, {
      genre: "Jazz",
      year: 2019,
      source: "",
      from: "",
    });
    const $ = drawn(createElement(charts.DanFmCharts, { albums }));

    const boards = lib.chartsFor(albums).boards;
    expect(
      boards.filter((board) => board.rows.length > 0),
      "this log no longer starves all four boards - nothing below is being asked",
    ).toEqual([]);

    // One more panel than there are boards: the score line has one too, and it
    // is the only one of the five this log can fill.
    expect(panels($)).toHaveLength(boards.length + 1);
    expect($("li"), "a board with no rows drew rows anyway").toHaveLength(0);

    for (const board of boards) {
      expect($("body").text(), `the ${board.id} board went quiet instead of saying why`).toContain(
        board.empty,
      );
    }
  });

  test("a cut board says so on the page, under the rows it cut", async () => {
    /*
     * `BoardPanel` prints whatever `note` holds and nothing else on the section
     * says a ranked board was cut, so a panel that stopped rendering the note
     * would leave eight names reading as the whole field.
     *
     * Twenty names with the minimum apiece overflow a board of any size the cap
     * is likely to take. The guard on the note is what keeps that from being an
     * assumption: a cap raised past twenty fails here instead of leaving a case
     * that quietly asks nothing.
     */
    const { charts, lib } = await sections();

    const albums = recommended(20, lib.RECOMMENDER_MINIMUM);
    const names = lib.chartsFor(albums).boards.find((board) => board.id === "from");

    expect(names, "the charts no longer hold a `from` board").toBeDefined();
    expect(
      names!.note,
      "this log no longer cuts the names board - nothing below is being asked",
    ).toMatch(/^Top \d+ of \d+ names with /);

    const $ = drawn(createElement(charts.DanFmCharts, { albums }));
    const panel = panels($)
      .toArray()
      .map((node) => $(node))
      .find((node) => node.find("h3").text() === names!.title);

    expect(panel, "the names board is not on the page").toBeDefined();
    expect(panel!.text(), "the board was cut and its own panel does not say so").toContain(
      names!.note,
    );
  });

  test("the section says what the log averages", async () => {
    // The one figure on the section that is not a board, and the only place the
    // whole log is scored as one number.
    const { charts, lib } = await sections();

    const albums = logOf(lib.CHART_MINIMUM, { score: 4 });
    const $ = drawn(createElement(charts.DanFmCharts, { albums }));

    expect($("body").text()).toContain(`Average 4 across ${albums.length}`);
  });
});

test.describe("the mixtape section", () => {
  /** One track per row, which is the whole of what the tape lists. */
  function tracks($: cheerio.CheerioAPI): string[] {
    return $("li")
      .toArray()
      .map((row) => $(row).find(`a[href^='/dan-fm/']`).children("span").eq(0).text());
  }

  test("an album that named no favourite track is listed under its own title", async () => {
    /*
     * The tape is gated on the score alone, so an album that scored well
     * without a single standing out is on it - and the row has to say something
     * on the line where a track name goes. Falling through to an empty line
     * leaves a numbered row with a subtitle and no title, which reads as a
     * broken row rather than as an album nobody picked a single off.
     */
    const { mixtape, lib } = await sections();

    const album = heard(1, { score: lib.MIXTAPE_SCORE, standout: { name: "", id: "" } });
    const $ = drawn(createElement(mixtape.DanFmMixtape, { albums: [album] }));

    expect(tracks($)).toEqual([album.album]);
  });

  test("a row that is naming the album rather than a track says which it is", async () => {
    /*
     * The other half of the same row. An album title standing where a track
     * name usually stands is read as a song somebody picked off the record, and
     * the two are frequently the same words - so the line underneath has to be
     * what separates them.
     */
    const { mixtape, lib } = await sections();

    const album = heard(1, { score: lib.MIXTAPE_SCORE, standout: { name: "", id: "" } });
    const $ = drawn(createElement(mixtape.DanFmMixtape, { albums: [album] }));

    const subline = $("li").find(`a[href^='/dan-fm/']`).children("span").eq(1).text();

    expect(subline).toContain(album.artist);
    expect(subline, "a row naming the album is passing it off as a track").not.toContain(
      album.album,
    );
  });

  test("a row that named a track leads with it and names the album underneath", async () => {
    // The ordinary row, so the fallback above cannot be satisfied by a tape
    // that prints the album on every row.
    const { mixtape, lib } = await sections();

    const album = heard(1, { score: lib.MIXTAPE_SCORE });
    const $ = drawn(createElement(mixtape.DanFmMixtape, { albums: [album] }));

    expect(tracks($)).toEqual([album.standout.name]);
    expect($("li").find(`a[href^='/dan-fm/']`).children("span").eq(1).text()).toBe(
      `${album.artist} · ${album.album}`,
    );
  });

  test("a keeper the log has no link for gets no link out", async () => {
    /*
     * `url` is "" on any row the sheet carried no link on, and an anchor built
     * off it points at the page it is on. The row still belongs on the tape -
     * the link is what the log happens to know, not what earned the album its
     * place - so the cell goes empty rather than the row going missing.
     */
    const { mixtape, lib } = await sections();

    const $ = drawn(
      createElement(mixtape.DanFmMixtape, {
        albums: [
          heard(2, { score: lib.MIXTAPE_SCORE, url: "" }),
          heard(1, { score: lib.MIXTAPE_SCORE }),
        ],
      }),
    );

    const rows = $("li");

    expect(rows, "the row with no link was dropped from the tape").toHaveLength(2);

    /*
     * Counted rather than matched on the href, because the anchor a missing
     * link builds is `href=""` - which is not a Spotify address, matches no
     * pattern written to find one, and resolves to the page the reader is
     * already on. A row owes exactly one link, to the album's own page here.
     */
    expect(rows.eq(0).find("a"), "the row with no link still built an anchor").toHaveLength(1);
    expect(rows.eq(1).find("a"), "the row with a link lost it").toHaveLength(2);
    expect(rows.eq(1).find(`a[href^='http']`).attr("href")).toBe(heard(1).url);
  });

  test("the tape lists in the order it was handed", async () => {
    /*
     * `mixtape()` keeps the order it is given and the page hands it the
     * payload, which the build fixes newest-first. A section that sorted for
     * itself, or that reversed what it was handed, buries this week's records
     * at the bottom of a year of them with every row on screen still correct.
     */
    const { mixtape, lib } = await sections();

    const albums = [3, 2, 1].map((day) => heard(day, { score: lib.MIXTAPE_SCORE }));
    const $ = drawn(createElement(mixtape.DanFmMixtape, { albums }));

    expect(
      $("li")
        .toArray()
        .map((row) => $(row).find(`a[href^='/dan-fm/']`).attr("href")),
    ).toEqual(albums.map((album) => albumUrl(album)));
  });

  test("a log with nothing over the bar says so instead of listing", async () => {
    /*
     * Counted off the scores rather than off the rows: a log of nothing but 3s
     * has plenty in it and still nothing to play. The sentence has to name the
     * bar, because a reader looking at a full archive beside an empty tape is
     * owed the reason.
     */
    const { mixtape, lib } = await sections();

    const $ = drawn(
      createElement(mixtape.DanFmMixtape, {
        albums: logOf(4, { score: lib.MIXTAPE_SCORE - 0.5 }),
      }),
    );

    expect($("li")).toHaveLength(0);
    expect($("body").text()).toContain(`Nothing has scored a ${lib.MIXTAPE_SCORE} yet`);
  });

  test("the tape numbers its rows for the eye and hides the numbers from the ear", async () => {
    /*
     * An ordered list already numbers itself for anything reading it aloud, so
     * a second set of numbers in the text is every position announced twice.
     * The written ones are the tape's own hand-written label and nothing more -
     * which is also why they are padded, and why a tenth track has to read "10"
     * rather than "010".
     */
    const { mixtape, lib } = await sections();

    const $ = drawn(
      createElement(mixtape.DanFmMixtape, {
        albums: logOf(10, { score: lib.MIXTAPE_SCORE }),
      }),
    );

    expect(
      // The row's own child, so the icon inside the Spotify link - hidden for
      // the same reason and nested deeper - is not counted as a position.
      $("li > [aria-hidden='true']")
        .toArray()
        .map((label) => $(label).text()),
    ).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
  });
});
