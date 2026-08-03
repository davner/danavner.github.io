import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const SHOWS_DIR = path.resolve("src/content/shows");
const DIST = path.resolve("dist");

/** The slugs the content plugin will publish - the filenames, minus `_` notes. */
const SLUGS = readdirSync(SHOWS_DIR)
  .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
  .map((file) => file.replace(/\.md$/, ""));

/**
 * The site is client-rendered, so a link preview is built from the served HTML
 * and nothing the router does after it. These assertions are what stand between
 * a shared show and a generic site card in someone's messages.
 */
test.describe("link previews", () => {
  test("every show ships its own HTML with its own meta", () => {
    expect(SLUGS.length).toBeGreaterThan(0);
    const titles = new Set<string>();

    for (const slug of SLUGS) {
      const html = readFileSync(path.join(DIST, "shows", slug, "index.html"), "utf8");

      // index.html wraps some meta tags across lines, so match loosely on
      // whitespace rather than assuming a one-line tag.
      const meta = (name: string) =>
        new RegExp(`<meta\\s+(?:name|property)="${name}"[^>]*content="([^"]*)"`).exec(html)?.[1];

      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      const description = meta("description");
      const ogUrl = meta("og:url");
      const ogImage = meta("og:image");

      expect(title, `${slug} has no title`).toBeTruthy();
      expect(description, `${slug} has no description`).toBeTruthy();
      expect(ogUrl).toBe(`https://danavner.com/shows/${slug}`);
      // An image path that 404s previews as a blank card, which is worse than
      // no image at all.
      expect(ogImage).toMatch(/^https:\/\/danavner\.com\//);

      titles.add(title!);
    }

    // Distinct titles is the whole point; a copied template would pass every
    // assertion above and still preview identically for every show.
    expect(titles.size).toBe(SLUGS.length);
  });

  test("a show page still boots the app", async ({ page }) => {
    await page.goto(`/shows/${SLUGS[0]}`);
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  });
});

test.describe("share", () => {
  test("builds a card and offers the link", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // Headless Chromium has no `navigator.share`, so this exercises the
    // fallback panel - the path every desktop visitor gets.
    await page.getByRole("button", { name: /^Share/ }).click();

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });

    // A blank canvas would still produce a valid PNG, so check it has size.
    const size = await card.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth * (img as HTMLImageElement).naturalHeight,
    );
    expect(size).toBeGreaterThan(0);

    await expect(page.getByRole("link", { name: /Save image/ })).toHaveAttribute(
      "download",
      "bruno-mars-madrid-2026.png",
    );
    await expect(page.getByText("danavner.com/shows/bruno-mars-madrid-2026")).toBeVisible();
  });

  test("escape closes the panel and hands focus back", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");
    const trigger = page.getByRole("button", { name: /^Share/ });
    await trigger.click();

    // Opening moves focus into the panel, which is also when Escape is armed.
    await expect(page.getByRole("group", { name: /^Share / })).toBeFocused({ timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("every logged show links to its own page", async ({ page }) => {
    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();

    for (const slug of SLUGS) {
      await expect(page.locator(`a[href="/shows/${slug}"]`).first()).toBeAttached();
    }
  });

  test("an unknown show slug falls back to the log", async ({ page }) => {
    await page.goto("/shows/not-a-show");
    await page.waitForURL("**/shows");
  });
});
