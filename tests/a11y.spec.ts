import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

/**
 * axe cannot prove a page is accessible, but it reliably catches the things
 * that are easy to break without noticing: contrast, landmarks, names on
 * interactive elements, heading order. Both themes are checked because the
 * palettes are independent and contrast is the most fragile of those.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    for (const path of ROUTES) {
      test(`${path} has no axe violations`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).waitFor();
        // The starfield paints on a canvas; let it settle so nothing is mid-render.
        await page.waitForLoadState("networkidle");

        const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

        if (violations.length > 0) {
          await testInfo.attach("axe-violations", {
            body: JSON.stringify(violations, null, 2),
            contentType: "application/json",
          });
        }

        expect(
          violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`),
          `${path} in ${colorScheme} mode`,
        ).toEqual([]);
      });
    }
  });
}
