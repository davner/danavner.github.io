import { expect, test, type Page } from "@playwright/test";

import { catalogueFor } from "../src/lib/routes";

/**
 * What a page is on paper: the writing, on white stock in black ink, closed by
 * an imprint naming the page's catalogue number, the pressing, and its address
 * - and none of the screen's chrome, which is navigation paper cannot follow.
 *
 * The token overrides live in a `@media print` block that only beats the
 * `.dark` block by source order, so every case here prints from the dark
 * theme: that is the arrangement that goes wrong first if the print section
 * drifts up `src/index.css`.
 *
 * The elements asserted hidden are a starting set, not a completeness claim -
 * the print-preview pass owns the long tail.
 */

/** The stock, as the one-ink press resolves it. */
async function stock(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

const CASES = ["/shows/bruno-mars-madrid-2026", "/blog/welcome"];

for (const route of CASES) {
  test(`${route} prints as what it is`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(route);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.emulateMedia({ media: "print" });

    // The site header is the page's one banner: `PageHeader`'s element sits
    // inside `main`, which strips the role.
    await expect(page.getByRole("banner"), "the header bar reached paper").toBeHidden();
    await expect(page.locator("footer canvas"), "the pixel fire reached paper").toBeHidden();

    const imprint = page.locator("footer").getByText(`danavner.com${route}`);
    await expect(imprint, "no imprint carries this page's own address").toBeVisible();
    // The section's number stands for its items: a show borrows /shows',
    // a post /blog's.
    await expect(imprint, "the imprint misses the catalogue number").toContainText(
      catalogueFor(route)!,
    );

    expect(await stock(page), "the dark theme printed on its own stock").toBe("rgb(255, 255, 255)");
  });
}

test("a show's share control stays off paper", async ({ page }) => {
  await page.goto(CASES[0]);
  await page.getByRole("button", { name: "Share" }).waitFor();
  await page.emulateMedia({ media: "print" });

  await expect(page.getByRole("button", { name: "Share" })).toBeHidden();
});

test("a post's reading chrome stays off paper", async ({ page }) => {
  await page.goto(CASES[1]);
  // Waited for on screen first, so a hidden verdict means print hid it
  // rather than that it was never there. The More-posts nav gets the same
  // treatment in the source and no case here: it only renders beside a
  // second published post, and the site has one.
  const backLink = page.getByRole("link", { name: /All .* posts/ });
  await backLink.waitFor();
  await page.emulateMedia({ media: "print" });

  await expect(backLink).toBeHidden();
});

test("the light theme prints on the same stock", async ({ page }) => {
  // The group selector has to cover bare `:root` too, not just `.dark` -
  // a light-theme reader prints on the same press.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(CASES[1]);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.emulateMedia({ media: "print" });

  expect(await stock(page), "the light theme printed on newsprint").toBe("rgb(255, 255, 255)");
});
