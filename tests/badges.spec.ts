import { type Page, expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

/**
 * What a chip does when its label is longer than the room it has.
 *
 * A badge is `w-fit`, which is "as wide as the label, but no wider than the
 * room available". The second half of that only means anything if the label may
 * break, so a chip that is held on one line is a chip that pushes its column
 * instead of fitting in it. Two of them are held on one line anyway, because
 * they hold several labels rather than one and the break lands mid-phrase - so
 * both halves need watching, and they fail in opposite directions.
 *
 * Neither is a page-level symptom. A chip can overrun its column while the page
 * itself still fits, and a chip can fragment at a width where nothing overflows
 * at all, so the width sweep in `responsive.spec.ts` sees neither.
 */

/**
 * The widths a column is at its narrowest.
 *
 * A chip overruns where its share of the row is smallest, and that is the first
 * pixel past a step rather than the smallest viewport: at 640 a one-column card
 * becomes three, and the middle one is narrower than the whole card was at 639.
 * So each of the three steps `src/` uses - `sm`, `md`, `lg` - is here as the
 * pair either side of it, with 320 for the narrowest phone and 1280 for a width
 * past the point `max-w-6xl` stops the content column growing.
 */
const WIDTHS = [320, 639, 640, 767, 768, 1023, 1024, 1280];

/**
 * The chips that hold several labels, and the reason this file names a class.
 *
 * `src/index.css` pins exactly this selector to one line, so it is the site's
 * own statement of which chips may not break. A rename that moved the rule
 * would move this with it - and if the class is dropped, the count below goes
 * to zero and says so rather than passing on an empty sweep.
 */
const COMPOSITE = ".solo-badge, .duo-badge";

// The sweep sets its own viewport for every width it measures, so the mobile
// device's own width never applies and running it there would take the same
// eight measurements a second time.
test.skip(({ isMobile }) => Boolean(isMobile), "the sweep sets its own viewport");

/**
 * Every chip that is wider than the box holding it, at whatever width the page
 * is currently at.
 *
 * Handed to `page.evaluate`, so it closes over nothing.
 */
function collectOverruns() {
  const faults: string[] = [];
  const round = (value: number) => Math.round(value * 100) / 100;

  for (const badge of document.querySelectorAll("[data-slot=badge]")) {
    const label = `"${(badge.textContent ?? "").trim().slice(0, 40)}"`;
    const right = badge.getBoundingClientRect().right;

    for (
      let box = badge.parentElement;
      box && box !== document.documentElement;
      box = box.parentElement
    ) {
      const style = getComputedStyle(box);
      // A container that scrolls holds content wider than itself on purpose.
      if (style.overflowX === "auto" || style.overflowX === "scroll") break;

      const bounds = box.getBoundingClientRect();
      const inner =
        bounds.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      const over = right - inner;

      /*
       * The first box the chip does not fit inside, and then stop. A box sized
       * by its own content - the `<li>` a chip sits in, say - grows with the
       * chip and reports nothing, which is what makes walking up necessary;
       * everything above the first real one is being pushed by that one rather
       * than by the chip.
       */
      if (over > 1) {
        faults.push(`${label} is ${round(over)}px past the <${box.tagName.toLowerCase()}>`);
        break;
      }
    }
  }

  return faults;
}

/** Every composite chip whose labels are not all on the same line. */
function collectBrokenChips(selector: string) {
  const faults: string[] = [];
  const round = (value: number) => Math.round(value * 100) / 100;

  for (const chip of document.querySelectorAll(selector)) {
    const style = getComputedStyle(chip);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;

    /*
     * Where each run of text in the chip was painted. Measured off the text
     * rather than off the chip's height, because the chip also holds an icon
     * and a hairline-separated tag, and any of those could grow the box for a
     * reason that is not a broken line.
     */
    const tops: number[] = [];
    const walker = document.createTreeWalker(chip, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) tops.push(rect.top);
    }
    if (tops.length === 0) continue;

    // Everything on one line sits at one top. Half a line of spread is far
    // more than centring or a differing face can account for and far less
    // than a wrap, which moves a label a full line down.
    const spread = Math.max(...tops) - Math.min(...tops);
    if (spread > line / 2) {
      const label = `"${(chip.textContent ?? "").trim().slice(0, 40)}"`;
      faults.push(`${label} is spread over ${round(spread)}px of a ${round(line)}px line`);
    }
  }

  return faults;
}

/**
 * One page load per route, then a resize per width.
 *
 * A reload for each of the eight widths measures the same thing eight times
 * over and costs eight times the loads: the layout here is CSS, so the second
 * reading after a resize is the reading a reload would have given.
 */
async function atEveryWidth(page: Page, route: string, measure: (width: number) => Promise<void>) {
  await page.setViewportSize({ width: WIDTHS[0], height: 900 });
  await page.goto(route);
  // Lazy routes render a skeleton first and the display face swaps in after
  // load, so measuring straight after `goto` measures a page mid-layout.
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await measure(width);
  }
}

test("no chip is wider than the column that holds it", async ({ page }) => {
  for (const route of ROUTES) {
    await atEveryWidth(page, route, async (width) => {
      await expect
        .poll(() => page.evaluate(collectOverruns), { message: `${route} at ${width}px` })
        .toEqual([]);
    });
  }
});

test("a composite chip's labels stay on one line together", async ({ page }) => {
  let measured = 0;

  for (const route of ROUTES) {
    await atEveryWidth(page, route, async (width) => {
      await expect
        .poll(() => page.evaluate(collectBrokenChips, COMPOSITE), {
          message: `${route} at ${width}px`,
        })
        .toEqual([]);
    });

    measured += await page.locator(COMPOSITE).count();
  }

  // Otherwise a renamed class turns this into a sweep over nothing, which
  // passes for the same reason an empty page would.
  expect(measured, `no chip matched ${COMPOSITE} on any route`).toBeGreaterThan(0);
});
