import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { ROUTES } from "./routes";

/**
 * axe cannot prove a page is accessible, but it reliably catches the things
 * that are easy to break without noticing: contrast, landmarks, names on
 * interactive elements, heading order. Both themes are checked because the
 * palettes are independent and contrast is the most fragile of those.
 *
 * Two sweeps, in one file so the tag list and the allowlist below cannot fork:
 * every route as it loads, and then the states a route load never reaches.
 */
/*
 * The bar `PRODUCT.md` commits to is WCAG 2.2 AA, so the constant states 2.2
 * rather than whatever the tool happens to cover. In axe-core 4.12.1 `wcag22a`
 * matches zero rules and `wcag22aa` matches exactly one, `target-size`; the
 * A-level tag is listed anyway so this reads as the standard and picks up new
 * rules as axe adds them.
 *
 * Do not swap `withTags` for `options({ rules })` to turn something on.
 * `AxeBuilder.options()` replaces the tag filter rather than narrowing it, so
 * the run goes from 63 rules to 90 and promotes `region`, `heading-order`, the
 * `landmark-*` family and `tabindex` - best-practice rules, not WCAG - into
 * build gates.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/** axe's own result shapes, read off the builder so nothing imports `axe-core` directly. */
type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type Finding = AxeResults["incomplete"][number];
type FindingNode = Finding["nodes"][number];

/*
 * axe's third bucket. `incomplete` is a rule that ran and reached no verdict,
 * which reads exactly like a pass to anything that only looks at `violations`
 * - so a rule that quietly stops evaluating never shows up.
 *
 * Keyed by rule and then decided per node, rather than as a set of rule ids,
 * because the same rule can be undecidable for a bounded reason in one place
 * and be sitting on a real defect in another. `aria-valid-attr-value` was both
 * on this site at once, in states a route load never reaches: on the share
 * popover's trigger it is axe declining to resolve an `aria-controls` that
 * points into a popup, and on the sort listbox it was a `role="group"` whose
 * `aria-labelledby` pointed at an id no label ever rendered. Allowing the rule
 * outright to excuse the first would have hidden the second, which this sweep
 * caught and `select-control.tsx` fixed by dropping the group. Only the popup
 * case is allowed, and only at the nodes that give that reason.
 *
 * `color-contrast` is allowed at every node, and only for part of the page:
 * the grain overlay in `backdrop.tsx` is a background image axe cannot
 * resolve, so nodes sitting over it come back undecided. Measured across all
 * 13 routes in both themes, it decides 1,896 of 2,292 contrast nodes and
 * leaves 396 - 17% - undecided, for six specific reasons `PRODUCT.md` lists.
 * That slice is bounded and is measured from painted pixels instead.
 * Everything else is gated, which is green today on every route in both
 * themes.
 *
 * Use `withTags` to change what runs. `disableRules` is not the way to widen
 * this allowlist, but not because it would misbehave: measured in
 * `@axe-core/playwright` 4.12.1, `options()` at dist/index.js:170 assigns
 * `this.option = options` outright, which is why it discards the tag filter,
 * while `disableRules()` at :209 only writes `this.option.rules` and never
 * touches `.runOnly`, so it composes with `withTags` in either order. The
 * reason to keep the allowlist here is that `disableRules(["color-contrast"])`
 * would stop axe reporting a genuine contrast *violation* as well as an
 * undecided one, which is most of what the rule is here for.
 */
const EXPLAINED: Record<string, (node: FindingNode) => boolean> = {
  "color-contrast": () => true,
  /*
   * `aria-controls` on a trigger that also carries `aria-haspopup`: axe will
   * not decide whether the target exists, because with a popup it may not be
   * rendered yet. It is rendered here, which the last test in this file
   * asserts directly rather than leaving on trust - so the reference is sound
   * and only the check is undecidable. Any other reason this rule lands in
   * `incomplete`, `noId` above all, still fails.
   */
  "aria-valid-attr-value": (node) =>
    node.all.length > 0 &&
    node.all.every((check) => check.data?.messageKey === "controlsWithinPopup"),
};

/** The undecided results with no accepted reason for being undecided. */
function unexplained(incomplete: Finding[]): Finding[] {
  return incomplete.filter((finding) => {
    const explains = EXPLAINED[finding.id];
    return !explains || !finding.nodes.every(explains);
  });
}

/**
 * Run axe over whatever is on screen right now and fail on anything it either
 * reports or cannot decide.
 *
 * `subject` names the page and the state in the failure message, because both
 * sweeps below produce failures that are otherwise indistinguishable.
 */
async function expectAxeClean(page: Page, testInfo: TestInfo, subject: string) {
  const { violations, incomplete } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  if (violations.length > 0) {
    await testInfo.attach("axe-violations", {
      body: JSON.stringify(violations, null, 2),
      contentType: "application/json",
    });
  }
  // Attached whether or not anything is wrong, so the size of the
  // undecided slice stays visible rather than being inferred.
  await testInfo.attach("axe-incomplete", {
    body: JSON.stringify(incomplete, null, 2),
    contentType: "application/json",
  });

  expect(
    violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`),
    subject,
  ).toEqual([]);

  expect(
    unexplained(incomplete).map((r) => `${r.id} (${r.nodes.length}): ${r.help}`),
    `${subject} reached no verdict`,
  ).toEqual([]);
}

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    for (const path of ROUTES) {
      test(`${path} has no axe violations`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).waitFor();
        // The starfield paints on a canvas; let it settle so nothing is mid-render.
        await page.waitForLoadState("networkidle");

        await expectAxeClean(page, testInfo, `${path} in ${colorScheme} mode`);
      });
    }
  });
}

/**
 * A state the page only reaches because someone did something.
 *
 * The sweep above sees a route exactly as it loads, and that is where two of
 * the six failures the 2026-08 audit found were hiding: a navigation label at
 * 3.28:1 that axe reports as an ordinary violation the moment the sheet is
 * open, and focusable content inside an `aria-hidden` subtree with the sort
 * listbox open. Nothing had ever asked. Measured while writing this, stripping
 * the `inert` mirror back out reproduces the second one exactly - seven
 * `aria-hidden-focus` violations with the listbox open, three undecided nodes
 * of the same rule with the sheet open - so this sweep is the guard on that
 * fix that does not care how the fix is implemented.
 */
interface OpenState {
  /** Reads as the test name, so it says which state broke. */
  name: string;
  path: string;
  /**
   * Forced when the control only exists at one size. The phone menu's trigger
   * is `sm:hidden`, so without this the state is unreachable in the desktop
   * project and the test would have to skip itself half the time.
   */
  width?: number;
  /** Drives the page into the state, and fails if it did not get there. */
  reach: (page: Page) => Promise<void>;
}

const OPEN_STATES: OpenState[] = [
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
];

test.describe("states a route load never reaches", () => {
  for (const colorScheme of ["dark", "light"] as const) {
    test.describe(`${colorScheme} mode`, () => {
      for (const state of OPEN_STATES) {
        test(`${state.path} with ${state.name} has no axe violations`, async ({
          page,
        }, testInfo) => {
          await page.emulateMedia({ colorScheme });
          if (state.width) await page.setViewportSize({ width: state.width, height: 800 });
          await page.goto(state.path);
          await page.getByRole("heading", { level: 1 }).waitFor();
          await page.waitForLoadState("networkidle");

          await state.reach(page);

          await expectAxeClean(
            page,
            testInfo,
            `${state.path} with ${state.name} in ${colorScheme} mode`,
          );
        });
      }
    });
  }
});

/**
 * The other half of the `aria-valid-attr-value` allowlist above.
 *
 * axe declines to resolve an `aria-controls` on a trigger that also carries
 * `aria-haspopup`, so allowing that result means nothing is checking the
 * reference at all. This checks it, in the one state where the panel is
 * definitely rendered and the reference therefore has to resolve.
 */
test("the share popover's trigger points at a panel that exists", async ({ page }) => {
  await page.goto("/shows/bruno-mars-madrid-2026");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("button", { name: /^Share/ }).click();
  await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible();

  const reference = await page.evaluate(() => {
    const trigger = document.querySelector('[data-slot="popover-trigger"][aria-expanded="true"]');
    const id = trigger?.getAttribute("aria-controls") ?? null;
    return { id, resolves: Boolean(id && document.getElementById(id)) };
  });

  expect(reference.id, "the open trigger has no aria-controls to check").toBeTruthy();
  expect(reference.resolves, `aria-controls="${reference.id}" points at nothing`).toBe(true);
});
