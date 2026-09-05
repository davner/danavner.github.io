import { expect, test } from "@playwright/test";

import { ALL_SECTIONS, isGroup, SECTIONS } from "../src/lib/site";

import { openState, reachOpenState } from "./open-states";

/**
 * The nav panel says what each collection is, in the words `src/lib/site.ts`
 * holds.
 *
 * The second half is the point. The same sentences are also the home page's
 * index, and while they were written out in both places the two were free to
 * drift - a section described one way in the nav and another way one scroll
 * down. Asserting against `section.blurb` rather than against literals is what
 * makes that impossible: a test with the sentences typed into it is a third
 * copy, and the drift just moves here.
 *
 * `PAGE_META.description` is deliberately not compared. That one is the tab
 * title and the search result, written in a different voice and a different
 * length, and on eight of the nine sections it is different copy on purpose -
 * `/now` is the exception, and only because both read `NOW_DESCRIPTION`. A test
 * demanding the two agree would be a test demanding nine descriptions get
 * rewritten.
 *
 * Below `sm` the bar collapses into the phone Sheet and this panel does not
 * exist, so the open state forces a width and the mobile project measures the
 * same desktop panel. The phone menu carries no descriptors, and that is a
 * decision rather than an omission: a drawer holding nine links plus nine
 * sentences is a scroll, and its group headings already say what the sections
 * have in common.
 */

/** The group the panel opens, read off the nav so a renamed one fails here. */
const COLLECTIONS = SECTIONS.filter(isGroup)[0];

/** The paths the panel lists. The rest of the sections sit in the bar. */
const IN_PANEL = new Set(COLLECTIONS.items.map((item) => item.to));

test("the bar names the group whatever site.ts calls it", async ({ page }) => {
  /*
   * The open state finds the same trigger by a literal, so this is what says
   * which of the two is the source. Matched case-insensitively because the
   * label is set in the readout style: Chrome's accessible name is computed
   * after `text-transform`, so the button announces itself in capitals.
   */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();

  await expect(
    page.getByRole("button", { name: new RegExp(`^${COLLECTIONS.label}$`, "i") }),
  ).toBeVisible();
});

test("the collections panel gives every row the blurb site.ts holds", async ({ page }) => {
  await reachOpenState(page, openState("the collections menu open"));
  const panel = page.locator("[data-slot=navigation-menu-content]");

  // First, so the loop below cannot pass by looking at four of five rows, or
  // miss a sixth that no section declared.
  await expect(panel.locator("a")).toHaveCount(COLLECTIONS.items.length);
  await expect(panel.locator("[data-slot=nav-blurb]")).toHaveCount(COLLECTIONS.items.length);

  /*
   * Over every section rather than over the group's five, so a section moved
   * out of the group is checked in its new home too. The bar's four carry a
   * blurb of their own - the home index prints it - and the panel is not where
   * it belongs.
   */
  for (const section of ALL_SECTIONS) {
    const row = panel.locator(`a[href="${section.to}"]`);

    if (!IN_PANEL.has(section.to)) {
      await expect(row, `${section.to} belongs in the bar, not the panel`).toHaveCount(0);
      continue;
    }

    await expect(row, `${section.to} is missing from the panel`).toHaveCount(1);
    await expect(row.locator("[data-slot=nav-blurb]"), section.to).toHaveText(section.blurb);
    await expect(row, `${section.to} lost its name`).toContainText(section.label);
  }
});

test("every section carries a blurb", () => {
  // The type asks for a string; this asks for a sentence. An empty one renders
  // as a row shorter than its neighbours and fails nothing else.
  const blank = ALL_SECTIONS.filter((section) => section.blurb.trim() === "").map(
    (section) => section.to,
  );

  expect(blank).toEqual([]);
});
