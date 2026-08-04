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
      // A show with no photos used to fall back to the site portrait, so a
      // festival link previewed in Messages as a headshot.
      expect(ogImage, `${slug} previews as the portrait`).not.toContain("/img/me1.jpg");

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

    // The panel is always the first stop now. Handing the OS the card and the
    // link in one payload made Messages stack the poster, the lineup, and the
    // URL on top of each other.
    await page.getByRole("button", { name: /^Share/ }).click();

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });

    // A blank canvas would still produce a valid PNG, so check it has size.
    const size = await card.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth * (img as HTMLImageElement).naturalHeight,
    );
    expect(size).toBeGreaterThan(0);

    await expect(page.getByRole("link", { name: /Save the card/ })).toHaveAttribute(
      "download",
      "bruno-mars-madrid-2026.png",
    );
    // The URL is not printed in the panel - the buttons carry it. Nothing
    // should be showing it as text.
    await expect(page.getByText("danavner.com/shows/", { exact: false })).toHaveCount(0);
  });

  test("the card and the link are separate actions", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");

    // Stand in for a phone: a share sheet that takes files as well as links.
    await page.addInitScript(() => {
      const shared: unknown[] = [];
      (window as unknown as { __shared: unknown[] }).__shared = shared;
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: unknown) => void shared.push(data),
      });
      Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    });
    await page.reload();

    await page.getByRole("button", { name: /^Share/ }).click();
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Share the card/ }).click();
    // On a phone the panel is taller than the viewport and scrolls, so the
    // second action can sit below the fold.
    const sendLink = page.getByRole("button", { name: /Send the link/ });
    await sendLink.scrollIntoViewIfNeeded();
    await sendLink.click();

    const payloads = await page.evaluate(
      () => (window as unknown as { __shared: Record<string, unknown>[] }).__shared,
    );
    expect(payloads).toHaveLength(2);

    // The card goes out on its own, with no URL riding along.
    expect(payloads[0].files).toBeTruthy();
    expect(payloads[0].url).toBeUndefined();

    // The link goes out on its own, with no file and no pasted lineup.
    expect(payloads[1].url).toBe("https://danavner.com/shows/bruno-mars-madrid-2026");
    expect(payloads[1].files).toBeUndefined();
    expect(payloads[1].text).toBeUndefined();
  });

  test("escape closes the panel and hands focus back", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");
    const trigger = page.getByRole("button", { name: /^Share/ });
    await trigger.click();

    // Opening moves focus into the panel, which is also when Escape is armed.
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("picking a different cover redraws the card", async ({ page }) => {
    // Hashing the PNG rather than watching the object URL: a fresh URL is
    // handed out on every render whether or not the pixels changed, so it
    // would pass even if the chosen photo never reached the canvas.
    const cardHash = () =>
      page.evaluate(async () => {
        const img = document.querySelector<HTMLImageElement>("img[alt^='Share card']")!;
        const bytes = await (await fetch(img.src)).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      });

    await page.goto("/shows/warped-tour-long-beach-2026-day-2");
    await page.getByRole("button", { name: /^Share/ }).click();
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible({ timeout: 15_000 });

    const covers = page.getByRole("radio");
    // The picker only appears once the first card has rendered, so wait on it.
    await expect(covers.first()).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    expect(await covers.count()).toBeGreaterThan(1);

    const before = await cardHash();

    await covers.nth(2).click();
    await expect(covers.nth(2)).toHaveAttribute("aria-checked", "true");
    await expect.poll(cardHash, { timeout: 15_000 }).not.toBe(before);

    // The panel survives the redraw - it used to render only in the "ready"
    // state, so switching cover made it vanish mid-render.
    await expect(page.getByRole("radiogroup", { name: /Photo on the card/ })).toBeVisible();

    // And focus stays on the cover you pressed rather than being yanked back
    // to the panel, which is what re-running the open effect would do.
    await expect(covers.nth(2)).toBeFocused();
  });

  test("every logged show links to its own page", async ({ page }) => {
    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();

    for (const slug of SLUGS) {
      await expect(page.locator(`a[href="/shows/${slug}"]`).first()).toBeAttached();
    }
  });

  test("the repeat boards count what the files say", async ({ page }) => {
    // Derived from the markdown rather than hard-coded, so the numbers cannot
    // drift as entries are added.
    const read = (slug: string) => readFileSync(path.join(SHOWS_DIR, `${slug}.md`), "utf8");

    const bands = SLUGS.flatMap(
      (slug) =>
        /lineup:\n((?:\s+-\s.*\n)+)/
          .exec(read(slug))?.[1]
          .trim()
          .split("\n")
          .map((line) => line.replace(/^\s*-\s*/, "").trim()) ?? [],
    );
    const venues = SLUGS.map((slug) => /^venue:\s*(.+)$/m.exec(read(slug))?.[1].trim() ?? "").filter(
      Boolean,
    );

    /** Top five by count, repeats only, ties alphabetical - the board's rule. */
    const ranked = (values: string[]) => {
      const tally = new Map<string, number>();
      for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
      return [...tally]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5);
    };

    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();

    for (const [slot, expected, unit] of [
      ["seen-most", ranked(bands), "time"],
      ["been-most", ranked(venues), "night"],
    ] as const) {
      const rows = page.locator(`[data-slot=${slot}] li`);
      await expect(rows, `${slot} row count`).toHaveCount(expected.length);

      for (const [index, [name, count]] of expected.entries()) {
        // `readout-dim` uppercases the count, so compare case-insensitively.
        const text = (await rows.nth(index).innerText()).replace(/\s+/g, " ").toLowerCase();
        expect(text, `${slot} row ${index}`).toContain(name.toLowerCase());
        expect(text, `${slot} row ${index}`).toContain(
          `${count} ${unit}${count === 1 ? "" : "s"}`.toLowerCase(),
        );
      }
    }

    // The whole point is repeats; a board padded out with one-offs is the log
    // again in a different order.
    expect(ranked(venues).length, "no venue repeats to check").toBeGreaterThan(0);
  });

  test("an unknown show slug falls back to the log", async ({ page }) => {
    await page.goto("/shows/not-a-show");
    await page.waitForURL("**/shows");
  });
});
