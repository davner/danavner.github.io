import { expect, type Page } from "@playwright/test";

/**
 * A state the page only reaches because someone did something.
 *
 * A sweep over `ROUTES` sees each page exactly as it loads, and two real
 * failures hide outside that: a navigation label at 3.28:1 that axe reports the
 * moment the sheet is open, and focusable content inside an `aria-hidden`
 * subtree with the sort listbox open.
 *
 * Shared rather than owned by one suite, because more than one thing is only
 * true in these states: the axe and heading-order sweeps in `a11y.spec.ts`, and
 * the shadow sweep in `site.spec.ts`, which is looking at surfaces that no
 * route load puts on screen at all.
 */
export interface OpenState {
  /** Reads as the test name, so it says which state broke. */
  name: string;
  path: string;
  /**
   * Forced when the control only exists at one size. The phone menu's trigger
   * is `sm:hidden`, so without this the state is unreachable in the desktop
   * project and the test would have to skip itself half the time.
   */
  width?: number;
  /**
   * Forced when the state depends on how tall the window is. The collections
   * panel caps its list against the viewport, and what that cap makes of the
   * list - a scroller, with everything a scroller brings - only exists in a
   * window short enough to engage it. Read only when `width` is set, since it
   * is the same resize.
   */
  height?: number;
  /** Drives the page into the state, and fails if it did not get there. */
  reach: (page: Page) => Promise<void>;
}

export const OPEN_STATES: OpenState[] = [
  {
    name: "the phone menu open",
    path: "/",
    width: 390,
    reach: async (page) => {
      await page.getByRole("button", { name: "Main menu" }).click();
      await expect(page.getByRole("dialog", { name: /menu/i })).toBeVisible();
    },
  },
  {
    /*
     * The bar the trigger sits in is `hidden sm:flex`, so without a width this
     * state is unreachable on the mobile project and the sweep quietly covers
     * nothing rather than failing.
     */
    name: "the collections menu open",
    path: "/",
    width: 1280,
    reach: async (page) => {
      await page.getByRole("button", { name: /collections/i }).click();
      await expect(page.locator("[data-slot=navigation-menu-content]")).toBeVisible();
    },
  },
  {
    name: "the sort listbox open",
    path: "/vinyl",
    reach: async (page) => {
      await page.getByRole("combobox", { name: /sort records/i }).click();
      await expect(page.getByRole("listbox")).toBeVisible();
    },
  },
  {
    name: "the share popover open",
    path: "/shows/bruno-mars-madrid-2026",
    reach: async (page) => {
      await page.getByRole("button", { name: /^Share/ }).click();
      const panel = page.getByRole("dialog", { name: /^Share / });
      await expect(panel).toBeVisible();
      /*
       * The card is drawn on a canvas after the panel opens. Scanning while it
       * is still building measures the spinner rather than the panel, so wait
       * for the loading line to go - it leaves on both the success and the
       * failure path, and the failure path is a state worth scanning too.
       */
      await expect(panel.getByText("Building the card")).toHaveCount(0, { timeout: 20_000 });
    },
  },
  {
    /*
     * The last slide is the state the arrow changes into, and the state where
     * dropping focus would strand the keyboard. Driven to the end rather than to
     * any slide, because the end is where both the `aria-disabled` announcement
     * and the dimmed styling arrive.
     */
    name: "the photo carousel on its last slide",
    path: "/shows/bilmuri-los-angeles-2026",
    reach: async (page) => {
      const slides = page.locator("[data-slot=carousel-item]");
      const count = await slides.count();
      expect(count, "the show has no photo strip to advance").toBeGreaterThan(1);

      const next = page.getByRole("button", { name: "Next slide" });
      for (let step = 1; step < count; step++) await next.click();
      await expect(next).toHaveAttribute("aria-disabled", "true");
    },
  },
  {
    name: "the email address revealed",
    path: "/career",
    reach: async (page) => {
      await page.getByRole("button", { name: /show email/i }).click();
      await expect(page.locator('a[href^="mailto:"]')).toHaveCount(1);
    },
  },
  {
    name: "every year on the show log expanded",
    path: "/shows",
    reach: async (page) => {
      const years = page.locator("details");
      const count = await years.count();
      // If the log ever stops using disclosures this state evaporates silently,
      // and a sweep over nothing passes.
      expect(count, "the show log has no year disclosures to expand").toBeGreaterThan(0);

      for (let index = 0; index < count; index++) {
        const year = years.nth(index);
        if ((await year.getAttribute("open")) === null) await year.locator("summary").click();
      }
      await expect(page.locator("details:not([open])")).toHaveCount(0);
    },
  },
  /*
   * The comic shelves render one at a time, so a load of /comics puts two of
   * the three nowhere in the DOM at all - and every tile on them is a heading
   * and a link like any other.
   *
   * Named here rather than read from `SHELVES`, which reaches this file only
   * through `src/lib/comics` and a Vite virtual module the test runner cannot
   * resolve. The URL assertions in `showShelf` are what holds the two copies
   * together: the page drops the query for whichever shelf is the default, so
   * a shelf that became the landing one fails here rather than going quiet.
   */
  {
    name: "the pull list shown",
    path: "/comics",
    reach: (page) => showShelf(page, /^This week/i, "pullList"),
  },
  {
    name: "the wants shelf shown",
    path: "/comics",
    reach: (page) => showShelf(page, /^Wants/i, "wants"),
  },
];

/**
 * One state by name, for a test that is about that state rather than about all
 * of them. Throws rather than skipping: a renamed entry would otherwise leave
 * the test measuring a page that was never driven anywhere.
 */
export function openState(name: string): OpenState {
  const state = OPEN_STATES.find((entry) => entry.name === name);
  if (!state) throw new Error(`no open state named "${name}"`);
  return state;
}

/**
 * Click a comic shelf pill and wait until the row has stopped moving.
 *
 * The pills cross-fade, and axe reads whatever colours are on screen when it
 * runs. Mid-transition those are interpolated blends belonging to neither
 * palette, and they report as contrast failures no reader is ever shown.
 *
 * The row is asked what is still animating rather than one pill asked whether
 * it has arrived at its colour, which looks equivalent and is not:
 * `aria-checked` moves a commit after the click, so a colour wait reads the
 * pill on its way out, finds it already wearing the value being waited for,
 * and returns with the whole row still fading.
 */
async function showShelf(page: Page, label: RegExp, id: string) {
  await page.getByRole("radio", { name: label }).click();
  await expect(page).toHaveURL(new RegExp(`shelf=${id}`));

  await expect
    .poll(
      () =>
        page.getByRole("radiogroup").evaluate((row) => row.getAnimations({ subtree: true }).length),
      { message: "the shelf pills are still cross-fading" },
    )
    .toBe(0);
}

/** Load `state.path` and drive it into `state`, ready to be inspected. */
export async function reachOpenState(page: Page, state: OpenState) {
  if (state.width) await page.setViewportSize({ width: state.width, height: state.height ?? 800 });
  await page.goto(state.path);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForLoadState("networkidle");

  await state.reach(page);
}
