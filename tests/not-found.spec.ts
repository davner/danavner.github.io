import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * The page nobody chooses to open, reached the ways a real visitor reaches it.
 *
 * There are two, and they are not the same thing. `/404` is an address the
 * build writes a file for, so it is in `ROUTES` and every sweep walks it. A
 * path matching no route has no file of its own, which is the whole point of
 * it, so it cannot be swept the same way and is walked here instead.
 *
 * What this suite cannot see: on GitHub Pages an unmatched path is answered by
 * `404.html` with a 404 status, and `vite preview` answers it from `index.html`
 * with a 200 - so neither the status nor the file is provable from here, and
 * nothing below asserts either. What is the same in both is everything that
 * follows: the same bundle boots, reads the same URL, matches nothing, and
 * renders the same page. That is what is asserted, and a router that stopped
 * doing it would ship the failure to Pages unchanged.
 */

const DIST = path.resolve("dist");

/** A path the router matches nothing for, which is how a mistyped link arrives. */
const NO_SUCH_PATH = "/no-such-page";

/** One spelling of the page's own words, so the cases cannot drift apart on it. */
const NOT_FOUND_HEADING = /nothing at these coordinates/i;

/**
 * The ways in that are meant to land on the page, less `/404` itself, which the
 * cases below take as the reference.
 *
 * `/blog/<unknown>` is here because the blog is the one section that answers a
 * dead item link with this page rather than with its own index - `show.tsx`,
 * `now.tsx` and `dan-fm-album.tsx` all redirect, and the case below holds them
 * to it.
 */
const OTHER_WAYS_IN = [NO_SUCH_PATH, "/blog/no-such-post"];

/** What a reader, a tab, and a link preview are told about the page. */
async function pageAs(page: Page, route: string) {
  await page.goto(route);
  await page.getByRole("heading", { level: 1 }).waitFor();

  return {
    heading: (await page.getByRole("heading", { level: 1 }).textContent())?.trim(),
    title: await page.title(),
    description: await page.locator('meta[name="description"]').getAttribute("content"),
    shared: await page.locator('meta[property="og:description"]').getAttribute("content"),
  };
}

test("a path the router matches nothing for still lands somewhere", async ({ page }) => {
  await page.goto(NO_SUCH_PATH);

  // The catch-all is the last route in `App`, and losing it renders an empty
  // `main` rather than an error: the reader gets the site's chrome around a
  // blank page and no way to tell that anything went wrong.
  await expect(
    page.getByRole("heading", { level: 1 }),
    `${NO_SUCH_PATH} renders no page at all`,
  ).toHaveText(NOT_FOUND_HEADING);
});

test("the page is described the same way whichever dead link found it", async ({ page }) => {
  /*
   * `/404` is the reference because it is the file Pages hands to every URL it
   * has no page for, so whatever it says is what most readers who get here are
   * told. The two guards below are what stop this comparing two pages that have
   * both lost their description to each other and passing.
   */
  const served = await pageAs(page, "/404");
  expect(served.heading, "/404 does not serve the not-found page").toMatch(NOT_FOUND_HEADING);
  expect(served.description, "the not-found page describes itself to nobody").toBeTruthy();

  for (const route of OTHER_WAYS_IN) {
    expect(
      await pageAs(page, route),
      `${route} lands on the not-found page but is not the page /404 serves`,
    ).toEqual(served);
  }
});

test("the way home from a dead link goes home", async ({ page }) => {
  // The one link the page's own body draws. Everything else on screen is the
  // header and the footer, so this is the whole of the way out that the page
  // is responsible for.
  await page.goto(NO_SUCH_PATH);
  const home = page.getByRole("link", { name: "Back home" });
  await home.waitFor();
  await home.click();

  await expect(page, "the way home off the not-found page goes somewhere else").toHaveURL("/");
});

/**
 * The sections that answer a dead item link with their own index instead.
 *
 * A dead album or show link is a dead link into a log, not a dead site, and
 * each of these three routes says so in its own source. Nothing else holds them
 * to it, and the way they break is by quietly starting to fall through to the
 * catch-all - which reads to the visitor as the whole address being wrong
 * rather than the one entry being gone.
 */
const REDIRECTING = [
  ["/shows/no-such-show", "/shows"],
  ["/dan-fm/no-such-album", "/dan-fm"],
  // A date in no archive, spelled as a date so the route's own parsing is what
  // rejects it rather than the shape of the string.
  ["/now/1999-01-01", "/now"],
];

for (const [dead, section] of REDIRECTING) {
  test(`${dead} lands on ${section} rather than the not-found page`, async ({ page }) => {
    await page.goto(dead);
    // The redirect happens during the first render, so the first heading to
    // appear is the one the route settled on. Waited for rather than asserted
    // against straight away: a negative assertion on a page that has not
    // rendered yet is a negative assertion about nothing.
    const title = page.getByRole("heading", { level: 1 });
    await title.waitFor();

    await expect(title, `${dead} reached the not-found page instead of its section`).not.toHaveText(
      NOT_FOUND_HEADING,
    );
    await expect(page, `${dead} did not fall back to its section`).toHaveURL(section);
  });
}

test("the file Pages answers an unknown URL from claims no canonical address", () => {
  /*
   * `404.html` stands in for every path the site has no page for, so a
   * canonical link on it would tell a crawler that every dead URL on the domain
   * is a copy of one particular page. It has none today only because the file
   * it is cut from has none - `vite-plugin-pages.ts` writes it as `index.html`
   * with the hero preload removed and no meta of its own - so a canonical added
   * to the home page arrives here too, and nothing else would report it.
   */
  const html = readFileSync(path.join(DIST, "404.html"), "utf8");

  expect(
    /<link[^>]+rel="canonical"/.test(html),
    "404.html names a canonical URL, so every dead link now points at it",
  ).toBe(false);
});
