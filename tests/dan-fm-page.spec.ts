import { expect, test, type Locator, type Page } from "@playwright/test";

import { MAX_SCORE } from "../src/lib/dan-fm-summary";

import { albumsOnDisk } from "./dan-fm";

/**
 * What `/dan-fm` puts on screen.
 *
 * Every case here opens the page on a fixed clock, because the lamp reads the
 * calendar as well as the log: an album ages off the air, so what the badge
 * says depends on how recently one was logged. `openDanFm` pins the day to the
 * newest album's own, so a run reports the site rather than whether the owner
 * has kept up with his listening.
 *
 * What the states mean is settled without a browser in `tests/dan-fm.spec.ts`,
 * over `station()` and a handful of dated rows. These exist for the half that
 * cannot answer: that the lamp on the page is wired to that function at all,
 * and that the line under the album names the album it is drawn from.
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
 * - is answered in `openDanFm` below, and these are what let it get that far: an
 * argument is evaluated before the function that would have stood the test
 * down, so reading the date straight off an absent album throws on the way in
 * and reports a `TypeError` instead of the reason.
 */
const NEWEST_DATE = NEWEST?.date ?? "1970-01-01";
const NEWEST_TITLE = NEWEST?.album ?? "";
const NEWEST_SCORE = NEWEST?.score ?? 0;
const NEWEST_REVIEW = NEWEST?.review ?? "";

/**
 * The paragraphs a review is meant to become: every line with something on it,
 * trimmed.
 *
 * Spelled out here rather than imported, because the split is the rule the page
 * is being held to rather than a helper it offers. A cell somebody typed into a
 * spreadsheet has no soft wrap to undo, so a newline in it is a break that was
 * meant.
 */
function paragraphsOf(review: string): string[] {
  return review
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * The reviews the log holds against albums that are not the featured one.
 *
 * These are the whole of the negative case: the review belongs to the album
 * being reviewed, and the front page is a page about one album. The committed
 * fixture carries more than one review, so this is reachable without anything
 * being added to it.
 */
const OTHER_REVIEWS = LOGGED.filter((album) => album.date !== NEWEST_DATE && album.review).map(
  (album) => album.review,
);

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

/** Opens `/dan-fm` on a build that has a log to show. */
async function openDanFm(page: Page) {
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

  /*
   * Midday on the newest album's own day, before anything navigates - the
   * station's clock is read while React renders, so a clock installed after
   * the page has loaded arrives too late to decide the lamp. 19:00 UTC is late
   * morning in California in either half of the year, so the station's day is
   * the album's whichever side of a daylight-saving change it falls.
   */
  await page.clock.setFixedTime(new Date(`${NEWEST_DATE}T19:00:00Z`));

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
 * otherwise meet radio terms with nothing saying what they are about. Visually
 * hidden but part of the badge's text, so every assertion on what the lamp
 * reads has to carry it.
 */
const LAMP_PREFIX = "Station status: ";

/**
 * The station badge.
 *
 * One locator for every label rather than one per state, so a page rendering
 * two lamps at once fails on the count instead of passing on whichever one was
 * found first.
 */
function lamp(page: Page): Locator {
  return page.getByText(new RegExp(`^${LAMP_PREFIX}(On air|Off air)$`));
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
 * The long piece about the record.
 *
 * Found by the class rather than by its words, because `prose-dan` is the
 * site's body-copy contract and not this page's private detail: `/now` and
 * `/blog` set their writing in it, and a review that arrived outside it would
 * be read at a measure and a leading nothing else on the site uses. Locating on
 * the text instead would find the paragraphs of a review set as anything at
 * all.
 */
function review(scope: Locator | Page): Locator {
  return scope.locator(".prose-dan");
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
  test("the log's newest album is on air, and the line under it says which day it is", async ({
    page,
  }) => {
    await openDanFm(page);

    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);

    /*
     * The ordinal is the album's position counted from the oldest, so the
     * newest one is the last day of the log. `tests/dan-fm.spec.ts` is what
     * holds the numbering to positions rather than to days.
     *
     * The date is the whole of what a reader judges the log's freshness by now
     * that the lamp does not, so a card that lost it would leave the page
     * claiming to be on air with nothing saying since when.
     */
    await expect(today(page)).toContainText(`${spelled(NEWEST_DATE)} · Day ${LOGGED.length}`);
  });
});

/**
 * Where the lit halo's right edge falls, and where the label's first character
 * starts, in page coordinates.
 *
 * The glow is a pseudo-element and has no node to measure, so its box is
 * computed from the dot it hangs off plus the offsets `::before` resolves to -
 * which is the whole of what decides where it lands. The label is a bare text
 * node between the two spans, so a range over it is the only handle on it.
 */
async function haloAndLabel(page: Page) {
  return lamp(page).evaluate((badge) => {
    const dot = badge.querySelector("[aria-hidden]");
    if (!dot) return null;

    const words = Array.from(badge.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim(),
    );
    if (!words) return null;

    const glow = getComputedStyle(dot, "::before");
    const range = document.createRange();
    range.selectNodeContents(words);

    return {
      halo:
        dot.getBoundingClientRect().left +
        Number.parseFloat(glow.left) +
        Number.parseFloat(glow.width),
      label: range.getBoundingClientRect().left,
    };
  });
}

test.describe("how the lamp is painted", () => {
  test("the lit lamp is the ember token, and carries the halo", async ({ page }) => {
    await openDanFm(page);
    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);

    const ink = await tokens(page);
    const lit = await paint(page);

    expect(lit.ink).toBe(ink.ember);
    expect(lit.border).toBe(ink.ember);
    expect(lit.dot).toBe(ink.ember);
    expect(lit.halo, "the on-air halo is not being drawn").toContain("radial-gradient");
  });

  test("the halo dies in the gap rather than reaching under the label", async ({ page }) => {
    /*
     * The reason the glow is on the dot at all, and the failure the case above
     * cannot see: it asks whether the dot is glowing, which stays true of a
     * halo widened until it laps under the text. Ember behind ember-coloured
     * words is a contrast ratio axe reports as indeterminate rather than as a
     * violation, so nothing else in the suite would say a word about it.
     *
     * Two numbers rather than a screenshot, because the distance is small on
     * purpose: the glow reaches eight of the ten pixels between the dot and
     * the first character, and every pixel of that margin is deliberate.
     */
    await openDanFm(page);
    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);

    const box = await haloAndLabel(page);
    expect(box, "the badge no longer has a dot and a label to measure").not.toBeNull();

    expect(
      box!.halo,
      "the on-air halo reaches the label, which puts ember behind ember text",
    ).toBeLessThanOrEqual(box!.label);
  });

  test("nothing paints a second glow behind the badge", async ({ page }) => {
    /*
     * The other way the same ember lands on the label. The check above measures
     * the dot's own halo and would go on passing beside a glow added to the
     * badge, which is where this treatment started and where it must not go
     * back to - the badge has text on it and the dot has nothing to read.
     */
    await openDanFm(page);
    await expect(lamp(page)).toHaveText(`${LAMP_PREFIX}On air`);

    const behind = await lamp(page).evaluate((badge) => [
      getComputedStyle(badge, "::before").backgroundImage,
      getComputedStyle(badge, "::after").backgroundImage,
    ]);

    expect(behind, "the badge is painting something behind its own text").toEqual(["none", "none"]);
  });
});

test.describe("the album's review", () => {
  test("the featured album's review is on the page, one paragraph per written line", async ({
    page,
  }) => {
    /*
     * Element by element rather than as one blob of text. A review handed over
     * whole - or run through a markdown parser, which the cell behind it was
     * never written for - puts every word on the page and would satisfy any
     * assertion that stopped at whether the words were there.
     */
    await openDanFm(page);

    expect(
      NEWEST_REVIEW,
      "the newest album in the log carries no review - nothing below is being asked",
    ).not.toBe("");

    await expect(review(today(page))).toHaveCount(1);

    const written = await review(today(page)).evaluate((block) =>
      Array.from(block.children).map((child) => ({ tag: child.tagName, text: child.textContent })),
    );

    expect(written.map((child) => child.text)).toEqual(paragraphsOf(NEWEST_REVIEW));
    expect(
      [...new Set(written.map((child) => child.tag))],
      "the review is being rendered as something other than paragraphs",
    ).toEqual(["P"]);
  });

  test("no other album's review reaches the front page", async ({ page }) => {
    /*
     * The owner's rule, and the half the case above cannot see: the review
     * belongs to the album being reviewed. A card reaching for the log rather
     * than for the album it was handed, or a section that started printing the
     * writing beside the rows it lists, turns the front page into a stack of
     * essays and passes every assertion about the featured one on the way.
     *
     * Asserted twice over, because the two failures look nothing alike: a
     * second block of prose anywhere on the page, and another album's words
     * rendered without one.
     */
    await openDanFm(page);

    expect(
      OTHER_REVIEWS.length,
      "no album but the featured one has a review - nothing below is being asked",
    ).toBeGreaterThan(0);

    await expect(review(page)).toHaveCount(1);

    for (const other of OTHER_REVIEWS) {
      const opening = paragraphsOf(other)[0];

      await expect(
        page.getByText(opening),
        `an album that is not the featured one has its review on the front page: "${opening.slice(0, 60)}..."`,
      ).toHaveCount(0);
    }
  });
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
    await openDanFm(page);

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
    await openDanFm(page);

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
    await openDanFm(page);

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
    await openDanFm(page);

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
