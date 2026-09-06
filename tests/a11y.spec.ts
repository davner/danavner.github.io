import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { OPEN_STATES, reachOpenState } from "./open-states";
import { ROUTES } from "./routes";

/**
 * axe cannot prove a page is accessible, but it reliably catches the things
 * that are easy to break without noticing: contrast, landmarks, names on
 * interactive elements, heading order. Both themes are checked because the
 * palettes are independent and contrast is the most fragile of those.
 *
 * Three sweeps, in one file so the tag list and the allowlist below cannot
 * fork: every route as it loads, the states a route load never reaches, and
 * heading order across both.
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
 * and be sitting on a real defect in another. `aria-valid-attr-value` can be
 * both at once, in states a route load never reaches: on the share popover's
 * trigger it is axe declining to resolve an `aria-controls` that points into a
 * popup, and on a `role="group"` whose `aria-labelledby` points at an id no
 * label renders it is a real defect. Allowing the rule outright to excuse the
 * first hides the second. Only the popup case is allowed, and only at the nodes
 * that give that reason.
 *
 * `color-contrast` is allowed at every node, and only for part of the page:
 * the grain overlay in `backdrop.tsx` is a background image axe cannot
 * resolve, so nodes sitting over it come back undecided. axe decides the large
 * majority of contrast nodes here and leaves a bounded slice undecided, for the
 * six specific reasons `PRODUCT.md` lists. That slice is measured from painted
 * pixels instead. Everything else is gated, on every route and on every state
 * in `OPEN_STATES`, in both themes.
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
   *
   * The blind spot, for whoever is about to put another ARIA attribute on a
   * trigger that already carries `aria-controls`. This reads `messageKey` as
   * if it named the node's one undecidable attribute, and it does not. In
   * axe-core 4.12.1 `ariaValidAttrValueEvaluate` keeps a single `messageKey`
   * variable and overwrites it while iterating the node's `aria-*` attributes,
   * so only the last one to write it survives into the `data()` this predicate
   * reads. Four attributes write it: `aria-controls` sets
   * `controlsWithinPopup`, `aria-current` sets `ariaCurrent`, and
   * `aria-labelledby` and `aria-describedby` set `noId` when they point at an
   * id that is not in the document. Give one element an `aria-controls` into a
   * popup and a dangling `aria-labelledby`, and the two collide, with whichever
   * attribute axe processes last deciding what the whole node reports. When
   * `controlsWithinPopup` is the one that survives, `every` here is satisfied,
   * the node is admitted, and the dangling reference passes the gate instead of
   * failing it. That is the sort listbox defect above, arriving wearing the
   * share popover's excuse.
   *
   * What bounds it is that the collision only reaches results the rule left
   * undecided. An attribute whose value is outright invalid goes into axe's
   * `invalid` list, which makes the rule return false and report an ordinary
   * violation, and violations are gated with no allowlist in front of them.
   * The exposure is precisely a dangling idref sharing an element with a popup
   * trigger. Nothing on the site puts those together, which is why this is
   * recorded rather than fixed.
   *
   * Worth naming the shape plainly, because it is the reason this branch
   * exists repeated one level down: a gate that read only `violations` hid real
   * defects sitting in `incomplete`, and an allowlist keyed on one message can
   * hide a real defect sitting behind the one message it was written to admit.
   * If a trigger ever does carry both, the fix is for this predicate to stop
   * letting `messageKey` speak for the entire node.
   */
  "aria-valid-attr-value": (node) =>
    node.all.length > 0 &&
    node.all.every((check) => check.data?.messageKey === "controlsWithinPopup"),
  /*
   * `aria-labelledby` on the navigation panel, pointing at the trigger that
   * opened it. Radix sets it on every `NavigationMenuContent` and gives the
   * element no role, so axe cannot decide whether the name reaches anything and
   * reports the attribute as unsupported rather than as wrong.
   *
   * Nothing is lost either way. A div with no role has no accessible name to
   * carry in the first place, and what tells a reader where they are is the
   * trigger's own `aria-expanded` and `aria-controls`.
   *
   * Pinned to that one attribute on that one element rather than to the
   * message: the comment above explains why `messageKey` cannot be trusted to
   * speak for a whole node. A prohibited attribute of ours would name something
   * other than `aria-labelledby`, or sit on an element that has a role, and
   * still fails.
   */
  "aria-prohibited-attr": (node) =>
    node.none.length > 0 &&
    node.none.every(
      (check) =>
        check.data?.role == null &&
        check.data?.nodeName === "div" &&
        Array.isArray(check.data?.prohibited) &&
        check.data.prohibited.length === 1 &&
        check.data.prohibited[0] === "aria-labelledby",
    ) &&
    // Radix builds this id as `${baseId}-content-${value}`, so the infix is
    // what says the node is a navigation panel rather than anything of ours.
    node.target.some((target) => String(target).includes("-content-")),
};

/*
 * Radix's focus proxy: the visually hidden span `NavigationMenuTrigger` mounts
 * beside itself while its panel is open, to hand the keyboard into the panel
 * and back out of it.
 *
 * Nothing is kept out of the scans below on its account. It ships carrying
 * `aria-hidden` alongside its tab stop, which is `aria-hidden-focus` and a
 * Level A failure of 4.1.2; `components/ui/navigation-menu.tsx` takes the
 * attribute back off and leaves the stop, for the reason set out there. So the
 * open-state sweep is what holds that fix - put the attribute back and these
 * tests report it, in both themes.
 *
 * Named by the tab stop rather than by the attribute, because the attribute is
 * the thing that is supposed to be gone. The tests at the foot of this file
 * still need to find the node, to say that focus passes through it rather than
 * stopping on it.
 */
const RADIX_FOCUS_PROXY = '[data-slot="navigation-menu-item"] > span[tabindex="0"]';

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

test.describe("states a route load never reaches", () => {
  for (const colorScheme of ["dark", "light"] as const) {
    test.describe(`${colorScheme} mode`, () => {
      for (const state of OPEN_STATES) {
        test(`${state.path} with ${state.name} has no axe violations`, async ({
          page,
        }, testInfo) => {
          await page.emulateMedia({ colorScheme });
          await reachOpenState(page, state);

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
 * Heading order, on its own builder.
 *
 * `heading-order` is a best-practice rule rather than a WCAG one, so `TAGS`
 * never reaches it and a card title two levels under the page title goes
 * unreported. Adding "best-practice" to `TAGS` would fix that and promote a
 * dozen unrelated rules into build gates at the same time, which is the trade
 * the comment on `TAGS` exists to refuse - so this runs as a second scan with
 * `withRules`, which sets its own `runOnly` and leaves `TAGS` alone.
 *
 * Over `OPEN_STATES` as well as the routes, because axe reads the DOM and the
 * pages keep a good deal of themselves out of it: every year on the show log
 * but the newest starts inside a closed `<details>`, and the comic shelves
 * render one at a time. Gating only what a plain load happens to render leaves
 * the rest to be found by hand.
 *
 * One pass rather than one per theme: nesting is structure, and the palettes
 * cannot change it.
 */
async function expectHeadingOrder(page: Page, subject: string) {
  const { violations } = await new AxeBuilder({ page }).withRules(["heading-order"]).analyze();

  expect(
    violations.flatMap((violation) => violation.nodes.map((node) => node.html)),
    `${subject} skips a heading level`,
  ).toEqual([]);
}

test.describe("heading order", () => {
  for (const path of ROUTES) {
    test(`${path} nests its headings under the page title`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForLoadState("networkidle");

      await expectHeadingOrder(page, path);
    });
  }

  for (const state of OPEN_STATES) {
    test(`${state.path} with ${state.name} nests its headings under the page title`, async ({
      page,
    }) => {
      await reachOpenState(page, state);

      await expectHeadingOrder(page, `${state.path} with ${state.name}`);
    });
  }
});

/**
 * The other half of the `RADIX_FOCUS_PROXY` note above.
 *
 * The proxy keeps its tab stop because it passes focus on rather than holding
 * it. This is what checks that it does, in the one state where it is rendered
 * at all - a release that stopped moving focus out of it would leave a stop on
 * a span with no name and nothing in it, which is the defect the attribute was
 * removed on the strength of it not being.
 *
 * Both directions, because they are two branches of the same `onFocus` and only
 * one of them is Tab arriving from the trigger. Coming back out of the panel the
 * proxy is met from the other side, by the direction the forward assertion
 * cannot speak for.
 */
test("the navigation menu hands the keyboard to its panel and back", async ({ page }) => {
  // The bar is `hidden sm:flex`, so the trigger exists only above 640.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();

  const trigger = page.locator("[data-slot=navigation-menu-trigger]").first();
  await trigger.press("Enter");
  const panel = page.locator("[data-slot=navigation-menu-content]");
  await panel.waitFor();

  await page.keyboard.press("Tab");

  expect(
    await panel.evaluate((node) => node.contains(document.activeElement)),
    "Tab stopped on the hidden proxy instead of being handed into the panel",
  ).toBe(true);

  await page.keyboard.press("Shift+Tab");

  // Both halves in one assertion: off the proxy, and onto the control the
  // panel belongs to rather than anywhere else the tab order might lead.
  expect(
    await page.evaluate((selector) => {
      const active = document.activeElement;
      return {
        onProxy: active?.matches(selector) ?? false,
        slot: active?.getAttribute("data-slot") ?? null,
      };
    }, RADIX_FOCUS_PROXY),
    "Shift+Tab out of the panel did not land back on its trigger",
  ).toEqual({ onProxy: false, slot: "navigation-menu-trigger" });
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
