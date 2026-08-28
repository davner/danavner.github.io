import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

/**
 * axe cannot prove a page is accessible, but it reliably catches the things
 * that are easy to break without noticing: contrast, landmarks, names on
 * interactive elements, heading order. Both themes are checked because the
 * palettes are independent and contrast is the most fragile of those.
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

/*
 * axe's third bucket. `incomplete` is a rule that ran and reached no verdict,
 * which reads exactly like a pass to anything that only looks at `violations`
 * - so a rule that quietly stops evaluating never shows up.
 *
 * `color-contrast` is the one rule that legitimately lands here, and only for
 * part of the page: the grain overlay in `backdrop.tsx` is a background image
 * axe cannot resolve, so nodes sitting over it come back undecided. It resolves
 * and passes roughly nine nodes in ten; the undecided slice is bounded, and it
 * is measured from painted pixels instead. Everything else is gated, which is
 * green today across every route in both themes.
 *
 * Use `withTags` to change what runs. `disableRules` is not the way to widen
 * this allowlist - how it composes with `withTags` has not been established
 * here, and `options()` is already known to discard the tag filter outright.
 */
const INDETERMINATE_BY_DESIGN = new Set(["color-contrast"]);

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    for (const path of ROUTES) {
      test(`${path} has no axe violations`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).waitFor();
        // The starfield paints on a canvas; let it settle so nothing is mid-render.
        await page.waitForLoadState("networkidle");

        const { violations, incomplete } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const unexplained = incomplete.filter((r) => !INDETERMINATE_BY_DESIGN.has(r.id));

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
          `${path} in ${colorScheme} mode`,
        ).toEqual([]);

        expect(
          unexplained.map((r) => `${r.id} (${r.nodes.length}): ${r.help}`),
          `${path} in ${colorScheme} mode reached no verdict`,
        ).toEqual([]);
      });
    }
  });
}
