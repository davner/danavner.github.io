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

/** The cover, which is a page of the site and not one of the catalogue. */
const COVER = "/";

/**
 * Two pages of the catalogue and the cover, which prints unlike either of them:
 * it carries no catalogue number, and its display step is replaced rather than
 * recoloured. The size is its own case further down, because nothing in the
 * imprint check below can see it.
 *
 * The cover goes last, because the cases below index into this list.
 */
const CASES = ["/shows/bruno-mars-madrid-2026", "/blog/welcome", COVER];

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

    const catalogue = catalogueFor(route);
    if (catalogue) {
      // The section's number stands for its items: a show borrows /shows',
      // a post /blog's.
      await expect(imprint, "the imprint misses the catalogue number").toContainText(catalogue);
    } else {
      // The cover is not a page of the catalogue, so it prints the pressing
      // and the address and no number - and printing one would mean the home
      // page had quietly been filed as a section.
      await expect(imprint, "the cover printed a catalogue number").not.toContainText(/DA-\d+/);
    }

    expect(await stock(page), "the dark theme printed on its own stock").toBe("rgb(255, 255, 255)");
  });
}

/**
 * How much of a sheet a line of the name may take, in CSS pixels: A4 across at
 * the 96dpi a CSS inch is defined as, less 10mm of margin either side, which is
 * about the least a desktop printer will leave.
 */
const SHEET = ((210 - 2 * 10) / 25.4) * 96;

test("the name is set for the sheet rather than the window", async ({ page }) => {
  /*
   * The hero step is a `vw` clamp, and `vw` on paper resolves against the page
   * box - so the step has to be replaced outright in the print block rather
   * than recoloured with the rest of the tokens. Without that line the sheet
   * comes out of the printer with a name on it and nothing else.
   *
   * Print emulation swaps the media type and leaves the viewport alone, so a
   * step still reading `vw` here reads the window: the two readings below are
   * taken at different widths, and a size that moves between them is a size
   * still tracking something that will be the sheet on paper.
   */
  await page.goto(COVER);
  const name = page.getByRole("heading", { level: 1 });
  await name.waitFor();
  await page.evaluate(() => document.fonts.ready);

  /** The step, and the widest line the name sets at it. */
  const measure = () =>
    name.evaluate((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      line: Math.max(
        ...[...el.children].map((child) => {
          const range = document.createRange();
          range.selectNodeContents(child);
          return range.getBoundingClientRect().width;
        }),
      ),
    }));

  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);
  const wide = await measure();

  await page.setViewportSize({ width: 900, height: 900 });
  const narrow = await measure();

  expect(
    wide.line,
    `the name sets ${Math.round(wide.line)}px across, which is wider than the sheet`,
  ).toBeLessThanOrEqual(SHEET);
  expect(narrow.size, "the name on paper is still sized off the window").toBe(wide.size);
});

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
