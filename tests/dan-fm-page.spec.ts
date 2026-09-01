import { expect, test, type Locator, type Page } from "@playwright/test";

import { MAX_SCORE } from "../src/lib/dan-fm-summary";

import { albumsOnDisk } from "./dan-fm";

/**
 * What `/dan-fm` puts on screen, at four different todays.
 *
 * The station light is a reading of the calendar, so a test that asserted one
 * of its states without owning the clock would mean something different
 * tomorrow and nothing at all next month. Every case here fixes the browser's
 * clock before the bundle runs and asserts against a day it chose.
 *
 * `station()` takes its today from `new Date()` through an `Intl` formatter
 * rather than from `Date.now()`, so whether a fake clock reaches it is a
 * question rather than an assumption - and the on-air case answers it, because
 * the day it fixes is in the past and the page cannot produce that state
 * without the fake clock having got through.
 *
 * `page.clock.setFixedTime` rather than `install`: only `Date` needs faking.
 * The lamp is decided once while React renders, and freezing the timers React
 * schedules on would be a second thing to go wrong for no coverage.
 *
 * What the states mean is settled without a browser in `tests/dan-fm.spec.ts`,
 * over `station()` and a handful of dated rows. These exist for the half that
 * cannot answer: that the lamp on the page is wired to that function at all,
 * that the sentence under the album is the one its state calls for, and that
 * the two cannot drift apart.
 */

/**
 * The log the built page was made from.
 *
 * The station features the newest album by date rather than the first row in
 * the file: the payload's newest-first order is how the build writes it, not
 * something a reader of the file is entitled to assume.
 */
const LOGGED = albumsOnDisk();
const NEWEST = [...LOGGED].sort((a, b) => a.date.localeCompare(b.date)).at(-1);

/**
 * What that album is, defaulted rather than asserted.
 *
 * A run with no log on disk at all - someone has deleted the committed fixture
 * - is answered in `openOn` below, and these are what let it get that far: an
 * argument is evaluated before the function that would have stood the test
 * down, so reading the date straight off an absent album throws on the way in
 * and reports a `TypeError` instead of the reason.
 */
const NEWEST_DATE = NEWEST?.date ?? "1970-01-01";
const NEWEST_TITLE = NEWEST?.album ?? "";
const NEWEST_SCORE = NEWEST?.score ?? 0;

/**
 * "August 28, 2026" from a `YYYY-MM-DD` date, spelled by ICU rather than by
 * `longDate`, so the page is compared against a date formatted somewhere other
 * than in the code that formatted it.
 */
const SPELLED = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function spelled(date: string): string {
  return SPELLED.format(new Date(`${date}T00:00:00Z`));
}

/** The station day `days` on from `date`, counted here rather than by the page. */
function daysAfter(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Opens `/dan-fm` with the station's day set to `on`.
 *
 * 18:00 UTC is late morning in the station's timezone in either half of the
 * year and never near a midnight in it, so the instant lands on the date asked
 * for without the test having to know whether daylight saving is in force.
 */
async function openOn(page: Page, on: string) {
  /*
   * Standing down for a missing log is a local courtesy and nothing more: the
   * fixture is committed, so a CI checkout without one has had it deleted. A
   * skip there would take every test that opens the page with it and say
   * nothing, which is the silence the launch-day carve-out below refuses.
   */
  test.skip(
    !process.env.CI && NEWEST === undefined,
    "no album log on disk to take the station's dates from",
  );
  expect(NEWEST, "the committed album log is not on disk").toBeDefined();

  await page.clock.setFixedTime(new Date(`${on}T18:00:00Z`));
  await page.goto("/dan-fm");
  await page.getByRole("heading", { level: 1, name: "dan.fm" }).waitFor();

  /*
   * A build made without `DANFM_SEED=1` ships an empty log, and everything
   * below is about a card that build does not render. `ci.yml` always seeds, so
   * an empty station there is the regression these tests exist to catch rather
   * than a reason to stand down - which is why the skip is refused under CI
   * instead of quietly hiding the whole file.
   */
  const launchDay = await page.getByRole("heading", { name: "Nothing on yet" }).count();
  test.skip(
    !process.env.CI && launchDay > 0,
    "built without DANFM_SEED=1, so there is no album to light the lamp",
  );
}

/**
 * What the badge says before its label, for a screen reader that would
 * otherwise meet three radio terms with nothing saying what they are about.
 * Visually hidden but part of the badge's text, so every assertion on what the
 * lamp reads has to carry it.
 */
const LAMP_PREFIX = "Station status: ";

/**
 * The station badge.
 *
 * One locator for all three labels rather than one per state, so a page
 * rendering two lamps at once fails on the count instead of passing on
 * whichever one was found first.
 */
function lamp(page: Page): Locator {
  return page.getByText(new RegExp(`^${LAMP_PREFIX}(On air|Standing by|Dead air)$`));
}

/** The section under `heading`, which is how the page is divided. */
function section(page: Page, heading: string): Locator {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: heading, exact: true }) });
}

/** The Today section, which is where the status line and the album card are. */
function today(page: Page): Locator {
  return section(page, "Today");
}

/**
 * How the badge is painted: its own ink, its border, the square inside it, and
 * whether the halo behind it is being drawn.
 */
async function paint(page: Page) {
  return lamp(page).evaluate((badge) => {
    const dot = badge.querySelector("[aria-hidden]");

    return {
      ink: getComputedStyle(badge).color,
      border: getComputedStyle(badge).borderTopColor,
      dot: dot ? getComputedStyle(dot).backgroundColor : null,
      // Off the dot, not the badge: the glow is the dot's own, which is what
      // keeps ember off the label. Read it here and a glow moved back behind
      // the text reads as no glow at all, which is the regression worth failing.
      halo: dot ? getComputedStyle(dot, "::before").backgroundImage : null,
    };
  });
}

/**
 * What the page's own colour tokens compute to.
 *
 * Measured through a probe element rather than read as raw custom properties,
 * so both sides of every comparison below are serialised by the same engine -
 * and anchored to the tokens rather than to literal colours, because a literal
 * passes just as well against a badge that hardcoded the same value by hand and
 * turns every palette edit into a test edit.
 *
 * The distinctness check is what stops that anchoring failing open. A renamed
 * token makes `var()` invalid, the declaration is dropped, and the probe hands
 * back the inherited colour for all three without complaining.
 */
async function tokens(page: Page) {
  const ink = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.append(probe);

    const colour = (name: string) => {
      probe.style.color = "";
      probe.style.color = `var(${name})`;
      return getComputedStyle(probe).color;
    };

    const read = {
      ember: colour("--ember"),
      border: colour("--border"),
      muted: colour("--muted-foreground"),
    };

    probe.remove();
    return read;
  });

  expect(
    new Set(Object.values(ink)).size,
    "the lamp's three tokens no longer resolve to three different colours",
  ).toBe(3);

  return ink;
}

test.describe("the station light", () => {
  test("the newest album's own day reads on air", async ({ page }) => {
    await openOn(page, NEWEST_DATE);

    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);

    /*
     * The ordinal is the album's position counted from the oldest, so the
     * newest one is the last day of the log. `tests/dan-fm.spec.ts` is what
     * holds the numbering to positions rather than to days.
     */
    await expect(today(page)).toContainText(`${spelled(NEWEST_DATE)} · Day ${LOGGED.length}`);
    await expect(today(page)).not.toContainText("Last on air");
    await expect(today(page)).not.toContainText("Off air");
  });

  test("the morning after reads standing by, and says so rather than counting", async ({
    page,
  }) => {
    await openOn(page, daysAfter(NEWEST_DATE, 1));

    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}Standing by`);

    /*
     * A sentence and not a number, because the day's album is logged in the
     * evening: every morning would otherwise open on "Off air 1 days" and read
     * like a failure of the thing rather than the ordinary shape of it.
     */
    await expect(today(page)).toContainText(
      `Today's album is not logged yet · Last on air ${spelled(NEWEST_DATE)}`,
    );
    await expect(today(page)).not.toContainText("Off air");
  });

  test("a second silent day reads dead air, and counts the days", async ({ page }) => {
    await openOn(page, daysAfter(NEWEST_DATE, 2));

    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}Dead air`);
    await expect(today(page)).toContainText(`Off air 2 days · Last spin ${spelled(NEWEST_DATE)}`);
    await expect(today(page)).not.toContainText("Last on air");
  });

  test("an album dated ahead of the station still reads on air", async ({ page }) => {
    /*
     * The station a day behind its own newest row, which is what a payload that
     * got past the job's future-row guard looks like from the page. Clamped, so
     * the lamp lights and the line above the album is the on-air one - a badge
     * saying the station is off while the card under it shows an album is the
     * worse of the two wrong answers.
     */
    await openOn(page, daysAfter(NEWEST_DATE, -1));

    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);
    await expect(today(page)).toContainText(`${spelled(NEWEST_DATE)} · Day ${LOGGED.length}`);
  });
});

test.describe("how the lamp is painted", () => {
  test("the lit lamp is the ember token, and carries the halo", async ({ page }) => {
    await openOn(page, NEWEST_DATE);
    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);

    const ink = await tokens(page);
    const lit = await paint(page);

    expect(lit.ink).toBe(ink.ember);
    expect(lit.border).toBe(ink.ember);
    expect(lit.dot).toBe(ink.ember);
    expect(lit.halo, "the on-air halo is not being drawn").toContain("radial-gradient");
  });

  /*
   * Both unlit states, because they are one treatment by design and only a test
   * that measures both can say so. Lighting standing by would claim the station
   * is on when it is not; dimming dead air below it would rank "not logged yet"
   * under "nothing has aired in a week".
   */
  for (const [state, label, days] of [
    ["standing by", "Standing by", 1],
    ["dead air", "Dead air", 2],
  ] as const) {
    test(`${state} is unlit: the border and muted tokens, and no halo`, async ({ page }) => {
      await openOn(page, daysAfter(NEWEST_DATE, days));
      await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}${label}`);

      const ink = await tokens(page);
      const unlit = await paint(page);

      expect(unlit.ink).toBe(ink.muted);
      expect(unlit.border).toBe(ink.border);
      expect(unlit.dot).toBe(ink.border);
      expect(unlit.halo, "an unlit lamp is glowing").toBe("none");
    });
  }
});

test.describe("the rating mark", () => {
  test("an album's score is still named out of five", async ({ page }) => {
    /*
     * The mark is paint. Both rows are already hidden from assistive tech and
     * the name on the wrapper is the whole of what a screen reader gets, so a
     * mark that reached the name would be the one way this prop could break
     * something.
     *
     * `MAX_SCORE` is the album scale's top and `Rating` draws to `MAX_RATING`,
     * which are two constants in two files that this line holds together: let
     * them drift and the page names a score out of a number the log cannot
     * reach.
     */
    await openOn(page, NEWEST_DATE);

    await expect(today(page).getByRole("img", { name: /^Rated / })).toHaveAttribute(
      "aria-label",
      `Rated ${NEWEST_SCORE} out of ${MAX_SCORE}`,
    );
  });

  test("the star reaches both rows of the rating", async ({ page }) => {
    /*
     * Two stacked copies of the same string - a dim track and a full-colour one
     * clipped to the score - which is what gives partial fill without a second
     * icon. A mark reaching only one of them draws either an empty track under
     * a partial row or a full row over nothing.
     */
    await openOn(page, NEWEST_DATE);

    const rows = await today(page)
      .getByRole("img", { name: /^Rated / })
      .evaluate((rating) =>
        Array.from(rating.children).map((row) => ({
          text: row.textContent,
          hidden: row.getAttribute("aria-hidden"),
        })),
      );

    expect(rows.map((row) => row.text)).toEqual(["★".repeat(MAX_SCORE), "★".repeat(MAX_SCORE)]);
    expect(rows.map((row) => row.hidden)).toEqual(["true", "true"]);
  });

  test("the star row is clipped to the score it names", async ({ page }) => {
    /*
     * `tests/site.spec.ts` sweeps this on `/shows` and only there, so the star
     * would be the first mark whose fill nobody measured - and the clip is a
     * percentage of a row of glyphs, which is exactly the thing a different
     * glyph could break.
     */
    await openOn(page, NEWEST_DATE);

    const width = await today(page)
      .getByRole("img", { name: /^Rated / })
      .locator("> span:nth-child(2)")
      .evaluate((row) => (row as HTMLElement).style.width);

    expect(Number.parseFloat(width)).toBeCloseTo((NEWEST_SCORE / MAX_SCORE) * 100, 1);
  });

  test("the show log's rating is still horns", async ({ page }) => {
    /*
     * The default the mark was added beside. It lives here rather than with the
     * show tests because it is this prop's other half: a default lost to a
     * refactor puts stars on every gig in the log, and nothing on `/shows`
     * looks at the glyph.
     */
    await page.goto("/shows");

    const rating = page.getByRole("img", { name: /^Rated / }).first();

    /*
     * The row's length is taken off the name the page renders rather than from
     * `MAX_RATING`, which lives behind `virtual:shows` and cannot be imported
     * here. What is being asked is the glyph, and the length is only there so
     * the comparison is against a whole row.
     */
    const outOf = Number(
      / out of (\d+)$/.exec((await rating.getAttribute("aria-label")) ?? "")?.[1],
    );
    expect(outOf, "a show's rating no longer names what it is out of").toBeGreaterThan(0);

    const rows = await rating.evaluate((row) =>
      Array.from(row.children).map((half) => half.textContent),
    );

    expect(rows).toEqual(["🤘🏽".repeat(outOf), "🤘🏽".repeat(outOf)]);
  });
});

/**
 * The number a standing section reports, or `null` for a sentence that reports
 * none - which is what every one of the empty-log sentences is.
 *
 * Read back off the page and compared against a count derived from the log on
 * disk, rather than against a sentence spelled out here. A literal that has
 * stopped matching matches nothing, and nothing found is exactly what a page
 * with nothing wrong on it looks like: the check that named the mixtape's old
 * wording went on reporting a clean page after the copy moved underneath it.
 */
function reported(text: string, pattern: RegExp): number | null {
  const said = pattern.exec(text);
  return said ? Number(said[1]) : null;
}

/*
 * The three sentences, matched without regard to case: a section hands back the
 * text as rendered, and the `readout` treatment the tape's bar is set in
 * uppercases it.
 */

/** "8 albums logged", the archive's count of the whole log. */
const ARCHIVE_COUNT = /(\d+) albums? logged/i;

/** "4 albums have scored", the tape's count of what cleared its bar. */
const MIXTAPE_COUNT = /(\d+) albums? (?:has|have) scored/i;

/**
 * "Standouts from everything 4 and up", the bar itself.
 *
 * Taken off the page because `MIXTAPE_SCORE` cannot be imported here: it lives
 * behind `virtual:dan-fm`, which only a Vite build resolves. Reading it back
 * out of the line that advertises it also holds the section's two halves
 * together - what a reader is told the tape takes, and what the sentence below
 * it counts.
 */
const MIXTAPE_BAR = /everything (\d+(?:\.\d+)?) and up/i;

test.describe("what the page claims about the log", () => {
  test("no section calls the log empty while an album is on the page", async ({ page }) => {
    /*
     * The four sections stand from day one, each with copy written for a log
     * that has nothing in it. Three of them fill in later, but the copy ships
     * now - and the first row the scheduled job commits puts every one of those
     * sentences on a page that is simultaneously showing an album, a score and
     * a review.
     *
     * Asserted as the count each section owes rather than as the absence of the
     * sentence it must not be saying, because an absence is only ever worth the
     * string it names and a section that counts the log cannot be calling it
     * empty.
     *
     * Asserted while the station is on air, because that is the state a reader
     * arrives in the moment the log starts working.
     */
    await openOn(page, NEWEST_DATE);

    // Named, not just present: the launch-day panel is an `h3` in the same
    // place, so a build with no albums would otherwise satisfy this line and
    // then satisfy both claims below for the right reason.
    await expect(today(page).getByRole("heading", { level: 3, name: NEWEST_TITLE })).toBeVisible();

    const archive = await section(page, "Archive").innerText();
    const tape = await section(page, "Mixtape").innerText();

    // The tape counts scores rather than rows, so its number is not the log's.
    const bar = reported(tape, MIXTAPE_BAR);
    expect(bar, "the mixtape no longer says what score it takes").not.toBeNull();

    const keepers = LOGGED.filter((album) => album.score >= bar!).length;
    expect(
      keepers,
      "no album in the log clears the mixtape's bar - nothing below is being asked",
    ).toBeGreaterThan(0);

    // Soft, so a run reports both sentences rather than stopping at the first
    // and leaving the second to be found again after it is fixed.
    expect
      .soft(
        reported(archive, ARCHIVE_COUNT),
        "the archive is not counting the log while the page is showing an album from it",
      )
      .toBe(LOGGED.length);

    expect
      .soft(
        reported(tape, MIXTAPE_COUNT),
        "the mixtape is not counting what cleared its bar while a scored album is on the page",
      )
      .toBe(keepers);
  });
});
