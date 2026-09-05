import { expect, test } from "@playwright/test";

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
