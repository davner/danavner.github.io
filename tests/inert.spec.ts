import { expect, test, type Page } from "@playwright/test";

/**
 * `src/lib/inert-behind-overlay.ts` mirrors `inert` onto whatever the
 * `aria-hidden` package hid behind a modal, because `aria-hidden` alone leaves
 * every control in there tabbable, focusable and findable by find-in-page.
 *
 * This file is written against the ways the mirror can break rather than against
 * the way it currently works. It can stop mirroring anything - a change to which
 * elements the library hides, or a marker rename - while every other check on
 * the page still passes, so a green suite is not on its own evidence that the
 * mirror ran.
 *
 * ## What each assertion here would and would not catch
 *
 * - **`aria-hidden-focus` in the open state**, in `tests/a11y.spec.ts`, is the
 *   outcome test and cares about no mechanism at all. Strip the mirror and it
 *   reports violations with the listbox open. It is the strongest of the three
 *   and it lives there rather than here because it is an axe run.
 * - **The marker canary and the mirror's completeness**, below. `MARKER` in the
 *   source hardcodes `"data-aria-hidden"`, which is the *default value* of
 *   `hideOthers(target, parentNode, markerName)` rather than an exported
 *   constant, and `package.json` pins `radix-ui` at a caret. An `npm update`
 *   that changes that default turns the mirror into a no-op. "Everything
 *   marked is inert" alone would pass vacuously in that world, because nothing
 *   would be marked - so the count is asserted separately and first.
 * - **Tab containment**, below, is deliberately *not* a guard on the mirror.
 *   With every `inert` attribute stripped back off, Tab is still held inside
 *   the overlay, because Radix's focus scope holds the boundary itself. What it
 *   guards is the other direction - the mirror also marks Radix's own focus
 *   guards inert, and the source claims by hand that this costs nothing. This
 *   is that claim, checked.
 *
 * A programmatic `focus()` on a control behind the overlay looks like the
 * obvious mechanism-independent test and is not one: measured, Radix's focus
 * scope pulls focus straight back whether or not anything is inert, so the
 * assertion passes just as happily against the broken page.
 */

/** What is hidden, what is inert, and where the two disagree. */
const readOverlayState = () => {
  const describe = (el: Element) => {
    const slot = el.getAttribute("data-slot");
    return `<${el.tagName.toLowerCase()}${slot ? ` data-slot="${slot}"` : ""}>`;
  };
  const marked = [...document.querySelectorAll('[data-aria-hidden="true"]')];
  const inert = [...document.querySelectorAll("[inert]")];

  return {
    markedCount: marked.length,
    inertCount: inert.length,
    markedNotInert: marked.filter((el) => !el.hasAttribute("inert")).map(describe),
    inertNotMarked: inert
      .filter((el) => el.getAttribute("data-aria-hidden") !== "true")
      .map(describe),
  };
};

/** Whether the page's one live region is still reachable from where it sits. */
const readLiveRegion = () => {
  const region = document.querySelector('[role="status"]');
  return {
    present: Boolean(region),
    insideInert: Boolean(region?.closest("[inert]")),
    insideAriaHidden: Boolean(region?.closest('[aria-hidden="true"]')),
  };
};

/** Where focus is, and whether it is still inside the given container. */
const readFocus = (selector: string) => {
  const active = document.activeElement as HTMLElement | null;
  return {
    inside: Boolean(active?.closest(selector)),
    what: `<${active?.tagName.toLowerCase()}> ${(active?.textContent ?? "").trim().slice(0, 30)}`,
  };
};

async function expectNothingHeldOpen(page: Page, closedBy: string) {
  const state = await page.evaluate(readOverlayState);
  expect(state.markedCount, `${closedBy} left the page marked hidden`).toBe(0);
  expect(state.inertCount, `${closedBy} left ${state.inertCount} element(s) inert`).toBe(0);
}

test.describe("the phone menu", () => {
  test.beforeEach(async ({ page }) => {
    // Forced rather than left to the mobile project, so the state is reached in
    // both: the trigger is `sm:hidden`.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  const open = async (page: Page) => {
    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(page.getByRole("dialog", { name: /menu/i })).toBeVisible();
  };

  test("the library still marks the page behind it", async ({ page }) => {
    await open(page);

    const state = await page.evaluate(readOverlayState);
    expect(
      state.markedCount,
      "nothing carries `data-aria-hidden` any more, so the mirror in " +
        "src/lib/inert-behind-overlay.ts has nothing to follow and is a no-op. " +
        "That attribute is aria-hidden's default marker name, not a promise - " +
        "check what `hideOthers` defaults to now.",
    ).toBeGreaterThan(0);
  });

  test("everything it hides is inert, and nothing else is", async ({ page }) => {
    await open(page);

    const state = await page.evaluate(readOverlayState);
    expect(state.markedNotInert, "hidden behind the menu but still reachable").toEqual([]);
    expect(state.inertNotMarked, "made inert without the library hiding it").toEqual([]);
  });

  test("the live region behind it stays reachable", async ({ page }) => {
    await open(page);

    /*
     * `aria-hidden` deliberately leaves a live region reachable so a status
     * message can still be announced from behind a modal, and the mirror has to
     * leave it alone too. A mirror pointed at the app root would make this
     * subtree inert instead - which is exactly what the library's per-child
     * hiding produces once a live region is present.
     */
    const region = await page.evaluate(readLiveRegion);
    expect(region.present, "/vinyl lost its filtered-count live region").toBe(true);
    expect(region.insideInert, "the live region went inert behind the menu").toBe(false);
    expect(region.insideAriaHidden, "the live region went aria-hidden behind the menu").toBe(false);
  });

  test("Tab stays inside it", async ({ page }) => {
    await open(page);

    const escaped: string[] = [];
    for (let stop = 0; stop < 12; stop++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(readFocus, '[role="dialog"]');
      if (!focus.inside) escaped.push(`stop ${stop + 1}: ${focus.what}`);
    }
    expect(escaped, "Tab left the menu").toEqual([]);
  });

  test("Shift+Tab stays inside it", async ({ page }) => {
    await open(page);

    const escaped: string[] = [];
    for (let stop = 0; stop < 12; stop++) {
      await page.keyboard.press("Shift+Tab");
      const focus = await page.evaluate(readFocus, '[role="dialog"]');
      if (!focus.inside) escaped.push(`stop ${stop + 1}: ${focus.what}`);
    }
    expect(escaped, "Shift+Tab left the menu").toEqual([]);
  });

  test("Escape leaves nothing inert", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expectNothingHeldOpen(page, "Escape");
  });

  test("the close button leaves nothing inert", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expectNothingHeldOpen(page, "the close button");
  });

  test("a click outside dismisses it and leaves nothing inert", async ({ page }) => {
    await open(page);

    /*
     * Dispatched at a coordinate rather than by clicking the overlay element.
     * The overlay carries the marker like everything else outside the drawer,
     * so it is inert too, and an inert element fails Playwright's actionability
     * check - `<html> intercepts pointer events`. That is not a defect: the
     * dismiss listener is on the document, so the click still lands and still
     * closes the drawer, which is the first thing this asserts.
     */
    await page.mouse.click(5, 400);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expectNothingHeldOpen(page, "a click outside");
  });

  test("following a link out of it leaves nothing inert", async ({ page }) => {
    await open(page);
    await page.getByRole("dialog").getByRole("link", { name: "Comics" }).click();
    await page.waitForURL("**/comics");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expectNothingHeldOpen(page, "a route change");
  });
});

test.describe("the sort listbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  const open = async (page: Page) => {
    await page.getByRole("combobox", { name: /sort records/i }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
  };

  test("the library still marks the page behind it", async ({ page }) => {
    await open(page);

    const state = await page.evaluate(readOverlayState);
    expect(
      state.markedCount,
      "nothing carries `data-aria-hidden` any more, so the mirror in " +
        "src/lib/inert-behind-overlay.ts has nothing to follow and is a no-op. " +
        "That attribute is aria-hidden's default marker name, not a promise - " +
        "check what `hideOthers` defaults to now.",
    ).toBeGreaterThan(0);
  });

  test("everything it hides is inert, and nothing else is", async ({ page }) => {
    await open(page);

    const state = await page.evaluate(readOverlayState);
    expect(state.markedNotInert, "hidden behind the listbox but still reachable").toEqual([]);
    expect(state.inertNotMarked, "made inert without the library hiding it").toEqual([]);
  });

  test("the live region behind it stays reachable", async ({ page }) => {
    await open(page);

    const region = await page.evaluate(readLiveRegion);
    expect(region.present, "/vinyl lost its filtered-count live region").toBe(true);
    expect(region.insideInert, "the live region went inert behind the listbox").toBe(false);
    expect(region.insideAriaHidden, "the live region went aria-hidden behind the listbox").toBe(
      false,
    );
  });

  test("Tab stays inside it", async ({ page }) => {
    await open(page);

    const escaped: string[] = [];
    for (let stop = 0; stop < 6; stop++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(readFocus, '[role="listbox"]');
      if (!focus.inside) escaped.push(`stop ${stop + 1}: ${focus.what}`);
    }
    expect(escaped, "Tab left the listbox").toEqual([]);
    await expect(page.getByRole("listbox")).toBeVisible();
  });

  test("Escape leaves nothing inert", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await expectNothingHeldOpen(page, "Escape");
  });

  test("choosing an option leaves nothing inert", async ({ page }) => {
    await open(page);
    // Written out rather than imported, for the reason `tests/site.spec.ts`
    // gives: `src/lib/vinyl.ts` pulls in the `virtual:` content plugin.
    await page.getByRole("option", { name: "By artist" }).click();
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await expectNothingHeldOpen(page, "choosing an option");
  });

  test("a click outside leaves nothing inert", async ({ page }) => {
    await open(page);
    await page.mouse.click(5, 5);
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await expectNothingHeldOpen(page, "a click outside");
  });
});

/*
 * There is no overlay inside an overlay to test: the drawer holds links and
 * nothing else, the listbox holds options, and the share popover is
 * non-modal - measured, it marks nothing at all, so it has no page behind it in
 * this sense. Opening one while another is open is not reachable either,
 * because the second trigger is inert. What is reachable, and is what
 * `aria-hidden`'s reference counting could plausibly get wrong, is the same
 * overlay opened and closed repeatedly and two different overlays used in turn
 * on one page.
 */
test.describe("overlays used in turn", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  test("the listbox cycled quickly leaves nothing behind and still hides as much", async ({
    page,
  }) => {
    const sort = page.getByRole("combobox", { name: /sort records/i });

    await sort.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const first = (await page.evaluate(readOverlayState)).markedCount;
    expect(first).toBeGreaterThan(0);

    for (let cycle = 0; cycle < 6; cycle++) {
      await page.keyboard.press("Escape");
      await sort.click();
    }
    await expect(page.getByRole("listbox")).toBeVisible();

    // A marker that is refcounted up and never down would show as a subtree
    // that stays hidden, or as one that stops being hidden at all.
    const cycled = await page.evaluate(readOverlayState);
    expect(cycled.markedCount, "cycling changed how much the listbox hides").toBe(first);
    expect(cycled.markedNotInert, "hidden but still reachable after cycling").toEqual([]);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expectNothingHeldOpen(page, "cycling the listbox");
  });

  test("the menu after the listbox leaves nothing behind", async ({ page }) => {
    await page.getByRole("combobox", { name: /sort records/i }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(page.getByRole("dialog", { name: /menu/i })).toBeVisible();

    const state = await page.evaluate(readOverlayState);
    expect(
      state.markedCount,
      "the menu hid nothing after the listbox had been open",
    ).toBeGreaterThan(0);
    expect(state.markedNotInert, "hidden behind the menu but still reachable").toEqual([]);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNothingHeldOpen(page, "two overlays in turn");
  });
});
