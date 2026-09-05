import { expect, test, type Locator, type Page } from "@playwright/test";

import { plainParagraphs, plainText } from "../src/lib/dan-fm-markdown";
import { MAX_SCORE, albumUrl } from "../src/lib/dan-fm-summary";

import { albumsOnDisk } from "./dan-fm";
import { flowText } from "./stats";

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
// The score the stars draw: the standing one, where a rescore exists.
const NEWEST_SCORE = NEWEST?.later ?? NEWEST?.score ?? 0;
const NEWEST_REVIEW = NEWEST?.review ?? "";

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
  test("the featured album's review is on the page, word for word", async ({ page }) => {
    /*
     * The whole review against the module the pipeline strips with, so every
     * word arrives in order and nothing rides along. Block boundaries are
     * pinned by the allowlist sweep below rather than per element, because a
     * tight list renders its item paragraphs without <p> tags and a
     * per-child comparison would be a claim about react-markdown's HTML
     * shapes rather than about the review.
     *
     * Both sides read through the same \s+ collapse: `textContent` is raw -
     * a lone newline the contract merely warns about keeps its "\n" there -
     * while `plainParagraphs` collapses whitespace like the rendering does.
     */
    await openDanFm(page);

    expect(
      NEWEST_REVIEW,
      "the newest album in the log carries no review - nothing below is being asked",
    ).not.toBe("");

    await expect(review(today(page))).toHaveCount(1);

    const written = await review(today(page)).evaluate(
      (block) => block.textContent?.replace(/\s+/g, " ").trim() ?? "",
    );

    expect(written).toBe(plainParagraphs(NEWEST_REVIEW).join(" "));
  });

  test("nothing the contract bans reaches the review's DOM", async ({ page }) => {
    /*
     * The "banned things never render" pin that needs no invalid content to
     * exist: whatever the log carries, the rendered review may hold only the
     * elements the allowed constructs produce.
     */
    await openDanFm(page);

    expect(
      NEWEST_REVIEW,
      "the newest album in the log carries no review - nothing below is being asked",
    ).not.toBe("");

    const tags = await review(today(page)).evaluate((block) => [
      ...new Set([...block.querySelectorAll("*")].map((el) => el.tagName)),
    ]);

    for (const tag of tags) {
      expect(
        ["P", "EM", "STRONG", "A", "UL", "OL", "LI", "BLOCKQUOTE", "CODE"],
        `the review rendered a <${tag.toLowerCase()}>, which no allowed construct produces`,
      ).toContain(tag);
    }
  });

  test("markdown renders as markup rather than as its marks", async ({ page }) => {
    // Guarded like every case here: it bites once the log carries markdown -
    // the seed does, so CI always asks - and stands down on a plain one.
    const marked = plainText(NEWEST_REVIEW) !== NEWEST_REVIEW.replace(/\s+/g, " ").trim();
    test.skip(!marked, "the featured review carries no markdown - nothing to render");

    await openDanFm(page);
    const block = review(today(page));

    expect(
      await block.evaluate((el) => el.textContent ?? ""),
      "markdown marks reached the rendered text",
    ).not.toMatch(/\*\*|\]\(/);
    expect(
      await block.locator("em, strong, a, ul, blockquote").count(),
      "the marks were stripped but nothing was styled",
    ).toBeGreaterThan(0);
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

    /*
     * The whole case is about an album that is *not* the featured one, and the
     * fetched log is one album long: there is no other review for the page to
     * leak, and no arrangement of the code could make one appear. Stood down
     * rather than asserted, the way `openDanFm` stands down for a log that is
     * not on disk - `ci.yml` always builds the fixture, which carries a second
     * review, so refusing the skip there keeps a genuinely leaking page red.
     */
    test.skip(
      !process.env.CI && OTHER_REVIEWS.length === 0,
      "the album log on disk holds no review but the featured one's",
    );
    expect(
      OTHER_REVIEWS.length,
      "no album but the featured one has a review - nothing below is being asked",
    ).toBeGreaterThan(0);

    await expect(review(page)).toHaveCount(1);

    for (const other of OTHER_REVIEWS) {
      // Derived through the same stripper the page renders with: an opening
      // matched raw would carry asterisks the DOM never contains, and the
      // leak check would quietly stop matching anything.
      const opening = plainParagraphs(other)[0];

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
          slot: row.getAttribute("data-slot"),
        })),
      );

    // The first two children are the track and the fill at every tier; the
    // dressed tiers may carry more, and each extra must be one of the two
    // hidden layers the dress owns - the sheen and the unclipped glow.
    expect(rows.slice(0, 2).map((row) => row.text)).toEqual([
      "★".repeat(MAX_SCORE),
      "★".repeat(MAX_SCORE),
    ]);
    expect(rows.map((row) => row.hidden)).toEqual(rows.map(() => "true"));
    for (const extra of rows.slice(2)) {
      expect(
        ["rating-sheen", "rating-glow"],
        "an unexplained extra row inside the rating",
      ).toContain(extra.slot);
    }
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

  test("a five wears the blue-white dress and keeps its plain name", async ({ page }) => {
    const five = LOGGED.find((album) => album.score === 5);
    test.skip(five === undefined, "no five in the log on disk - the top tier has no row");

    await page.goto(albumUrl(five!).replace(/^https:\/\/[^/]+/, ""));
    await page.getByRole("heading", { level: 1 }).waitFor();

    const rating = page.getByRole("img", { name: /^Rated / }).first();
    await expect(rating).toHaveAttribute("data-tier", "blue");
    await expect(rating).toHaveAttribute("aria-label", `Rated 5 out of ${MAX_SCORE}`);

    // The ink sits on the clipped fill; the glow stands on its own unclipped
    // layer, so a straight-edged bloom cannot come back without failing here.
    const painted = await rating.evaluate((el) => {
      const fill = getComputedStyle(el.querySelector("[data-slot=rating-fill]")!);
      const glow = getComputedStyle(el.querySelector("[data-slot=rating-glow]")!);
      const probe = document.createElement("span");
      probe.style.color = "var(--heat-blue)";
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { color: fill.color, expected, shadow: glow.textShadow, overflow: glow.overflow };
    });

    expect(painted.color, "the fill is not wearing the blue-white ink").toBe(painted.expected);
    expect(painted.shadow, "the five carries no standing glow").not.toBe("none");
    expect(painted.overflow, "the glow layer is clipped - the bloom will box").toBe("visible");
  });

  test("a demotion loses the dress the first night earned", async ({ page }) => {
    const demoted = LOGGED.find(
      (album) => album.later !== null && album.later < 4 && album.score >= 4.5,
    );
    test.skip(demoted === undefined, "no album demoted off the ladder in the log on disk");

    await page.goto(albumUrl(demoted!).replace(/^https:\/\/[^/]+/, ""));
    await page.getByRole("heading", { level: 1 }).waitFor();

    // The stars draw where the album stands, so a record that fell off the
    // ladder is plain ink whatever the first night scored - and the label
    // names the same number the row shows.
    const rating = page.getByRole("img", { name: /^Rated / }).first();
    await expect(rating).toHaveAttribute("data-tier", "base");
    await expect(rating).toHaveAttribute(
      "aria-label",
      `Rated ${demoted!.later} out of ${MAX_SCORE}`,
    );
  });

  test("a promotion earns the dress the first night withheld", async ({ page }) => {
    const promoted = LOGGED.find(
      (album) => album.later !== null && album.later >= 4.5 && album.later < 5 && album.score < 4,
    );
    test.skip(promoted === undefined, "no album promoted onto the ladder in the log on disk");

    await page.goto(albumUrl(promoted!).replace(/^https:\/\/[^/]+/, ""));
    await page.getByRole("heading", { level: 1 }).waitFor();

    // The other direction of the same rule: a record that grew into a 4.5
    // wears gold, and the first night's plain score is history in the readout.
    const rating = page.getByRole("img", { name: /^Rated / }).first();
    await expect(rating).toHaveAttribute("data-tier", "gold");
    await expect(rating).toHaveAttribute(
      "aria-label",
      `Rated ${promoted!.later} out of ${MAX_SCORE}`,
    );
  });

  test("the five's dress is the only self-running motion on its page", async ({ page }) => {
    /*
     * The assertable form of the closed loop set: on an album permalink the
     * lamp is absent, so the infinite animations must be exactly the sheen's
     * crossing and the fifth star's breath. Read by animation name rather
     * than by target, because the lamp's member lives on a pseudo-element.
     */
    const five = LOGGED.find((album) => album.score === 5);
    test.skip(five === undefined, "no five in the log on disk - the top tier has no row");

    await page.goto(albumUrl(five!).replace(/^https:\/\/[^/]+/, ""));
    await page.getByRole("heading", { level: 1 }).waitFor();

    const loops = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
        .map((animation) => (animation as CSSAnimation).animationName)
        .sort(),
    );
    expect(loops).toEqual(["star-breathe", "star-crossing"]);
  });

  test("the front page's loops are the lamp and the five's dress, nothing else", async ({
    page,
  }) => {
    // The archive holds every album, so a five's row runs its dress here
    // beside the station lamp; nothing else on the page may loop.
    await openDanFm(page);

    const loops = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
        .map((animation) => (animation as CSSAnimation).animationName),
    );
    for (const name of loops) {
      expect(
        ["on-air-warm", "star-breathe", "star-crossing"],
        `"${name}" loops on its own outside the sanctioned set`,
      ).toContain(name);
    }
  });

  test("a hovered five flares star by star", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "no hover, no flare");
    const five = LOGGED.find((album) => album.score === 5);
    test.skip(five === undefined, "no five in the log on disk - the top tier has no row");

    await page.goto(albumUrl(five!).replace(/^https:\/\/[^/]+/, ""));
    await page.getByRole("heading", { level: 1 }).waitFor();

    const rating = page.getByRole("img", { name: /^Rated / }).first();
    await rating.hover();

    const names = await rating
      .locator("[data-slot=rating-star]")
      .evaluateAll((stars) => stars.map((star) => getComputedStyle(star).animationName));
    for (const name of names) {
      expect(name, "a star did not join the flare").toContain("star-flare");
    }
  });

  test("the show log carries no tier anywhere", async ({ page }) => {
    // Horns provably untouched: heat is a prop only AlbumScore sets, so no
    // rating outside dan.fm may carry the attribute at any score. The
    // permalink is the same one the rest of the suite leans on.
    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await expect(page.locator("[data-tier]")).toHaveCount(0);

    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await expect(page.locator("[data-tier]")).toHaveCount(0);
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
 * The two sentences, matched without regard to case: a section hands back the
 * text as rendered, and the `readout` treatment the tape's bar is set in
 * uppercases it.
 */

/** "8 albums · 9 days", the archive's head, counting the whole log. */
const ARCHIVE_COUNT = /(\d+) albums? · \d+ days?/i;

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

/** One per track on the tape. */
function tapeRows(page: Page): Locator {
  return section(page, "Mixtape").getByRole("listitem");
}

test.describe("what the page claims about the log", () => {
  test("no section calls the log empty while an album is on the page", async ({ page }) => {
    /*
     * The four sections stand from day one, each with an empty state written
     * for a log that has nothing in it - and the first row the scheduled job
     * commits puts every one of those on a page that is simultaneously showing
     * an album, a score and a review.
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

    // Where the album stands now, not where it started: `mixtape()` reads the
    // second score where one exists, so a filter on the first alone counts a
    // demoted album in and a promoted one out. The seed carries one of each.
    const keepers = LOGGED.filter((album) => (album.later ?? album.score) >= bar!).length;

    /*
     * A log whose every album is under the bar has a mixtape that is honestly
     * empty, and the sentence saying so is the right one - which is the state
     * the fetched log is in, at one album scoring 3.5. Stood down for the same
     * reason and in the same shape as the review case above; `ci.yml` builds
     * the fixture, which carries four keepers.
     *
     * It takes the archive's half of this case down with it, and that half is
     * asked again in "the archive's head counts the whole log and the days it
     * spans" below, which a log of any size can answer.
     */
    test.skip(
      !process.env.CI && keepers === 0,
      "no album in the log on disk clears the mixtape's bar",
    );
    expect(
      keepers,
      "no album in the log clears the mixtape's bar - nothing below is being asked",
    ).toBeGreaterThan(0);

    // Soft, so a run reports both sections rather than stopping at the first
    // and leaving the second to be found again after it is fixed.
    expect
      .soft(
        reported(archive, ARCHIVE_COUNT),
        "the archive is not counting the log while the page is showing an album from it",
      )
      .toBe(LOGGED.length);

    // The tape lists what cleared its bar rather than counting it in a
    // sentence, so its half of this is the rows on screen.
    expect
      .soft(
        await tapeRows(page).count(),
        "the mixtape is not listing what cleared its bar while a scored album is on the page",
      )
      .toBe(keepers);
  });
});

/*
 * The archive.
 *
 * What the controls mean is settled without a browser in `tests/dan-fm.spec.ts`
 * - which facets a log earns, how the bands cut the scale, which rows a
 * selection leaves. These exist for the half that cannot be answered there:
 * that the bar on the page is built from those answers, and that a link carries
 * what it was set to.
 *
 * Every case is derived from the log on disk rather than from the fixture's
 * values, because both builds have to be able to answer it: the fetched log is
 * one album long, and the archive drops every control a single row cannot
 * disagree with itself about. The ones that need a control to drive stand down
 * where there is none, in the shape `openDanFm` uses.
 */

/** The rows the archive owes, in the order it owes them. */
const NEWEST_FIRST = [...LOGGED].sort((first, second) => second.date.localeCompare(first.date));

/**
 * Station days the log spans, both ends counted.
 *
 * Spelled out here rather than taken from `statsFor`, which lives behind
 * `virtual:dan-fm` and only a Vite build resolves. What the span *means* is
 * held to that function in `tests/dan-fm.spec.ts`; this is only the number the
 * head should be printing.
 */
const SPANNED = (() => {
  const days = LOGGED.map((album) => Date.parse(`${album.date}T00:00:00Z`));
  if (days.length === 0) return 0;

  return Math.round((Math.max(...days) - Math.min(...days)) / 86_400_000) + 1;
})();

/** "1 album", "8 albums" - the archive's own pluralisation, which it prints twice. */
function counted(total: number, noun: string): string {
  return `${total} ${total === 1 ? noun : `${noun}s`}`;
}

/** The head as it reads while the whole log is on screen. */
const WHOLE_LOG = `${counted(LOGGED.length, "album")} · ${counted(SPANNED, "day")}`;

/** The distinct values the log files itself under for one facet. */
function held(field: "genre" | "source" | "shelf"): string[] {
  return [...new Set(LOGGED.map((album) => album[field]).filter(Boolean))];
}

/** A genre some but not all of the log carries, or none where they all agree. */
const NARROWING_GENRE = held("genre").find(
  (genre) => LOGGED.filter((album) => album.genre === genre).length < LOGGED.length,
);

/**
 * A genre and a shelf the log never files one album under together.
 *
 * Both are values a control offers, and that comes free: a shelf some album is
 * on and the genre's album is not is a shelf fewer than all of them are on, and
 * the genre is likewise not on every row or nothing could hold the shelf. So a
 * pair found here is a pair both controls can be set to.
 *
 * None for a log of one album, which is on every shelf it knows about - and the
 * cases that need one stand down rather than inventing a value the page would
 * throw away.
 */
const IMPOSSIBLE = (() => {
  for (const genre of held("genre")) {
    for (const shelf of held("shelf")) {
      if (!LOGGED.some((album) => album.genre === genre && album.shelf === shelf)) {
        return { genre, shelf };
      }
    }
  }

  return undefined;
})();

/**
 * What the newest album files itself under, one entry per control.
 *
 * Its own filing rather than a value chosen per facet, so setting all four at
 * once still leaves its row standing: a round trip over an archive narrowed to
 * nothing proves only that nothing came back twice.
 */
const FILING_OF_NEWEST: [string, string][] = (
  [
    ["genre", NEWEST?.genre ?? ""],
    ["tag", NEWEST?.tags[0] ?? ""],
    ["source", NEWEST?.source ?? ""],
    ["shelf", NEWEST?.shelf ?? ""],
  ] as [string, string][]
).filter(([, value]) => value !== "");

/** The Archive section. */
function archive(page: Page): Locator {
  return section(page, "Archive");
}

/** The line beside the Archive's heading, which is where the section counts. */
function archiveHead(page: Page): Locator {
  return archive(page).locator("h2 + p");
}

/** One per album listed. */
function rows(page: Page): Locator {
  return archive(page).getByRole("listitem");
}

/**
 * Where each row leads, in the order they are listed.
 *
 * The whole row is one link, so this is both the list and its addresses: a row
 * that lost its link disappears from here rather than passing as a row that
 * goes nowhere.
 */
async function listedRows(page: Page): Promise<string[]> {
  return rows(page)
    .locator("a")
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));
}

/**
 * Stands the case down where the log on disk offers no control to drive, and
 * refuses to under CI.
 *
 * The archive drops a control every row answers the same way, so a build from
 * the one-album fetched log carries no filter bar at all and there is nothing
 * here to press. `ci.yml` always builds the fixture, where a bar that vanished
 * is the regression rather than the reason - which is why the skip is local
 * only, exactly as `openDanFm`'s launch-day carve-out is.
 */
async function needsTheBar(control: Locator, what: string) {
  const offered = await control.count();

  test.skip(!process.env.CI && offered === 0, `the album log on disk offers no ${what}`);
  expect(offered, `the archive offers no ${what}`).toBeGreaterThan(0);
}

test.describe("the archive", () => {
  test("every album in the log has a row, newest first", async ({ page }) => {
    /*
     * The build hands the page a newest-first payload, but nothing in the
     * archive's signature says so. A component that sorted for itself, or that
     * trusted position while the payload's order changed underneath it, buries
     * today's album at the bottom of a year of rows with every date on screen
     * still reading correctly.
     */
    await openDanFm(page);

    expect(await listedRows(page)).toEqual(NEWEST_FIRST.map((album) => albumUrl(album)));
  });

  test("the archive's head counts the whole log and the days it spans", async ({ page }) => {
    /*
     * Two claims and not one: eight albums over nine days says a morning was
     * missed, and eight over eight does not. Compared against a span computed
     * from the log rather than against a regex over whatever the page printed,
     * so a head that dropped the days, or started counting the rows on screen
     * instead of the log, fails rather than matching itself.
     *
     * A log of any size can answer this, which is what lets it stand in for the
     * archive's half of "no section calls the log empty while an album is on
     * the page" on a build the mixtape's half cannot be asked of.
     */
    await openDanFm(page);

    await expect(archiveHead(page)).toHaveText(WHOLE_LOG);
  });

  test("a log of one album offers no control to narrow it", async ({ page }) => {
    /*
     * The archive's own rule, on screen, and the state the site is in today: a
     * control every row answers the same way cannot be moved to any effect, so
     * one album gets no bar at all rather than five dropdowns of one option.
     *
     * Only a log of one can be asked it. Two albums that disagree about
     * anything earn a control, and the fixture disagrees about everything -
     * which is why this is the case that runs on the build a contributor gets
     * and stands down on the one CI makes.
     */
    test.skip(LOGGED.length !== 1, "the log on disk holds more than one album to filter");

    await openDanFm(page);

    await expect(rows(page)).toHaveCount(1);
    await expect(archive(page).getByRole("combobox")).toHaveCount(0);
    await expect(archive(page).getByRole("radiogroup")).toHaveCount(0);
    await expect(archive(page).getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  });

  test("choosing a genre narrows the rows, and the head counts what is left", async ({ page }) => {
    /*
     * The head's other form. Days are dropped the moment the list is a subset,
     * because they belong to the whole log and say nothing about three rows cut
     * out of it - a narrowed archive still advertising the log's span is a
     * claim about a set of albums nobody is looking at.
     */
    test.skip(NARROWING_GENRE === undefined, "the log on disk files every album under one genre");

    await openDanFm(page);

    const control = archive(page).getByRole("combobox", { name: "Filter albums by genre" });
    await needsTheBar(control, "genre to filter by");

    await control.click();
    await page.getByRole("option", { name: NARROWING_GENRE!, exact: true }).click();

    const kept = NEWEST_FIRST.filter((album) => album.genre === NARROWING_GENRE);

    await expect(page).toHaveURL(`/dan-fm?${new URLSearchParams({ genre: NARROWING_GENRE! })}`);
    await expect(rows(page)).toHaveCount(kept.length);
    expect(await listedRows(page)).toEqual(kept.map((album) => albumUrl(album)));
    await expect
      .poll(() => flowText(archiveHead(page)))
      .toBe(`${kept.length} of ${counted(LOGGED.length, "album")}`);
  });

  test("a link carries every control it was narrowed with, and reopens on the same rows", async ({
    page,
  }) => {
    /*
     * The reason the state is in the URL at all: an archive somebody narrowed
     * is a thing they send, and a link that arrives showing the whole log shows
     * the reader something other than what was meant. Round-tripped rather than
     * compared against a list written out here - the claim is that the page
     * puts back what it wrote, and the rows before the reload are the only
     * honest statement of what that was.
     */
    await openDanFm(page);

    await needsTheBar(archive(page).getByRole("combobox"), "control to filter by");

    const narrowed: [string, string][] = [];
    for (const [id, value] of FILING_OF_NEWEST) {
      const control = archive(page).getByRole("combobox", { name: `Filter albums by ${id}` });
      // A facet the log agrees about is not offered, and the case is about the
      // ones that are.
      if ((await control.count()) === 0) continue;

      await control.click();
      await page.getByRole("option", { name: value, exact: true }).click();
      await expect(control).toHaveText(value);
      narrowed.push([id, value]);
    }

    expect(narrowed.length, "no facet the newest album is filed under is offered").toBeGreaterThan(
      0,
    );

    const shared = new URL(page.url());
    const before = await listedRows(page);

    expect(before, "the controls narrowed the archive to nothing to reopen on").toContain(
      albumUrl(NEWEST!),
    );
    expect(
      [...shared.searchParams.keys()].sort(),
      "the link carries a different set of controls from the ones that were set",
    ).toEqual(narrowed.map(([id]) => id).sort());
    for (const [id, value] of narrowed) expect(shared.searchParams.get(id)).toBe(value);

    await page.goto(shared.toString());
    await page.getByRole("heading", { level: 1, name: "dan.fm" }).waitFor();

    expect(await listedRows(page)).toEqual(before);
    for (const [id, value] of narrowed) {
      await expect(
        archive(page).getByRole("combobox", { name: `Filter albums by ${id}` }),
        `the ${id} control did not come back set to what the link carried`,
      ).toHaveText(value);
    }
  });

  test("a score band is carried in the link, and its tally is the rows it leaves", async ({
    page,
  }) => {
    /*
     * The pill's number and the list under it come from two different readings
     * of the same log - one counts the bands, the other selects the rows - and
     * nothing in the code makes them agree. A reader who presses "4 and up 3"
     * and counts four rows has been lied to by one of them, and there is
     * nothing on the page saying which.
     */
    await openDanFm(page);

    const bands = archive(page).getByRole("radiogroup", { name: "Filter albums by score" });
    await needsTheBar(bands, "score to filter by");

    const pills = bands.getByRole("radio");
    // The tally on a pill, which is the last thing written on it.
    const tallyOn = async (pill: Locator) => {
      const printed = /(\d+)\s*$/.exec((await pill.innerText()).trim());
      expect(printed, "a score pill prints no tally to check the rows against").not.toBeNull();
      return Number(printed![1]);
    };

    expect(await tallyOn(pills.first()), "the everything pill is not counting the log").toBe(
      LOGGED.length,
    );
    expect(
      await pills.count(),
      "the score row offers nothing but the pill that filters nothing",
    ).toBeGreaterThan(1);

    const band = pills.nth(1);
    const tally = await tallyOn(band);

    await band.click();
    await expect(band).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(/[?&]score=/);

    await expect(rows(page)).toHaveCount(tally);
    await expect
      .poll(() => flowText(archiveHead(page)))
      .toBe(`${tally} of ${counted(LOGGED.length, "album")}`);
  });

  test("changing a filter replaces the entry rather than pushing one", async ({ page }) => {
    /*
     * Back is for leaving the page, not for stepping through somebody's own
     * adjustments. With five controls that is a lot of steps: a reader who
     * tried four genres before finding the one they wanted would press Back
     * four times and still be on the archive.
     *
     * Two changes rather than one, because a single change replacing the entry
     * it arrived on is a different claim from a run of them leaving one entry
     * between them.
     */
    const genres = held("genre");
    test.skip(genres.length < 2, "the log on disk offers fewer than two genres to move between");

    await openDanFm(page);
    // A second entry, so Back has somewhere known to land. `openDanFm` leaves
    // one entry of its own, which is not enough to tell a replace from a push.
    await page.goto("/");
    await page.goto("/dan-fm");
    await page.getByRole("heading", { level: 1, name: "dan.fm" }).waitFor();

    const control = archive(page).getByRole("combobox", { name: "Filter albums by genre" });
    await needsTheBar(control, "genre to filter by");

    for (const genre of genres.slice(0, 2)) {
      await control.click();
      await page.getByRole("option", { name: genre, exact: true }).click();
      await expect(control).toHaveText(genre);
    }

    await page.goBack();

    await expect(page, "Back stepped through the reader's own filter changes").toHaveURL("/");
  });

  test("a value the log does not hold opens on the whole archive rather than on nothing", async ({
    page,
  }) => {
    /*
     * A link shared before a genre was renamed, or a query somebody typed.
     * Taken literally it answers with an empty list and nothing on the page to
     * say why, so the reader meets an archive that looks broken instead of one
     * that looks untouched.
     *
     * Every build can be asked this: the fallback is over the vocabulary the
     * log actually holds, and a log that offers no control at all holds none of
     * these either.
     */
    await openDanFm(page);
    await page.goto("/dan-fm?genre=zzz-not-a-genre&score=zzz-not-a-band&shelf=nowhere&tag=nothing");
    await page.getByRole("heading", { level: 1, name: "dan.fm" }).waitFor();

    expect(await listedRows(page)).toEqual(NEWEST_FIRST.map((album) => albumUrl(album)));
    await expect(archiveHead(page)).toHaveText(WHOLE_LOG);
    await expect(
      archive(page).getByRole("button", { name: "Clear filters" }),
      "nothing is narrowing the archive, so there is nothing to offer to clear",
    ).toHaveCount(0);

    const genre = archive(page).getByRole("combobox", { name: "Filter albums by genre" });
    if ((await genre.count()) > 0) await expect(genre).toHaveText("All genres");
  });

  test("a combination the log has nothing for says so rather than showing an empty list", async ({
    page,
  }) => {
    test.skip(IMPOSSIBLE === undefined, "every genre in the log on disk is on every shelf in it");

    await openDanFm(page);
    await page.goto(`/dan-fm?${new URLSearchParams(IMPOSSIBLE!)}`);
    await page.getByRole("heading", { level: 1, name: "dan.fm" }).waitFor();

    await expect(rows(page)).toHaveCount(0);
    await expect(archive(page)).toContainText("Nothing in the log matches those filters.");
    await expect
      .poll(() => flowText(archiveHead(page)))
      .toBe(`0 of ${counted(LOGGED.length, "album")}`);
    await expect(
      archive(page).getByRole("button", { name: "Clear filters" }),
      "the state worth undoing fastest is the one showing nothing",
    ).toBeVisible();
  });

  test("Clear puts every control back in one move", async ({ page }) => {
    /*
     * Two set here, and both have to go. Controls that clear one at a time make
     * the reader undo their way out of a filter they cannot see the whole of -
     * and the archive can hold five at once, four of them collapsed into a
     * dropdown reading a value rather than a word that stands out.
     */
    test.skip(IMPOSSIBLE === undefined, "every genre in the log on disk is on every shelf in it");

    await openDanFm(page);
    await page.goto(`/dan-fm?${new URLSearchParams(IMPOSSIBLE!)}`);
    await page.getByRole("heading", { level: 1, name: "dan.fm" }).waitFor();

    const clear = archive(page).getByRole("button", { name: "Clear filters" });
    await clear.click();

    await expect(page).toHaveURL("/dan-fm");
    expect(await listedRows(page)).toEqual(NEWEST_FIRST.map((album) => albumUrl(album)));
    await expect(archiveHead(page)).toHaveText(WHOLE_LOG);
    await expect(
      clear,
      "the archive still offers to clear filters it has already cleared",
    ).toHaveCount(0);
  });
});

/*
 * The charts.
 *
 * Every figure on every board is settled without a browser in
 * `tests/dan-fm.spec.ts`, and the states the committed log cannot reach - a log
 * under the minimum, a board with nothing to draw - are rendered directly in
 * `tests/dan-fm-sections.spec.ts`. These exist for the third thing, which
 * neither of those can see: that the section on the page is drawing the log it
 * was built from, at the lengths the figures beside the bars claim.
 */

/** The Charts section. */
function charts(page: Page): Locator {
  return section(page, "Charts");
}

/** One per board, and one more for the score line, which shares their panel. */
function panels(page: Page): Locator {
  return charts(page).locator("[data-slot='chart-board']");
}

/** Every bar on every board, across all four. */
function bars(page: Page): Locator {
  return panels(page).locator("li");
}

/** The line beside the Charts heading, which is where the whole log is scored. */
function chartsHead(page: Page): Locator {
  return charts(page).locator("h2 + p");
}

/** The album log oldest first, which is the axis the score line is drawn on. */
const OLDEST_FIRST = [...LOGGED].sort((first, second) => first.date.localeCompare(second.date));

/**
 * Stands the case down where the log on disk has not reached the chart
 * minimum, and refuses to under CI.
 *
 * This is also the one assertion holding `CHART_MINIMUM` against the fixture.
 * `ci.yml` builds the fixture and nothing else, so a minimum raised past the
 * number of albums in it would leave the section counting down under CI - and
 * every case below would go quiet without a single one of them going red. Here
 * they fail instead, which is the whole reason the skip is local only.
 */
async function needsTheCharts(page: Page) {
  const drawn = await panels(page).count();

  test.skip(!process.env.CI && drawn === 0, "the album log on disk is short of the chart minimum");
  expect(
    drawn,
    "the Charts section is counting down rather than drawing - the log is short of `CHART_MINIMUM`",
  ).toBeGreaterThan(0);
}

test.describe("the charts", () => {
  test("the section scores the whole log", async ({ page }) => {
    /*
     * The one figure on the section that is not a board, and the only place the
     * log is reduced to a single number. Computed here rather than read off the
     * page, so a readout that started averaging the boards, or the rows it drew
     * rather than the albums behind them, fails instead of agreeing with
     * itself.
     */
    await openDanFm(page);
    await needsTheCharts(page);

    const mean = Number(
      (LOGGED.reduce((running, album) => running + album.score, 0) / LOGGED.length).toFixed(1),
    );

    await expect(chartsHead(page)).toHaveText(`Average ${mean} across ${LOGGED.length}`);
  });

  test("no panel on the section is a title over nothing", async ({ page }) => {
    /*
     * A board with nothing to draw keeps its panel and prints a sentence, so
     * every panel on screen is rows or a reason and never a titled box with
     * neither - which is what a board that lost its empty state leaves behind,
     * and it looks like a chart that failed to load.
     *
     * That a board keeps its panel *at all* rather than dropping out of the
     * grid is asked in `tests/dan-fm-sections.spec.ts`, where the count of
     * boards owed is knowable. Here the section is only ever asked about the
     * panels it did draw.
     */
    await openDanFm(page);
    await needsTheCharts(page);

    const filled = await panels(page).evaluateAll((boards) =>
      boards.map((board) => ({
        title: board.querySelector("h3")?.textContent ?? "",
        rows: board.querySelectorAll("li").length,
        // The line's panel holds an `svg` and its scale, which is neither a
        // row nor an empty state, so it is counted as having drawn something.
        said:
          (board.querySelector("p")?.textContent ?? "") !== "" ||
          Boolean(board.querySelector("svg")),
      })),
    );

    expect(filled.length, "the Charts section drew no panels at all").toBeGreaterThan(0);
    for (const board of filled) {
      expect(board.title, "a chart panel is not naming itself").not.toBe("");
      expect(
        board.rows > 0 || board.said,
        `the ${board.title} panel drew neither rows nor a reason`,
      ).toBe(true);
    }
  });

  test("every bar is as long as the figure printed beside it", async ({ page }) => {
    /*
     * The bar is a shape for reading a board at a glance and the figure is the
     * value; a bar drawn against the wrong scale is the two disagreeing, and
     * only one of them is checkable by reading the page.
     *
     * Which scale a row is drawn against is read off what it prints: an average
     * says what it is over, a share is a count on its own. That is the whole of
     * the difference between the two kinds of board, so a share board handed
     * the rating scale - every bar a fifth of the length it owes - fails here
     * with every number on screen still correct.
     */
    await openDanFm(page);
    await needsTheCharts(page);

    const drawn = await bars(page).evaluateAll((rows) =>
      rows.map((row) => {
        const fill = row.querySelector<HTMLElement>("[style*='width']");
        const track = fill?.parentElement ?? null;

        return {
          // The second of the row's two spans: the name, then the figure.
          figure: row.querySelector("span + span")?.textContent ?? "",
          share:
            fill && track
              ? fill.getBoundingClientRect().width / track.getBoundingClientRect().width
              : null,
        };
      }),
    );

    expect(drawn.length, "no bars on any board - nothing below is being measured").toBeGreaterThan(
      0,
    );

    for (const bar of drawn) {
      const average = /^(\d+(?:\.\d+)?) from \d+$/.exec(bar.figure);
      const share = /^(\d+)$/.exec(bar.figure);

      expect(
        average ?? share,
        `a bar is labelled "${bar.figure}", which is neither`,
      ).not.toBeNull();
      expect(bar.share, `the bar beside "${bar.figure}" has no length to measure`).not.toBeNull();

      const owed = average ? Number(average[1]) / MAX_SCORE : Number(share![1]) / LOGGED.length;

      expect(bar.share, `the bar beside "${bar.figure}" is not drawn to it`).toBeCloseTo(owed, 2);
    }
  });

  test("the score line plots every album in the log, oldest first", async ({ page }) => {
    /*
     * The one board with time on an axis. A line drawn from the payload as it
     * arrives runs newest to oldest - every score on it correct, every rise
     * drawn as a fall - and nothing on the page says which way it reads.
     *
     * Compared as an ordering rather than as coordinates, because the geometry
     * is the component's own: the box is in its own units and the line is
     * stretched to whatever width the panel is. What has to hold is that the
     * points run left to right, and that the highest one is the best album.
     */
    await openDanFm(page);
    await needsTheCharts(page);

    const points = (await charts(page).locator("polyline").getAttribute("points")) ?? "";
    const plotted = points
      .split(/\s+/)
      .filter(Boolean)
      .map((point) => point.split(",").map(Number));

    expect(plotted, "the score line is not plotting one point per album").toHaveLength(
      OLDEST_FIRST.length,
    );

    expect(
      plotted.map(([x]) => x),
      "the score line does not run left to right",
    ).toEqual([...plotted.map(([x]) => x)].sort((first, second) => first - second));

    /*
     * A point sits higher the better the album scored, so ranking the albums by
     * score and the points by height has to hand back the same order. Ties are
     * broken by position in both, which is what makes a reversed line disagree
     * rather than merely reorder its ties.
     */
    const byScore = [...OLDEST_FIRST.keys()].sort(
      (first, second) => OLDEST_FIRST[first].score - OLDEST_FIRST[second].score || first - second,
    );
    const byHeight = [...plotted.keys()].sort(
      (first, second) => plotted[second][1] - plotted[first][1] || first - second,
    );

    expect(byHeight, "the score line is not drawn in the order the log was heard").toEqual(byScore);
  });
});

test.describe("the mixtape", () => {
  test("the tape lists every keeper newest first, and every row leads to the album", async ({
    page,
  }) => {
    /*
     * The archive's rule, on the section beside it. `mixtape()` keeps the order
     * it is handed and the page hands it the payload, which the build fixes
     * newest-first - so a section that sorted for itself, or reversed what it
     * was given, buries this week's records at the bottom with every row on
     * screen still correct.
     *
     * The destinations are the second half: the row is a track name over an
     * artist, and neither of them says which album page it goes to.
     */
    await openDanFm(page);

    const bar = reported(await section(page, "Mixtape").innerText(), MIXTAPE_BAR);
    expect(bar, "the mixtape no longer says what score it takes").not.toBeNull();

    // The standing score, for the reason the count test above reads it: the
    // tape plays albums where they stand, and the seed demotes one keeper and
    // promotes one non-keeper exactly to catch a filter still on the first read.
    const keepers = NEWEST_FIRST.filter((album) => (album.later ?? album.score) >= bar!);

    // Stood down where the log on disk has nothing over the bar, in the shape
    // and for the reason `openDanFm` stands down on launch day. `ci.yml` builds
    // the fixture, which carries four keepers.
    test.skip(
      !process.env.CI && keepers.length === 0,
      "no album in the log on disk clears the mixtape's bar",
    );
    expect(keepers.length, "no album in the log clears the mixtape's bar").toBeGreaterThan(0);

    const led = await tapeRows(page)
      .locator("a[href^='/dan-fm/']")
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));

    expect(led).toEqual(keepers.map((album) => albumUrl(album)));
  });

  test("the page links out to Spotify rather than embedding any of it", async ({ page }) => {
    /*
     * The tape is a tracklist and not a player, and the reason is the whole
     * page rather than the section: `tests/links.spec.ts` fails the build if
     * any request leaves the origin, and an embed would be that request.
     *
     * That sweep watches requests, which is the half a resource hint slips
     * past - a `preconnect` opens a socket to Spotify without fetching
     * anything, and it is exactly what someone reaches for on the way to an
     * embed. So this reads the document instead: no frame of any kind, no hint
     * pointing at Spotify, and every mention of it an ordinary link out.
     */
    await openDanFm(page);

    const outward = await page.evaluate(() => ({
      framed: document.querySelectorAll("iframe, embed, object").length,
      /*
       * Matched on the host, because the site's own chunk for the credit line
       * is named `spotify-credit-<hash>.js` and every page that carries it
       * ships a `modulepreload` for it. A substring match reads that as a
       * connection to Spotify and fails on the build being correct.
       */
      hinted: [...document.querySelectorAll("link")]
        .filter((tag) => new URL(tag.href).host.endsWith("spotify.com"))
        .map((tag) => tag.rel),
      links: [...document.querySelectorAll("a")]
        .filter((anchor) => anchor.href.includes("open.spotify.com"))
        .map((anchor) => ({ target: anchor.target, rel: anchor.rel })),
    }));

    expect(outward.framed, "something on the page is embedding a frame").toBe(0);
    expect(
      outward.hinted,
      "the page is opening a connection to Spotify before it is asked",
    ).toEqual([]);

    expect(
      outward.links.length,
      "nothing on the page links to Spotify - nothing below is being asked",
    ).toBeGreaterThan(0);
    for (const link of outward.links) {
      expect(link.target, "a Spotify link opens over the page").toBe("_blank");
      expect(link.rel, "a Spotify link hands the new tab a handle on this one").toContain(
        "noopener",
      );
      expect(link.rel).toContain("noreferrer");
    }
  });
});
