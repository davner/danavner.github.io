import { expect, test, type Page } from "@playwright/test";

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
 *
 * The panel's own shape is here for a reason the sweeps cannot cover: it fits
 * the window it hangs in, and the keyboard can get back out of it. Both are
 * only true of a panel that is open, and the two sweeps that would otherwise
 * catch either - the width sweep in `tests/responsive.spec.ts` and the axe run
 * in `tests/a11y.spec.ts` - walk each route as it loads, with this closed.
 */

/** The group the panel opens, read off the nav so a renamed one fails here. */
const COLLECTIONS = SECTIONS.filter(isGroup)[0];

/** The paths the panel lists. The rest of the sections sit in the bar. */
const IN_PANEL = new Set(COLLECTIONS.items.map((item) => item.to));

/** The panel, which is in the DOM only while it is open. */
const PANEL = "[data-slot=navigation-menu-content]";

/** The state every case below drives to, resized per case. */
const OPEN = openState("the collections menu open");

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

/**
 * The widths the panel has to hang in.
 *
 * 640 is the first pixel the bar exists at, so it is the narrowest window the
 * panel is ever opened in; 768 is where upstream's own positioning would take
 * over; and 1280 is a window wide enough that only the anchoring can put the
 * panel outside it. The trigger is the last thing in the bar, so the panel's
 * right edge is the one at risk at every one of them.
 */
for (const width of [640, 768, 1280]) {
  test(`the open panel stays inside a ${width}px window`, async ({ page }) => {
    await reachOpenState(page, { ...OPEN, width });

    const fit = await page.locator(PANEL).evaluate((panel) => {
      const box = panel.getBoundingClientRect();
      const doc = document.documentElement;

      return {
        past: Math.round(box.right - doc.clientWidth),
        short: Math.round(box.left),
        // The symptom either way: a menu you have to scroll the page sideways
        // to read, on a page that has nothing else off to the right.
        sideways: doc.scrollWidth - doc.clientWidth,
      };
    });

    expect(
      fit.past,
      `the panel ends ${fit.past}px past the right of the window`,
    ).toBeLessThanOrEqual(0);
    expect(fit.short, "the panel starts off the left of the window").toBeGreaterThanOrEqual(0);
    expect(
      fit.sideways,
      `the page scrolls sideways by ${fit.sideways}px with the panel open`,
    ).toBeLessThanOrEqual(1);
  });
}

/**
 * A window short enough that the panel's list has to scroll.
 *
 * The cap is `min(70svh, 32rem)` against five rows of about 445px, so the list
 * overflows below roughly 636px of window. Chrome puts an overflowing scroller
 * in the tab order, and that stop is what has to not exist.
 */
const SHORT_WINDOW = 600;

test("the keyboard leaves the panel at the end of its links", async ({ page }) => {
  await reachOpenState(page, { ...OPEN, height: SHORT_WINDOW });

  const list = page.locator(`${PANEL} ul`);
  expect(
    await list.evaluate((ul) => ul.scrollHeight > ul.clientHeight),
    `the list is not scrolling in a ${SHORT_WINDOW}px window, so there is no extra stop to check`,
  ).toBe(true);

  await page.locator(`${PANEL} a`).last().focus();
  await page.keyboard.press("Tab");

  expect(
    // Read off the document rather than off the panel: focus moving out is
    // one of the things that dismisses the panel, and a panel that has gone
    // is not one the keyboard is stuck inside.
    await page.evaluate((selector) => {
      const panel = document.querySelector(selector);
      return panel ? panel.contains(document.activeElement) : false;
    }, PANEL),
    "Tab from the last link stayed inside the panel, with nothing further to tab to",
  ).toBe(false);
});

/** Whether focus is inside the panel, asked of the document for the same reason. */
const focusIsInPanel = (page: Page) =>
  page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    return panel ? panel.contains(document.activeElement) : false;
  }, PANEL);

/**
 * And back in again, which is the direction with something under it.
 *
 * Radix pulls the panel's links out of the tab order the moment focus leaves
 * the panel for the trigger, and leaves the panel open while it does - so this
 * is a settled state rather than a race, and one Shift+Tab reaches it. What
 * puts the links back is the focus proxy `components/ui/navigation-menu.tsx`
 * describes: Tab hands focus to it, and its `onFocus` restores the order and
 * moves on into the panel.
 *
 * Which makes this the case that decides what may be done about the proxy's
 * `aria-hidden-focus`. Take its tab stop away - `tabindex="-1"`, or hiding the
 * span - and this Tab lands on the theme toggle instead, leaving five links
 * sitting open on screen that a mouse can reach and a keyboard cannot.
 */
test("the keyboard gets back into the panel it just left", async ({ page }) => {
  await reachOpenState(page, OPEN);

  const trigger = page.locator("[data-slot=navigation-menu-trigger]").first();
  await trigger.focus();
  await page.keyboard.press("Tab");
  expect(await focusIsInPanel(page), "Tab from the trigger never reached the panel").toBe(true);

  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(PANEL), "leaving for the trigger closed the panel").toBeVisible();

  // Asserted rather than assumed: if Radix stops stripping the links, Tab
  // reaches them whatever the proxy does, and the case below proves nothing.
  const stripped = await page
    .locator(`${PANEL} a`)
    .evaluateAll((links) => links.filter((link) => link.tabIndex < 0).length);
  expect(
    stripped,
    "the panel's links are still in the tab order, so nothing has to restore them",
  ).toBeGreaterThan(0);

  await page.keyboard.press("Tab");
  expect(
    await focusIsInPanel(page),
    "Tab off the trigger walked past an open panel whose links were out of the tab order",
  ).toBe(true);
});
