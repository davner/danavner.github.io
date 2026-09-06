import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

import { ROUTES } from "./routes";

/**
 * The outlined display type, measured from the pixels a browser actually
 * paints.
 *
 * `.display-outline` is `color: transparent` with a `-webkit-text-stroke`, and
 * axe has no model of a stroke: asked about the wordmark on the home page it
 * answers `contrastRatio: 0` with no verdict, having composited the transparent
 * fill over the background and found the two identical. `tests/a11y.spec.ts`
 * admits every undecided `color-contrast` node, so this text is not gated
 * there and cannot be - the rule that would gate it is the one reporting
 * nothing. This is the measurement `PRODUCT.md` promises in its place, and it
 * is the whole of the coverage on the largest text the site sets.
 *
 * Pixels rather than tokens, because the two things that would break it are on
 * different sides of the render: a palette that dims the stroke against what is
 * behind it, and a stroke too thin to lay down ink at all. A comparison of two
 * declared colours would see the first and never the second, and it would also
 * have to guess at the background - which is exactly what axe declined to do,
 * since the grain overlay and the ember bloom are both between the page and the
 * text.
 */

/** Both stroke variants: one draws in the foreground, one in the accent. */
const OUTLINED = ".display-outline, .display-outline-ember";

/**
 * The floor, as WCAG 2.2 AA sets it for large text - which axe itself resolves
 * these nodes as, reporting `expectedContrastRatio: "3:1"` before giving up on
 * measuring them.
 */
const LARGE_TEXT = 3;

/**
 * The share of the sampled band that has to be ink, so a stroke that stopped
 * being painted fails as itself rather than as a page with nothing on it. The
 * thinnest real coverage measured across the sweep is about five times this.
 */
const MIN_INK = 0.5;

/**
 * How much of the element's own box to sample, centred.
 *
 * `.display` sets `line-height: 0.86`, so consecutive lines overlap: a solid
 * white line above paints inside the outlined line's box, and a crop of the
 * whole box reports the neighbour's ink as this element's. The middle band is
 * the part of the box no other line can reach.
 */
const BAND = 0.5;

/** Relative luminance, per WCAG 2.x. */
function luminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * What the browser painted in the middle band of one outlined line: how much of
 * it is ink, and the most that ink stands out from what is behind it.
 *
 * The background is the band's median luminance rather than a declared token.
 * An outline is a hairline, so the overwhelming majority of the band is
 * whatever is behind the text - grain, bloom and page colour already composited
 * - which is the value the ink actually has to be read against and the one axe
 * would not resolve. Ink is then anything measurably off that.
 */
async function paintedInk(page: Page, line: Locator) {
  await line.scrollIntoViewIfNeeded();
  const box = (await line.boundingBox())!;
  const cut = (box.height * (1 - BAND)) / 2;

  const shot = await page.screenshot({
    clip: { x: box.x, y: box.y + cut, width: box.width, height: box.height - 2 * cut },
  });
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });

  const band: number[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    band.push(luminance(data[i], data[i + 1], data[i + 2]));
  }

  const background = [...band].sort((a, b) => a - b)[Math.floor(band.length / 2)];
  // 1.1 is well inside the noise floor of a flat surface and well below any
  // ratio that would count as legible, so it separates ink from ground without
  // deciding anything the assertions below are for.
  const ink = band.map((value) => contrast(value, background)).filter((value) => value >= 1.1);

  return {
    coverage: (100 * ink.length) / band.length,
    peak: ink.length > 0 ? Math.max(...ink) : 0,
  };
}

for (const colorScheme of ["dark", "light"] as const) {
  test(`outlined display type lays down legible ink in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });

    const faults: string[] = [];
    let measured = 0;

    for (const route of ROUTES) {
      await page.goto(route);
      await page.getByRole("heading", { level: 1 }).waitFor();
      // The face decides where the ink goes, so a measurement taken before it
      // has swapped in measures the fallback's letterforms.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");

      const lines = page.locator(OUTLINED);

      for (let index = 0; index < (await lines.count()); index++) {
        const line = lines.nth(index);
        const words = ((await line.textContent()) ?? "").trim();
        const { coverage, peak } = await paintedInk(page, line);
        measured += 1;

        const where = `${route} "${words}"`;
        if (coverage < MIN_INK) {
          faults.push(`${where} paints ${coverage.toFixed(2)}% ink, so its stroke is not drawn`);
        } else if (peak < LARGE_TEXT) {
          faults.push(`${where} reaches ${peak.toFixed(2)}:1 against what is behind it`);
        }
      }
    }

    expect(faults, `outlined type in ${colorScheme} mode`).toEqual([]);
    // Otherwise a renamed class turns this into a sweep over nothing, which
    // passes for the same reason a page with no text on it would.
    expect(measured, `no route drew outlined type in ${colorScheme} mode`).toBeGreaterThan(0);
  });
}
