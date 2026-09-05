import { expect, test } from "@playwright/test";

import { SLIP } from "../src/lib/slip";
import { statText } from "./stats";

/**
 * The load-bearing edges of the motion work - the ones a stray utility or a
 * refactor would undo silently. Reduced-motion behaviour lives in
 * `reduced-motion.spec.ts`; this file covers what happens when no preference
 * was expressed.
 */

test.describe("the date-stamp chips", () => {
  test("the ember fill snaps rather than fading", async ({ page }) => {
    await page.goto("/blog");
    await page.getByRole("heading", { level: 1 }).waitFor();

    /*
     * The stamp is delivered by dropping `background-color` from the chip's
     * transition list, so a future `transition-colors` landing back on the
     * chip - the shadcn default - would quietly turn the stamp into a fade.
     * Text colour stays in the list on purpose: hover ink keeps fading.
     */
    const properties = await page
      .locator("[data-slot=toggle-group-item]")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionProperty);

    expect(properties, "the ember fill fades where it should stamp").not.toContain(
      "background-color",
    );
    expect(properties, "hover ink stopped fading along with the fill").toContain("color");
  });
});

test.describe("route cross-fade", () => {
  test("a header navigation lands the new page with no console errors", async ({ page }) => {
    /*
     * The click drives a real `document.startViewTransition` in Chromium, so
     * this catches a hung transition promise - the failure mode where the old
     * snapshot never resolves and the page sits frozen under the overlay.
     */
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    // The desktop bar; on the mobile device the same links live in the sheet
    // and the bar is display:none, so the viewport is pinned like the
    // allowlist test pins its own.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    await page.getByRole("banner").getByRole("link", { name: "Blog" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Notes on");
    expect(errors, "the navigation logged an error").toEqual([]);
  });
});

test.describe("the stat odometers", () => {
  test("an owner chip press rolls the record count to the other figure", async ({ page }) => {
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const dd = page.locator("[data-slot=stat] dd").first();
    const chip = page.getByRole("radio").nth(1);
    const chipCount = Number((await chip.innerText()).trim().split(/\s+/).pop());
    expect(chipCount).toBeGreaterThan(0);

    await chip.click();
    // The roll's end state is what is pinned; site.spec's owner-flip pair
    // already proves the two counts differ.
    await expect.poll(async () => Number(await statText(dd))).toBe(chipCount);
  });
});

test.describe("the shelf slip", () => {
  /*
   * The settle window, ported from scripts/make-easings.mjs's clamp check:
   * many tails of the spring's slowest decay, derived from the shipped SLIP
   * constants rather than written down - never first-approach-to-rest, which
   * for a curve still moving is exactly the wrong moment to stop sampling.
   * SLIP is underdamped, so the decay rate is zeta * sqrt(tension).
   */
  const ZETA = SLIP.friction / (2 * Math.sqrt(SLIP.tension));
  const WINDOW_MS = Math.ceil((20 * 1000) / (Math.min(ZETA, 1) * Math.sqrt(SLIP.tension)));

  const IDENTITY = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/;

  test("a slipped cover settles back to rest inside the spring's window", async ({ page }) => {
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // The slip is gated to hover-capable pointers, so the touch project has
    // nothing to measure - the reduced-motion sweep covers the no-op side.
    test.skip(
      !(await page.evaluate(() => window.matchMedia("(hover: hover)").matches)),
      "no hover, no slip",
    );

    const tile = page.locator("[data-slot=record]").first();
    const img = tile.locator("img").first();
    const transform = () => img.evaluate((el) => getComputedStyle(el).transform);

    // Enter with a real pointer; the cover must actually leave rest first,
    // or a slip that never fires would pass the settle check by default.
    await tile.hover();
    await expect.poll(transform, { timeout: 2000 }).not.toMatch(IDENTITY);

    // Leave, and poll the pose back to identity within the derived window.
    await page.mouse.move(1, 1);
    await expect.poll(transform, { timeout: WINDOW_MS + 500 }).toMatch(IDENTITY);
  });

  test("keyboard focus gets no slip", async ({ page }) => {
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const tile = page.locator("[data-slot=record]").first();
    await tile.locator("a").first().focus();

    const transform = await tile
      .locator("img")
      .first()
      .evaluate(
        (el) =>
          new Promise<string>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(getComputedStyle(el).transform)),
            );
          }),
      );
    expect(transform, "focus moved a cover").toMatch(IDENTITY);
  });
});

test.describe("the framed photo", () => {
  test("shows a finger, because it answers a press", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // Pinned by hand like the fire's: the sitewide cursor sweep matches
    // `button, select, summary, [role=button]`, and a figure is none of those.
    const cursor = await page
      .locator("figure")
      .first()
      .evaluate((el) => getComputedStyle(el).cursor);

    expect(cursor, "the photo takes a press but never invites one").toBe("pointer");
  });
});

test.describe("the footer fire", () => {
  test("shows a finger, because it answers a press", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // Pinned here by hand: the sitewide cursor sweep matches `button, select,
    // summary, [role=button]`, and a canvas is none of those.
    const cursor = await page
      .locator("footer canvas")
      .evaluate((el) => getComputedStyle(el).cursor);

    expect(cursor, "the fire takes a press but never invites one").toBe("pointer");
  });
});
