import { type Page, expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

/**
 * What a rating row measures, as against what it draws.
 *
 * `letter-spacing` lands after every glyph, the last one included, so a row
 * written as one repeated string ends with a cell of nothing inside its own
 * text run. Nobody can see it - the glyphs sit where they always do - and
 * anything measuring the row with a `Range` counts it as ink: the stat sweep in
 * `tests/responsive.spec.ts` reads `/shows`' average tile as overflowing by
 * 1.75px at 640 while every horn sits well inside it.
 *
 * Both halves are pinned here, because the near fix breaks the other one. The
 * trailing cell has to sit outside the text run, or a sweep goes on reading
 * space as ink; and the box has to span `MAX` whole cells, because that is the
 * base the fill's percentage divides - a box a cell short draws a 4.5 as well
 * under half of its last mark. `src/components/rating.tsx` holds both by
 * dropping the tracking from the last mark and reserving it as padding.
 *
 * Every route rather than the one tile that fails without it: the mark is the
 * caller's - `/shows` sets horns and `/dan-fm` sets a star - and the dressed
 * tiers on the album pages draw the fill as five separate spans rather than as
 * one string.
 */

/** How far two measurements of the same edge may differ before it means something. */
const SLACK = 0.5;

/**
 * What one rating measures, per rating on the page.
 *
 * Handed to `page.evaluate`, so it closes over nothing. Read off the dim track
 * - the row's only in-flow layer, and so the one the box is sized by - rather
 * than off the clipped fill, which is absolutely positioned and reports the
 * clip's width instead of the text's.
 */
function measureRatings() {
  const round = (value: number) => Math.round(value * 100) / 100;
  const widthOf = (node: Node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().width;
  };

  return [...document.querySelectorAll("[role=img][aria-label^='Rated']")].map((rating) => {
    const label = rating.getAttribute("aria-label") ?? "";
    const style = getComputedStyle(rating);
    const track = rating.children[0];
    const last = track?.lastElementChild ?? null;

    return {
      label,
      // The scale off the row's own name, so nothing here holds a second copy
      // of a constant that lives in `src/lib/shows.ts`.
      marks: Number(/ out of (\d+)$/.exec(label)?.[1] ?? 0),
      box: round(rating.getBoundingClientRect().width),
      // `normal` on a row that sets none, which is not a length - and a row
      // that sets none has no trailing cell to put anywhere.
      tracking: round(parseFloat(style.letterSpacing) || 0),
      ink: track ? round(widthOf(track)) : null,
      lastMark: last ? round(widthOf(last)) : null,
    };
  });
}

/** One page's worth of readings, as `measureRatings` hands them back. */
type Measured = ReturnType<typeof measureRatings>;

/** Every rating the site draws, route by route. */
async function everyRating(page: Page, check: (route: string, rows: Measured) => void) {
  let seen = 0;

  for (const route of ROUTES) {
    await page.goto(route);
    // Lazy routes render a skeleton first and the display face swaps in after
    // load, so measuring straight after `goto` measures a page mid-layout.
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);

    const rows = await page.evaluate(measureRatings);
    check(route, rows);
    seen += rows.length;
  }

  // Otherwise a renamed role or label turns both cases into a sweep over
  // nothing, which passes for the same reason an empty page would.
  expect(seen, "no route drew a rating, so nothing above was measured").toBeGreaterThan(0);
}

test("a rating's text run stops at the last mark it draws", async ({ page }) => {
  /*
   * The box is one cell wider than its text, and that cell is padding. Read
   * the other way round: whatever a `Range` makes of this row is ink rather
   * than a space after it, which is the whole of what a layout sweep needs
   * from it.
   */
  await everyRating(page, (route, rows) => {
    for (const row of rows) {
      expect(row.ink, `${route}: "${row.label}" has no track row to measure`).not.toBeNull();
      expect(
        row.box - row.ink!,
        `${route}: "${row.label}" measures ${row.ink}px of a ${row.box}px box, so the last mark's ${row.tracking}px of tracking sits inside its text run`,
      ).toBeGreaterThanOrEqual(row.tracking - SLACK);
    }
  });
});

test("a rating still spans one whole cell per mark", async ({ page }) => {
  /*
   * The half the near fix loses. Dropping the trailing space rather than
   * moving it takes it out of the text run too, and satisfies the case above
   * while narrowing the box by a cell - so the fill's percentage divides a
   * base a mark short and every number on the page stays correct.
   *
   * The cell is measured off the row itself - the marks before the last one,
   * which all keep their tracking - so nothing here restates a length from
   * `src/index.css`.
   */
  await everyRating(page, (route, rows) => {
    for (const row of rows) {
      expect(row.marks, `${route}: "${row.label}" names no scale`).toBeGreaterThan(1);
      expect(row.lastMark, `${route}: "${row.label}" has no last mark to measure`).not.toBeNull();

      const cell = (row.ink! - row.lastMark!) / (row.marks - 1);

      expect(
        row.box,
        `${route}: "${row.label}" is ${row.box}px wide, which is ${(row.box / cell).toFixed(2)} cells of ${cell.toFixed(2)}px rather than ${row.marks}`,
      ).toBeCloseTo(cell * row.marks, 1);
    }
  });
});
