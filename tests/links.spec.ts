import { expect, test } from "@playwright/test";

import { ANALYTICS_HOSTS } from "../src/lib/analytics";
import { danFmLinks } from "../src/lib/dan-fm-markdown";
import { albumsOnDisk } from "./dan-fm";
import { ROUTES } from "./routes";

/**
 * Internal links and assets are checked on every run: a typo in a route or a
 * photo path is a build-output bug, and it is cheap and deterministic to catch.
 *
 * External links are deliberately NOT checked here. They fail for reasons that
 * have nothing to do with this repo - rate limits, bot walls, a venue site
 * being down - and a red build nobody can fix is worse than no check at all.
 * `.github/workflows/links.yml` runs those weekly instead.
 */
test.describe("internal links", () => {
  test("every in-site link points at a real route", async ({ page, baseURL }) => {
    const seen = new Set<string>();

    for (const path of ROUTES) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href^='/']")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
      for (const href of hrefs) seen.add(href.split("#")[0]);
    }

    expect(seen.size).toBeGreaterThan(0);

    for (const href of seen) {
      const response = await page.request.get(new URL(href, baseURL).toString());
      // The SPA fallback serves index.html for unknown paths, so a 200 alone
      // proves nothing - the rendered page must not be the 404 route.
      expect(response.status(), `${href} did not respond`).toBe(200);

      await page.goto(href);
      await expect(
        page.getByRole("heading", { level: 1 }),
        `${href} renders the 404 page`,
      ).not.toContainText(/NOTHING AT THESE COORDINATES/i);
    }
  });

  test("every site-relative link written into an album holds", async ({ page, baseURL }) => {
    /*
     * The middle of the log: `ROUTES` walks the featured review on /dan-fm
     * and the oldest album's own page, but a review two weeks deep is on no
     * swept page, and its links rot as quietly as any. Request-level like the
     * sweep above - one GET per actual link rather than one page load per
     * album, which would grow with a daily log. `/dan-fm/` targets are also
     * proved against the payload at build time; this covers the rest
     * (/blog/..., /vinyl) and proves the build-time promise end to end.
     */
    const written = new Set<string>();
    for (const album of albumsOnDisk()) {
      for (const url of [...danFmLinks(album.review), ...danFmLinks(album.take)]) {
        if (url.startsWith("/")) written.add(url.split(/[?#]/)[0]);
      }
    }

    for (const href of written) {
      const response = await page.request.get(new URL(href, baseURL).toString());
      expect(response.status(), `${href} did not respond`).toBe(200);

      await page.goto(href);
      await expect(
        page.getByRole("heading", { level: 1 }),
        `${href} renders the 404 page`,
      ).not.toContainText(/NOTHING AT THESE COORDINATES/i);
    }
  });

  test("every image and asset loads", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (response) => {
      // GoatCounter is excluded on purpose. It is a third party the site does
      // not need in order to work - a content blocker, a sandboxed network, or
      // an outage takes it out and nothing on the page changes. Scoring it as a
      // broken asset makes this test fail on the network it happens to run on.
      if (ANALYTICS_HOSTS.includes(new URL(response.url()).host)) return;
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });

    for (const path of ROUTES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const broken = await page.locator("img").evaluateAll((images) =>
        images
          .filter((img) => {
            const el = img as HTMLImageElement;
            return el.complete && el.naturalWidth === 0;
          })
          .map((img) => (img as HTMLImageElement).currentSrc || img.getAttribute("src") || "?"),
      );
      expect(broken, `broken images on ${path}`).toEqual([]);
    }

    expect(failed).toEqual([]);
  });

  test("nothing phones home except GoatCounter", async ({ page, baseURL }) => {
    // Backs the README's claim: no font CDN, no third-party scripts, and the
    // only analytics is the cookie-free GoatCounter pageview beacon, which is
    // allowed to reach exactly these hosts and nothing else.
    const allowed = new Set(ANALYTICS_HOSTS);
    const external = new Set<string>();
    page.on("request", (request) => {
      const url = request.url();
      if (/^https?:\/\//.test(url) && !url.startsWith(baseURL!)) {
        const host = new URL(url).host;
        if (!allowed.has(host)) external.add(host);
      }
    });

    for (const path of ROUTES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }

    expect([...external]).toEqual([]);
  });
});
