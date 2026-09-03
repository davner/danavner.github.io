import { type Page, expect, test } from "@playwright/test";

import { readFileSync } from "node:fs";

import { OPEN_STATES, openState, reachOpenState } from "./open-states";
import { PHOTO_GAP, nowEntriesWithPhotos } from "./now-photos";
import { ROUTES } from "./routes";
import { ALL_SECTIONS } from "../src/lib/site";

/** Every section page, from the same list the header and footer render. */
const SECTION_PATHS = ALL_SECTIONS.map((section) => section.to);
const SECTION_LABELS = Object.fromEntries(
  ALL_SECTIONS.map((section) => [section.to, section.label]),
);

/**
 * Load a route and wait until it has stopped moving, then report the furthest
 * down the page it ever got.
 *
 * Both halves matter. A lazy route mounts in a later commit than the shell, so
 * a mount effect that scrolls runs after `goto` has resolved and after the
 * heading is on screen - ask either of those moments where the page is and the
 * answer is 0 because the bug has not happened yet. And the scroll can be
 * smooth, arriving over many frames, so a single reading taken part-way
 * through understates it. The worst offset seen is the honest number.
 */
async function loadAndSettle(page: Page, path: string): Promise<number> {
  await page.goto(path);
  await page.getByRole("heading", { level: 1 }).waitFor();

  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let worst = window.scrollY;
        const watch = () => {
          worst = Math.max(worst, window.scrollY);
        };
        window.addEventListener("scroll", watch, { passive: true });
        window.setTimeout(() => {
          window.removeEventListener("scroll", watch);
          resolve(Math.max(worst, window.scrollY));
        }, 300);
      }),
  );
}

test.describe("navigation", () => {
  test("home renders the hero in the display face", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });

    await expect(heading).toContainText(/dan/i);
    await expect(heading).toContainText(/avner/i);
    await expect(page).toHaveTitle("Dan Avner");

    // The poster look depends entirely on Anton actually arriving.
    await expect(heading).toHaveCSS("font-family", /Anton/);
    expect(await page.evaluate(() => document.fonts.check('400 100px "Anton"'))).toBe(true);
  });

  test("home links to every section it advertises", async ({ page }) => {
    /*
     * Driven by the shared list rather than a copy of it. This test carried its
     * own five paths and so had nothing to say when Now and Comics were added -
     * the omission on the home page was found by eye, which is what a hardcoded
     * list buys you.
     */
    await page.goto("/");
    const linked = await page
      .locator("main a[href^='/']")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")));

    for (const path of SECTION_PATHS) {
      expect(linked, `home does not link to ${path}`).toContain(path);
    }
  });

  test("each route sets its own title", async ({ page }) => {
    for (const path of SECTION_PATHS) {
      await page.goto(path);
      const label = SECTION_LABELS[path];
      await expect(page).toHaveTitle(`${label} · Dan Avner`);
    }
  });

  test("scroll resets between pages", async ({ page }) => {
    await page.goto("/career");
    await page.evaluate(() => window.scrollTo(0, 1500));
    // Below `sm` the sections sit behind the menu rather than in a row, so open
    // it first. Either way the only navigation landmark the a11y tree can see
    // is the one actually on screen.
    const menu = page.getByRole("button", { name: "Main menu" });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "About" })
      .click();
    await page.waitForURL("**/about");
    await page.getByRole("heading", { level: 1 }).waitFor();
    // A smooth scroll already in flight must not survive the route change.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every page opens at the top of itself", async ({ page }) => {
    /*
     * `ScrollToTop` resets the scroll on navigating, but it does that in its
     * own mount effect - so a lazy route mounting in a later commit can scroll
     * the document afterwards and nothing puts it back. A reader who followed a
     * link then arrives part-way down a page they have not read yet.
     *
     * Swept over every route rather than pinned to the one that broke: any
     * component that reaches for `scrollIntoView` can do this, and the next one
     * will be on some other page.
     */
    for (const path of ROUTES) {
      expect(await loadAndSettle(page, path), `${path} scrolled itself on load`).toBe(0);
    }
  });

  test("the phone drawer names itself and closes on navigating", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const menu = page.getByRole("button", { name: "Main menu" });
    await expect(menu).toBeVisible();
    await menu.click();

    /*
     * A drawer is a dialog, and a dialog with no accessible name is announced as
     * just "dialog". The title is visible here; the description is for screen
     * readers only. Neither is decoration - Radix warns without them.
     */
    const drawer = page.getByRole("dialog");
    await expect(drawer).toHaveAccessibleName(/menu/i);

    /*
     * The drawer's own close button. `everything clickable shows a finger` only
     * walks selectors on rendered pages, and this one lives in a portal that
     * does not exist until the drawer opens - so it shipped with the arrow
     * Tailwind's preflight gives every button.
     */
    await expect(drawer.getByRole("button", { name: /close/i })).toHaveCSS("cursor", "pointer");

    // Nothing in here paints a block behind the row you are pointing at; the
    // label changes colour instead, the way the bar above does.
    const link = drawer.getByRole("link", { name: "Blog" });
    await link.hover();
    await expect(link).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    // Every section is reachable from it, grouped ones included.
    for (const path of SECTION_PATHS) {
      await expect(drawer.locator(`a[href="${path}"]`)).toHaveCount(1);
    }

    await drawer.getByRole("link", { name: "Shows" }).click();
    await page.waitForURL("**/shows");
    // A drawer left open over the page you just moved to is a trap.
    await expect(drawer).toHaveCount(0);
  });

  test("unknown paths render the 404", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /NOTHING AT THESE COORDINATES/i,
    );
  });

  test("the sections' old paths still resolve", async ({ page }) => {
    for (const [from, to] of [
      ["/work", "**/career"],
      ["/writing", "**/blog"],
      ["/writing/welcome", "**/blog/welcome"],
      // The travel writing lives in the blog. Anything already linking to
      // /trips lands there rather than on a 404.
      ["/trips", "**/blog"],
      ["/trips/spain-2026", "**/blog"],
    ] as const) {
      await page.goto(from);
      await page.waitForURL(to);
    }
  });
});

test.describe("the header", () => {
  /* Both themes, because the palettes are independent and this is a contrast
     property. Separate tests so they run in parallel and name the one that
     broke. */
  for (const colorScheme of ["light", "dark"] as const) {
    test(`decides its own contrast in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      // The cover shelf is the brightest thing that ever scrolls under the bar,
      // and a translucent header takes whatever is behind it into the contrast
      // of its own labels - which makes the measurement a property of the page
      // rather than of the header.
      await page.goto("/vinyl");
      await page.getByRole("heading", { level: 1 }).waitFor();

      const surface = await page.evaluate(() => {
        const style = getComputedStyle(document.querySelector("header")!);

        // Painted over two opposite grounds. A translucent fill carries the
        // ground through, so the two reads disagree; an opaque one cannot.
        const over = (ground: string) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d", { willReadFrequently: true })!;
          context.fillStyle = ground;
          context.fillRect(0, 0, 1, 1);
          context.fillStyle = style.backgroundColor;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).join();
        };

        return {
          color: style.backgroundColor,
          backdropFilter: style.backdropFilter,
          opaque: over("#000000") === over("#ffffff"),
        };
      });

      expect(
        surface.opaque,
        `the header paints ${surface.color}, which the page shows through`,
      ).toBe(true);
      expect(
        surface.backdropFilter,
        "a backdrop filter puts the page back underneath the header's labels",
      ).toBe("none");
    });
  }

  test("the bar items fill the header's height", async ({ page }) => {
    // The bar is `hidden sm:flex`, so it exists at all only above 640.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);

    const bar = await page.evaluate(() => {
      const header = document.querySelector("header")!;
      const items = [
        ...header.querySelectorAll(
          "[data-slot=navigation-menu-link], [data-slot=navigation-menu-trigger]",
        ),
      ].filter((item) => (item as HTMLElement).offsetParent !== null);

      const label = (item: Element) =>
        `${item.getAttribute("data-slot")} "${(item.textContent ?? "").trim()}"`;

      return {
        // The content box: `border-b` is not part of the bar the items sit in.
        tall: header.clientHeight,
        triggers: items.filter((item) => item.getAttribute("data-slot")?.endsWith("trigger"))
          .length,
        links: items.filter((item) => item.getAttribute("data-slot")?.endsWith("link")).length,
        short: items
          .filter((item) => Math.abs(item.getBoundingClientRect().height - header.clientHeight) > 1)
          .map((item) => `${label(item)} is ${item.getBoundingClientRect().height}px`),
        // The rule marking the current section is the one absolutely positioned
        // child of a bar item, and it is meant to sit on the header's own edge.
        rules: items.flatMap((item) => {
          const rule = [...item.children].find(
            (child) => getComputedStyle(child).position === "absolute",
          );
          if (!rule) return [];
          const off = Math.abs(
            rule.getBoundingClientRect().bottom - header.getBoundingClientRect().bottom,
          );
          return off > 1 ? [`${label(item)}'s rule sits ${off.toFixed(1)}px off the edge`] : [];
        }),
      };
    });

    // Both kinds, named: the trigger is styled through a different base than
    // the plain links and was the half an earlier version of this missed.
    expect(bar.links, "the bar rendered no plain links to measure").toBeGreaterThan(0);
    expect(bar.triggers, "the bar rendered no group trigger to measure").toBeGreaterThan(0);
    expect(bar.short, `the bar is ${bar.tall}px and these do not fill it`).toEqual([]);
    expect(bar.rules).toEqual([]);
  });

  test("hovering one bar item lights only that one", async ({ page, isMobile }) => {
    // The mobile project emulates a touch device, where there is no hover to
    // measure - the bar is laid out at a desktop width here either way.
    test.skip(!!isMobile, "a touch context has no hover state");

    /*
     * `group-hover:` matches any ancestor carrying the class, and Radix's own
     * list carries a bare `group`. Spelled unnamed on a bar item it therefore
     * reached every label in the bar at once, so pointing at Blog lit Now,
     * About, Career and Hobbies with it and the bar stopped saying which one
     * the pointer was on.
     *
     * The comparison is against each label's own resting colour rather than
     * against a literal, so it holds when the palette moves.
     */
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await freezeTransitions(page);

    const labels = () =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "header [data-slot=navigation-menu-link], header [data-slot=navigation-menu-trigger]",
          ),
        ]
          .filter((item) => (item as HTMLElement).offsetParent !== null)
          .map((item) => {
            // The label is the first span in a bar item; the marker rule and
            // the trigger's chevron follow it.
            const label = item.querySelector("span")!;
            return { name: (label.textContent ?? "").trim(), color: getComputedStyle(label).color };
          }),
      );

    const resting = await labels();
    expect(resting.length, "the bar rendered nothing to hover").toBeGreaterThan(1);

    for (let index = 0; index < resting.length; index++) {
      const item = page
        .locator(
          "header [data-slot=navigation-menu-link], header [data-slot=navigation-menu-trigger]",
        )
        .nth(index);
      await item.hover();

      const lit = (await labels())
        .filter((label, at) => label.color !== resting[at].color)
        .map((label) => label.name);

      expect(lit, `hovering ${resting[index].name} changed these labels`).toEqual([
        resting[index].name,
      ]);
    }
  });
});

test.describe("theme", () => {
  test("toggles and survives a reload", async ({ page }) => {
    await page.goto("/");
    const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));

    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    expect(await isDark()).toBe(true);

    await page.getByRole("button", { name: /Switch to light mode/ }).click();
    expect(await isDark()).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");

    await page.reload();
    expect(await isDark()).toBe(false);
  });
});

test.describe("blog", () => {
  // Counted rather than hardcoded, so publishing a post does not fail the suite.
  test("filter narrows the list and syncs the URL", async ({ page }) => {
    await page.goto("/blog");
    const posts = page.locator("article");
    const total = await posts.count();

    /*
     * A filter needs a list it can narrow, and the published posts are not
     * guaranteed to give it one. The controls are drawn from the categories
     * the site defines rather than the ones the posts use, so the button being
     * there says nothing about whether pressing it leaves anything on screen.
     */
    test.skip(total < 2, "the blog publishes one post, so there is nothing to narrow");

    await page.getByRole("radio", { name: /^Work/i }).click();
    await page.waitForURL("**/blog?category=work");
    /*
     * The URL updates a tick before the list re-renders, and `count()` reads
     * once rather than retrying the way `expect(locator)` does - so reading it
     * straight after `waitForURL` is a race the test loses whenever the bundle
     * is slow enough. Poll until the list has actually narrowed, then measure.
     */
    await expect.poll(() => posts.count()).toBeLessThan(total);
    const work = await posts.count();
    test.skip(work === 0, "no published post is filed under work");
    await page.getByRole("radio", { name: /^Personal/i }).click();
    await page.waitForURL("**/blog?category=personal");
    await expect(posts).toHaveCount(total - work);
  });

  test("filter survives a reload", async ({ page }) => {
    await page.goto("/blog?category=personal");
    expect(await page.locator("article").count()).toBeGreaterThan(0);
    await expect(page.getByRole("radio", { name: /^Personal/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("the more-posts nav draws its seams per cell", async ({ page }) => {
    // Two columns, so the missing cell is a cell rather than a row that is
    // simply not there.
    await page.setViewportSize({ width: 900, height: 900 });

    // The newest post is the one with nothing newer to link to, which is the
    // case a grid painted in the seam colour fills with an empty grey block.
    await page.goto("/blog");
    await page.getByRole("heading", { level: 1 }).waitFor();
    const opened = page.locator('main article a[href^="/blog/"]');

    // One post has no neighbour, so there is no seam between cells to measure.
    test.skip((await opened.count()) < 2, "the blog publishes one post, which links to nothing");

    const newest = await opened.first().getAttribute("href");
    expect(newest, "the blog index lists no posts to open").not.toBeNull();

    await page.goto(newest!);
    await page.getByRole("heading", { level: 1 }).waitFor();

    const nav = page.locator('[aria-label="More posts"]');
    await expect(nav).toHaveCount(1);
    expect(
      await nav.evaluate((el) => el.children.length),
      "the newest post has something newer to link to, so this measured the wrong post",
    ).toBe(1);

    const seams = await nav.evaluate((el) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;

      /* Over magenta rather than black: `transparent` composites to whatever it
         is painted on, and a ground the palette contains would read as a match. */
      const rgb = (color: string) => {
        context.fillStyle = "#ff00ff";
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).join();
      };

      const seam = rgb(getComputedStyle(document.documentElement).getPropertyValue("--border"));
      return [el, ...el.querySelectorAll("*")]
        .filter((node) => rgb(getComputedStyle(node).backgroundColor) === seam)
        .map((node) => `<${node.tagName.toLowerCase()}>`);
    });

    expect(seams, "the nav paints the seam colour somewhere a cell is missing").toEqual([]);
  });
});

test.describe("shows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();
    // Years render as accordions and older ones start collapsed, which hides
    // their rows from innerText. Open them all so row assertions see every show.
    await page
      .locator("details")
      .evaluateAll((els) => els.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  });

  test("row count matches the logged stat", async ({ page }) => {
    const rows = await page.locator("[data-slot=show]").count();
    const logged = Number(await page.locator("dd").first().innerText());
    expect(rows).toBe(logged);
    expect(rows).toBeGreaterThan(0);
  });

  test("no stat renders a meaningless zero", async ({ page }) => {
    const values = await page.locator("dd").allInnerTexts();
    for (const value of values) expect(value.trim()).not.toBe("0");
    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThanOrEqual(4);
  });

  test("a headliner is never listed as its own opener", async ({ page }) => {
    const rows = page.locator("[data-slot=show]");
    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const heading = (await row.locator("h3").innerText()).trim();
      const support = row.locator('p:has-text("w/")');
      if ((await support.count()) === 0) continue;
      expect((await support.first().innerText()).toUpperCase()).not.toContain(heading);
    }
  });

  test("who you were with renders exactly one way per entry", async ({ page }) => {
    const rows = page.locator("[data-slot=show]");
    let recorded = 0;

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const solo = (await row.locator(".solo-badge").count()) > 0;
      const duo = (await row.locator(".duo-badge").count()) > 0;
      const names = (await row.getByText("Went with", { exact: false }).count()) > 0;

      // Solo, duo, and a plain list are three states, never two at once.
      expect([solo, duo, names].filter(Boolean).length).toBeLessThanOrEqual(1);
      if (solo || duo || names) recorded++;
    }

    expect(recorded).toBeGreaterThan(0);
  });

  test("the duo badge names the partner and reads as two players", async ({ page }) => {
    const duo = page.locator(".duo-badge");
    if ((await duo.count()) === 0) return;

    const text = await duo.first().innerText();
    expect(text).toMatch(/2P/);
    // The point of the badge is that it says who, not just that there were two.
    expect(text.replace(/MY DUO|2P|\W/gi, "").length).toBeGreaterThan(0);
  });

  test("empty subsections render nothing at all", async ({ page }) => {
    const rows = page.locator("[data-slot=show]");
    for (let i = 0; i < (await rows.count()); i++) {
      const empties = await rows.nth(i).evaluate((el) => {
        const found: string[] = [];
        for (const node of el.querySelectorAll("p, figure, a, div.prose-dan")) {
          const hasText = (node.textContent ?? "").trim().length > 0;
          const hasMedia = node.querySelector("img, svg") !== null;
          if (!hasText && !hasMedia) found.push(node.tagName);
        }
        return found;
      });
      expect(empties).toEqual([]);
    }
  });

  test("the log lists no photos, notes, or share controls", async ({ page }) => {
    // Those live on the show's own page. Here they would make each row a screen
    // tall and leave nothing to click through for.
    await expect(page.locator("[data-slot=show] figure")).toHaveCount(0);
    await expect(page.locator("[data-slot=show] .prose-dan")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Share/ })).toHaveCount(0);

    // One destination per row and nothing competing with it.
    const rows = page.locator("[data-slot=show]");
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i).locator("a, button")).toHaveCount(1);
    }
  });

  test("a capacity is printed where it can be compared", async ({ page }) => {
    // A room size only means something next to another room size, so it belongs
    // in the list and not only on the show's own page.
    const rows = page.locator("[data-slot=show]");
    const withCap = rows.filter({ hasText: /\d,\d{3} CAP/i });
    expect(await withCap.count()).toBeGreaterThan(0);

    // Thousands separators, or 70692 reads as a phone number.
    await expect(rows.filter({ hasText: "Riyadh Air" })).toContainText("70,692");
  });

  test("a row says what is behind the click", async ({ page }) => {
    // The Bilmuri night has photos, notes, and setlists, so its row should
    // advertise all three rather than just stopping.
    const row = page.locator("[data-slot=show]").filter({ hasText: "Bilmuri" });
    const summary = await row.innerText();
    expect(summary).toMatch(/5 PHOTOS/i);
    expect(summary).toMatch(/NOTES/i);
    expect(summary).toMatch(/SETLISTS/i);
  });

  test("setlist buttons link to setlist.fm and only name a band from the bill", async ({
    page,
  }) => {
    const hrefs: string[] = await page
      .locator('a[href^="/shows/"]')
      .evaluateAll((els) =>
        Array.from(
          new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? "")),
        ).filter(Boolean),
      );
    expect(hrefs.length).toBeGreaterThan(0);

    let seen = 0;
    for (const href of hrefs) {
      await page.goto(href);
      await page.getByRole("heading", { level: 1 }).waitFor();

      const buttons = page.getByRole("link", {
        name: /setlist on setlist\.fm$/i,
      });
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        await expect(button).toHaveAttribute("href", /^https:\/\/www\.setlist\.fm\//);
        // Opens off-site, so it has to open safely in its own tab.
        await expect(button).toHaveAttribute("target", "_blank");
        await expect(button).toHaveAttribute("rel", /noopener/);

        // The visible text is only the word "Setlist" - the band lives in the
        // accessible name, or a bill of six reads as six identical links.
        const label = (await button.getAttribute("aria-label")) ?? "";
        const band = label.replace(/setlist on setlist\.fm$/i, "").trim();
        expect(band.length).toBeGreaterThan(0);

        // The link sits on that band's own row, so the row has to be the band
        // it names.
        expect((await button.innerText()).toLowerCase()).toContain(band.toLowerCase());

        /*
         * And the URL has to be that band's too. A setlist.fm path carries the
         * band slug, which is the only thing on the page that knows the
         * pairing independently of the name we rendered next to it - without
         * this, looking a setlist up by position instead of by band would put
         * GANG!'s set on Bilmuri's row and read correctly in every other way.
         */
        const slug = band
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const href = (await button.getAttribute("href")) ?? "";
        expect(href).toContain(`/setlist/${slug}/`);
        seen++;
      }
    }

    // The feature is real content, not just a code path - exercise it for real.
    expect(seen).toBeGreaterThan(0);
  });

  test("a rating's fill width matches its accessible label", async ({ page }) => {
    const ratings = page.locator("[role=img][aria-label^='Rated']");
    for (let i = 0; i < (await ratings.count()); i++) {
      const label = (await ratings.nth(i).getAttribute("aria-label")) ?? "";
      const [, value, max] = /Rated ([\d.]+) out of (\d+)/.exec(label)!;
      const width = await ratings
        .nth(i)
        .locator("> span:nth-child(2)")
        .evaluate((n) => (n as HTMLElement).style.width);
      expect(Number.parseFloat(width)).toBeCloseTo((Number(value) / Number(max)) * 100, 1);
    }
  });

  test("a show page states its own date and room", async ({ page }) => {
    // These are stated nowhere else on the page. A show page is the target of
    // every share link, so if they stop rendering, someone arriving from a text
    // message gets a band name and no way to tell which night it was.
    const hrefs: string[] = await page
      .locator('a[href^="/shows/"]')
      .evaluateAll((els) =>
        Array.from(
          new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? "")),
        ).filter(Boolean),
      );
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      await page.goto(href);
      await page.getByRole("heading", { level: 1 }).waitFor();

      const facts = page.locator("[data-slot=facts]");
      await expect(facts).toHaveCount(1);

      const stated = await facts.innerText();
      // When it happened, and where. "July 26, 2026 · ... · Long Beach, CA".
      expect(stated).toMatch(/\b\d{4}\b/);
      expect(stated).toMatch(/,\s*\S/);
    }
  });

  test("the collection reference file is not parsed as an entry", async ({ page }) => {
    const titles = await page.locator("[data-slot=show] h3").allInnerTexts();
    expect(titles.some((title) => /SHOW LOG/i.test(title))).toBe(false);
  });

  /*
   * The photo counter prints its position twice: a zero-padded pair for the
   * eye, and a sentence for the live region. A screen reader reads the pair as
   * "oh one slash oh five", so the pair is `aria-hidden` and the sentence is
   * the whole of what gets announced.
   *
   * Read as an aria snapshot rather than as text, because `textContent` runs
   * both copies together and so matches whichever half survives - which is how
   * either one could be deleted with every test still green.
   */
  test.describe("the photo counter", () => {
    const REGION = "[data-slot=carousel] [aria-live]";

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/shows/bruno-mars-madrid-2026");
      await page.getByRole("heading", { level: 1 }).waitFor();
    });

    test("announces a sentence and never the padded pair", async ({ page }) => {
      const region = page.locator(REGION);
      await expect(region).toHaveCount(1);
      // Not `assertive`: a position is worth stating, never worth interrupting.
      await expect(region).toHaveAttribute("aria-live", "polite");

      const photos = await page.locator("[data-slot=carousel-item]").count();
      expect(photos, "the show has no photo strip to count").toBeGreaterThan(1);

      await expect
        .poll(() => region.ariaSnapshot(), {
          message: "the accessibility tree holds something other than the counter's sentence",
        })
        .toBe(`- paragraph: Photo 1 of ${photos}`);
    });

    test("announces the new position after the strip moves", async ({ page }) => {
      const region = page.locator(REGION);
      const photos = await page.locator("[data-slot=carousel-item]").count();
      expect(photos, "the show has no photo strip to advance").toBeGreaterThan(1);

      await page.getByRole("button", { name: "Next slide" }).click();

      // A sentence that never changes is read once and never again, which is
      // indistinguishable from a working counter until someone advances.
      await expect
        .poll(() => region.ariaSnapshot(), { message: "the strip moved and the region did not" })
        .toBe(`- paragraph: Photo 2 of ${photos}`);
    });
  });
});

test.describe("vinyl", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  test("tile count matches the records stat", async ({ page }) => {
    const tiles = await page.locator("[data-slot=record]").count();
    const counted = Number(await page.locator("[data-slot=stat] dd").first().innerText());
    expect(tiles).toBe(counted);
    expect(tiles).toBeGreaterThan(0);
  });

  test("no stat renders a meaningless zero", async ({ page }) => {
    // Same rule the show log follows: a stat with nothing to say is left out
    // rather than printed as a zero.
    const values = await page.locator("[data-slot=stat] dd").allInnerTexts();
    for (const value of values) expect(value.trim()).not.toBe("0");
    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThanOrEqual(4);
  });

  test("what the shelf is worth stays off the page", async ({ page }) => {
    /*
     * The nightly job still reads Discogs' valuation and it is still in the
     * payload, because taking it out of the fetch to take it off the page
     * would be a one-way door. The page is the part that is deliberate: a page
     * about records does not open with three dollar figures. This fails if a
     * future change wires the numbers back into the markup.
     */
    await expect(page.locator("[data-slot=valuation]")).toHaveCount(0);
    await expect(page.getByText(/what the whole shelf is worth/i)).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/\$[\d,]+\.\d{2}/);
  });

  test("the owner filter narrows the shelf and syncs the URL", async ({ page }) => {
    const tiles = page.locator("[data-slot=record]");
    const everything = await tiles.count();

    // The committed collection has two folders, so the control must be there.
    // Skipping when it is missing would hide the filter disappearing entirely.
    const filter = page.getByRole("radiogroup", { name: /whose they are/i });
    await expect(filter).toBeVisible();

    const options = filter.getByRole("radio");
    // Index 0 is "Everything"; the rest are the people.
    const owners = (await options.count()) - 1;
    expect(owners).toBeGreaterThan(0);

    let split = 0;
    for (let i = 1; i <= owners; i++) {
      const option = options.nth(i);
      // The number printed on the pill itself, e.g. "Alexis 9".
      const badge = Number(/(\d+)\s*$/.exec((await option.innerText()).trim())?.[1]);
      expect(badge).toBeGreaterThan(0);

      await option.click();
      await expect(option).toHaveAttribute("aria-checked", "true");
      expect(new URL(page.url()).searchParams.get("owner")).not.toBeNull();

      /*
       * Poll rather than read once: clicking sets the URL synchronously but the
       * grid redraws a tick later, so a bare `count()` here returns the
       * previous owner's shelf, which still adds up to a plausible-looking
       * number.
       *
       * Asserting against the pill's own count makes the filter prove it: a pill
       * whose figure disagrees with the grid is a failure rather than something
       * only a careful reader would spot.
       */
      await expect.poll(() => tiles.count()).toBe(badge);
      expect(badge).toBeLessThan(everything);
      split += badge;
    }

    // Every record belongs to exactly one person, so the parts have to add back
    // up to the whole. If they do not, a folder is being dropped or counted
    // twice and the stats above are quietly wrong.
    expect(split).toBe(everything);
  });

  test("a filtered shelf survives a reload", async ({ page }) => {
    const filter = page.getByRole("radiogroup", { name: /whose they are/i });
    await expect(filter).toBeVisible();

    const owner = filter.getByRole("radio").nth(1);
    const label = (await owner.innerText()).split("\n")[0]!.trim();
    await owner.click();

    const url = page.url();
    expect(url).toContain("owner=");

    await page.goto(url);
    await expect(page.getByRole("radio", { name: new RegExp(label, "i") })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("sorting reorders the shelf and syncs the URL", async ({ page }) => {
    const first = () => page.locator("[data-slot=record] h3").first().innerText();
    const byNewest = await first();

    // shadcn's Select is a listbox rather than a native `<select>`, so this is
    // a click on the trigger and a click on the option, the way a person does
    // it - `selectOption` only drives real `<select>` elements.
    const sort = page.getByRole("combobox", { name: /sort records/i });
    await sort.click();
    // The label from `SORT_LABEL` in src/lib/vinyl.ts, written out rather
    // than imported: that module pulls in the `virtual:` content plugin, which
    // Node cannot resolve when Playwright loads this file.
    await page.getByRole("option", { name: "By artist" }).click();
    await page.waitForURL("**/vinyl?sort=artist");
    const byArtist = await page.locator("[data-slot=record] p").first().innerText();

    // Sorted by artist, the shelf actually has to start at the top of the
    // alphabet rather than just claiming to.
    const artists = await page
      .locator("[data-slot=record] a > div > p:first-child")
      .allInnerTexts();
    const sorted = [...artists].sort((a, b) => a.localeCompare(b));
    expect(artists).toEqual(sorted);
    expect(byArtist.length).toBeGreaterThan(0);
    expect(await first()).not.toBe("");
    expect(byNewest.length).toBeGreaterThan(0);

    // A sorted shelf is linkable, so the control has to come back showing the
    // order the URL asked for rather than its own default.
    await page.goto("/vinyl?sort=artist");
    // The trigger shows the chosen option's label; there is no `value` to read
    // off a listbox the way there was on the native `<select>`.
    await expect(page.getByRole("combobox", { name: /sort records/i })).toHaveText("By artist");
  });

  test("search narrows the shelf without moving the stats", async ({ page }) => {
    const tiles = page.locator("[data-slot=record]");
    const everything = await tiles.count();
    const counted = await page.locator("[data-slot=stat] dd").first().innerText();

    const artist = (
      await page.locator("[data-slot=record] a > div > p:first-child").first().innerText()
    )
      .trim()
      .slice(0, 6);

    await page.getByRole("searchbox", { name: /search the collection/i }).fill(artist);
    await expect.poll(() => tiles.count()).toBeLessThanOrEqual(everything);
    expect(await tiles.count()).toBeGreaterThan(0);

    // Typing in the search box narrows what is listed. It must not restate what
    // the shelf is worth, or searching "misfits" would claim the whole
    // collection is worth one record.
    expect(await page.locator("[data-slot=stat] dd").first().innerText()).toBe(counted);
  });

  test("a search with no match says so", async ({ page }) => {
    await page
      .getByRole("searchbox", { name: /search the collection/i })
      .fill("zzzzz-not-a-record-zzzzz");
    await expect(page.locator("[data-slot=record]")).toHaveCount(0);
    await expect(page.getByText(/Nothing on the shelf matches/i)).toBeVisible();
  });

  test("every tile opens its Discogs page safely", async ({ page }) => {
    const links = page.locator("[data-slot=record] a");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute("href", /^https:\/\/www\.discogs\.com\/release\/\d+$/);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("only overflowing lines scroll, and only while pointed at", async ({ page }) => {
    const scrolling = () =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                (a as CSSAnimation).animationName === "scroll-on-hover",
            ).length,
      );

    /*
     * Nothing moves on its own. Fifty tiles of self-scrolling text would be
     * unreadable, and WCAG 2.2.2 wants a way to stop motion that starts by
     * itself and runs alongside other content - here that mechanism is the
     * pointer, which only works while nothing moves unprompted.
     */
    await expect.poll(scrolling).toBe(0);

    const lines = page.locator("[data-slot=record] .scroll-on-hover");
    expect(await lines.count()).toBeGreaterThan(0);

    // A line only claims to overflow if it was measured as overflowing.
    const measured = await lines.evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).dataset.overflow === "true")
        .map((el) => (el as HTMLElement).style.getPropertyValue("--scroll-shift")),
    );
    for (const shift of measured) expect(shift).toMatch(/^\d+(\.\d+)?px$/);

    // Hovering a tile that has one starts it, and leaving stops it again.
    const index = await page.evaluate(() =>
      [...document.querySelectorAll("[data-slot=record]")].findIndex((tile) =>
        tile.querySelector('.scroll-on-hover[data-overflow="true"]'),
      ),
    );
    if (index < 0) return; // No line is long enough today; nothing to prove.

    await page.locator("[data-slot=record]").nth(index).hover();
    await expect.poll(scrolling).toBeGreaterThan(0);

    await page.mouse.move(0, 0);
    await expect.poll(scrolling).toBe(0);
  });

  test("cover art is served from this site, not Discogs", async ({ page }) => {
    // The whole reason the collection is committed rather than fetched: leaning
    // on Discogs' CDN would put a third-party request on every page view and
    // break the guarantee in links.spec.ts.
    const sources = await page
      .locator("[data-slot=record] img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("src") ?? ""));

    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src).toMatch(/^\/img\/vinyl\//);
  });
});

test.describe("now", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/now");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  test("says when it was written and how stale that makes it", async ({ page }) => {
    /*
     * An empty now page is a real state, not just one the build passes through:
     * `src/content/now/` may hold no entries. So this asserts whichever of the
     * two is on screen rather than assuming an entry is there - what it will not
     * accept is a dated entry with no staleness, or a blank page with neither.
     */
    const stamp = page.locator("main time").first();

    if ((await stamp.count()) === 0) {
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/now/i);
      await expect(page.locator("main")).toContainText(/nothing here at the moment/i);
      return;
    }

    // The date is the whole point of a now page - without it the reader cannot
    // tell whether "at the moment" means this week or two years ago.
    await expect(stamp).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    // Scoped to `main`: the footer carries its own "last updated", which is the
    // site's last commit rather than this page's entry.
    await expect(page.locator("main").getByText(/last updated/i)).toContainText(
      /(today|yesterday|days ago|months? ago|years? ago|a month ago|a year ago)/i,
    );
  });

  /*
   * Staleness is counted against the reader's local calendar day, not UTC.
   * Counted against UTC, an entry written that morning reads "yesterday" from
   * 17:00 in Los Angeles, because UTC has already rolled over while the reader
   * is still on the day the entry is dated. That is several hours every evening
   * for every visitor in the Americas, so it is worth pinning a clock to.
   */
  test.describe("staleness counted in the reader's own days", () => {
    test.use({ timezoneId: "America/Los_Angeles" });

    test("an entry filed today still reads as today once UTC has moved on", async ({ page }) => {
      const stamp = page.locator("main time").first();
      // An empty now page carries no date, so there is no count to check.
      if ((await stamp.count()) === 0) return;

      // Read rather than hardcoded: the newest entry changes every time one is
      // filed, and a literal here would only fail on the next one.
      const updated = await stamp.getAttribute("datetime");
      expect(updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      /*
       * 03:00 UTC the day after the entry's date. Los Angeles is UTC-7 or
       * UTC-8 depending on the season, so that instant is the evening of the
       * entry's own local day on either side of a DST switch - while the UTC
       * date has already advanced. Doing the arithmetic in UTC keeps the
       * offset out of it.
       */
      const evening = new Date(Date.parse(`${updated}T03:00:00Z`) + 86_400_000);
      expect(evening.toISOString().slice(0, 10)).not.toBe(updated);

      await page.clock.setFixedTime(evening);
      await page.reload();
      await page.getByRole("heading", { level: 1 }).waitFor();

      await expect(page.locator("main").getByText(/last updated/i)).toContainText(/- today$/);
    });
  });

  test("the archive appears only once an entry has been filed", async ({ page }) => {
    /*
     * The timeline grows one entry at a time as new files land in the folder,
     * so this asserts the rule rather than a count: older entries present means
     * a timeline with a machine-readable date on each, none means no empty
     * heading sitting there promising something that is not below it.
     */
    const archived = page.locator("[data-slot=now-archived]");
    const count = await archived.count();
    const heading = page.getByRole("heading", { name: /before this/i });

    if (count === 0) {
      await expect(heading).toHaveCount(0);
      return;
    }

    await expect(heading).toBeVisible();

    const dates = await archived
      .locator("time")
      .evaluateAll((els) => els.map((el) => el.getAttribute("datetime") ?? ""));

    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Newest first, and never the same day twice - the build rejects two
    // entries sharing an `updated` date.
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  test("the rail reaches the oldest entry without scrolling through the rest", async ({ page }) => {
    /*
     * The reason the rail exists. A scroll pane on its own only gives sequential
     * access, so the oldest entry costs a trip through everything newer - and
     * that cost grows with every update. This asserts the shortcut works and
     * that taking it does not drag the page along with it.
     */
    const rail = page.getByRole("toolbar", { name: "Jump to a date" });
    const archived = page.locator("[data-slot=now-archived]");
    const filed = await archived.count();

    if (filed === 0) {
      await expect(rail).toHaveCount(0);
      return;
    }

    // One date offered per entry filed.
    await expect(rail.getByRole("button")).toHaveCount(filed);

    /*
     * The closest thing to a WCAG 2.5.3 check the suite can hold: every pill's
     * accessible name has to contain the text it prints, so a reader saying
     * "Aug 10" reaches the control they are looking at. axe ships
     * `label-content-name-mismatch` disabled, so nothing else covers it. It
     * fails against any hand-written `aria-label` that drifts from `railLabel`.
     */
    for (const pill of await rail.getByRole("button").all()) {
      // The printed text, with the screen-reader-only year taken back out -
      // that span is rendered, so `innerText` would count it as visible.
      const shown = await pill.evaluate((el) => {
        const copy = el.cloneNode(true) as HTMLElement;
        for (const hidden of copy.querySelectorAll(".sr-only")) hidden.remove();
        return (copy.textContent ?? "").trim();
      });

      await expect(
        rail.getByRole("button", { name: shown }),
        `no pill is named after the "${shown}" it prints`,
      ).toHaveCount(1);
    }

    // The pane is the second scroll region on the page; the rail is the first.
    const pane = page.locator("[data-slot=scroll-area-viewport]").nth(1);
    await rail.getByRole("button").last().click();

    const oldest = await archived.last().getAttribute("data-date");
    await expect(rail.locator("[aria-current=true]")).toHaveAttribute("data-rail-date", oldest!);

    // Nothing to travel to when only one entry is filed.
    if (filed === 1) return;

    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    /*
     * The outcome that matters: the oldest entry ends up inside the pane's
     * visible band. Asserting the page did not scroll instead would be measuring
     * Playwright, which scrolls a target into view before clicking it.
     */
    await expect
      .poll(async () => {
        const box = await archived.last().boundingBox();
        const view = await pane.boundingBox();
        if (!box || !view) return false;
        return box.y >= view.y - 2 && box.y < view.y + view.height;
      })
      .toBe(true);
  });

  test("the rail marks the topmost entry in view, not the last one to arrive", async ({ page }) => {
    /*
     * An `IntersectionObserver` callback carries only the targets whose state
     * changed. Scrolling down through a long entry, the entry below it crosses
     * into the pane's top band and files a record while the one above is still
     * in the band and files none - so a callback that reads only its own
     * records marks the arrival and leaves the entry the reader is actually
     * looking at unmarked.
     *
     * Swept in small steps rather than jumped to one offset. The window where
     * two entries share the band is only as wide as the gap between them, and a
     * single hardcoded scrollTop would drift out of it the moment an entry
     * changes length.
     */
    const archived = page.locator("[data-slot=now-archived]");
    /*
     * Reported rather than returned quietly, for the same reason the focus test
     * below spells out: with one entry filed nothing can lag behind anything,
     * and an early return would leave a green line over a test that never ran.
     * This arms itself the day a second entry is archived.
     */
    test.skip((await archived.count()) < 2, "one archived entry - nothing for the marker to lag");

    const lies = await page.evaluate(async () => {
      // The pane is the second scroll region on the page; the rail is the first.
      const pane = document.querySelectorAll<HTMLElement>("[data-slot=scroll-area-viewport]")[1];
      // Three frames: one for the observer to deliver, one for React to render
      // the new marker, one of margin.
      const settle = () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );

      /* The band the observer watches: `rootMargin: "0px 0px -70% 0px"` leaves
         the top 30% of the pane, and entries render newest-first, so the first
         one touching that band is the topmost. */
      const topmost = () => {
        const view = pane.getBoundingClientRect();
        const floor = view.top + view.height * 0.3;
        return (
          [...pane.querySelectorAll<HTMLElement>("[data-slot=now-archived]")].find((entry) => {
            const box = entry.getBoundingClientRect();
            return box.top < floor && box.bottom > view.top;
          })?.dataset.date ?? null
        );
      };

      const found: string[] = [];
      const step = Math.max(40, Math.round(pane.clientHeight * 0.1));
      pane.scrollTop = 0;

      for (;;) {
        await settle();
        const should = topmost();
        const marked = document.querySelector<HTMLElement>("[data-rail-date][aria-current=true]")
          ?.dataset.railDate;

        if (should && marked !== should) {
          found.push(`at ${Math.round(pane.scrollTop)}px the rail marks ${marked}, not ${should}`);
        }

        if (pane.scrollTop >= pane.scrollHeight - pane.clientHeight - 1) break;
        pane.scrollTop += step;
      }

      return found;
    });

    expect(lies, "the rail marked an entry that was not the topmost one in view").toEqual([]);
  });

  test("the collection reference file is not parsed as an entry", async ({ page }) => {
    /*
     * `src/content/now/_index.md` documents how the collection works; the
     * build skips files starting with `_`. If that filter ever broke, the
     * reference doc would surface here - as the current entry or somewhere in
     * the timeline - so this greps the whole page for a phrase only that file
     * contains. Holds at any entry count, including zero.
     */
    const text = await page.locator("main").evaluate((el) => el.textContent ?? "");
    expect(text).not.toMatch(/one markdown file per entry/i);
  });

  test("every photo on an entry is described", async ({ page }) => {
    /*
     * Skipped rather than written as "if there is a carousel", which would pass
     * over an empty set and report green for a path nothing entered. The skip
     * lifts on its own the day an entry gains photos.
     *
     * Every entry at its own address, not the `/now` this describe block opens
     * on. `NowTimeline` deliberately prints an archived entry's photos as a
     * count and never as a carousel, so an entry that gains photos while it is
     * archived lifts the skip above and leaves nothing at `/now` to assert
     * over - the green-over-an-empty-set failure the skip exists to prevent,
     * arriving by the back door. Narrowing the predicate to the current entry
     * would close that hole and open a worse one: photos taken on a current
     * entry stay on it once it is archived, so this would stop covering them
     * the week after it first ran. The permalink is where the carousel renders
     * for every entry - `/now/<current>` redirects to `/now`, which draws the
     * current entry's - so visiting each one covers the whole set at any age.
     */
    const withPhotos = nowEntriesWithPhotos();
    test.skip(withPhotos.length === 0, PHOTO_GAP);

    for (const date of withPhotos) {
      await page.goto(`/now/${date}`);
      const images = page.locator("[data-slot=carousel-item] img");
      // Awaited rather than counted straight away: the carousel is a lazy
      // chunk, so the entry's prose renders before any of this exists.
      await images.first().waitFor();

      const alts = await images.evaluateAll((found) =>
        found.map((img) => img.getAttribute("alt") ?? ""),
      );

      expect(alts.length, `no carousel images on /now/${date}`).toBeGreaterThan(0);
      for (const alt of alts) expect(alt.trim(), `undescribed photo on /now/${date}`).not.toBe("");
    }
  });

  test("an archived date opens that entry at its own address", async ({ page }) => {
    const archived = page.locator("[data-slot=now-archived]");
    if ((await archived.count()) === 0) return;

    const first = archived.first();
    const date = await first.getAttribute("data-date");
    // The prose is what proves the right entry rendered - a link that lands on
    // the permalink of some other entry would still pass a URL check.
    const opening = (await first.locator("p").last().innerText()).trim().slice(0, 40);

    await first.getByRole("link").first().click();
    await page.waitForURL(`**/now/${date}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/now/i);
    await expect(page.locator("main")).toContainText(opening);
  });

  test("the current entry's permalink lands on the front door", async ({ page }) => {
    /*
     * The date is read off the page rather than written down here. It is the
     * newest entry by definition, so a literal would break the day the next one
     * is filed - exactly the fragility the comment in `tests/routes.ts`
     * describes for the archived date it does have to hardcode.
     */
    const current = await page.locator("main time").first().getAttribute("datetime");
    expect(current).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.goto(`/now/${current}`);
    await page.waitForURL("**/now");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/right/i);
  });

  test("a date nothing was written on falls back to the front door", async ({ page }) => {
    await page.goto("/now/1999-01-01");
    await page.waitForURL("**/now");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/right/i);
  });

  test("keyboard focus in the archive carries the rail to where the pane is", async ({ page }) => {
    /*
     * A live interaction between two mechanisms written independently, so it is
     * asserted rather than assumed. Focusing a link inside the pane makes the
     * browser scroll it into view, which fires the pane's IntersectionObserver
     * and moves the rail's marker.
     *
     * Moves it to where the *pane* now is, which is the promise `NowTimeline`
     * makes and the only one it can keep. The observer marks whichever entry is
     * nearest the top of the pane, so with more entries filed than fit on a
     * screen, focusing the last one scrolls it to the bottom and the marker
     * lands on whatever arrived at the top instead. Asserting the marker
     * follows *focus* holds only in the degenerate case where the whole archive
     * fits the pane, and fails as soon as it does not - measured at four
     * archived entries, where focusing the oldest marks the third. What is
     * asserted instead is the property that holds at any length: the rail names
     * an entry the reader can see.
     *
     * That the marker and the focused link can name different entries is a real
     * confusion for a keyboard user, and it is a change to the component rather
     * than to this test - reported separately. Moving the rail off `aria-checked`
     * and onto `aria-current` renames that ambiguity honestly - the rail no
     * longer claims the reader chose this date - but it does not resolve it.
     */
    const archived = page.locator("[data-slot=now-archived]");
    /*
     * Reported rather than returned quietly. With one archived entry there is
     * nothing to follow focus between, and an early return leaves a green line
     * over a test that did not run - the same reasoning `tests/now-photos.ts`
     * spells out for the photo skips.
     */
    test.skip((await archived.count()) < 2, "one archived entry - nothing to follow focus between");

    const rail = page.getByRole("toolbar", { name: "Jump to a date" });
    // The pane is the second scroll region on the page; the rail is the first.
    const pane = page.locator("[data-slot=scroll-area-viewport]").nth(1);

    await archived.last().getByRole("link").first().focus();

    // The browser scrolled the pane to reach the link, which is what fires the
    // observer at all. Without this the assertion below would also pass over a
    // rail that never moved.
    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await expect
      .poll(
        async () => {
          const marked = await rail.locator("[aria-current=true]").getAttribute("data-rail-date");
          if (!marked) return false;

          const box = await page
            .locator(`[data-slot=now-archived][data-date="${marked}"]`)
            .boundingBox();
          const view = await pane.boundingBox();
          if (!box || !view) return false;

          return box.y < view.y + view.height && box.y + box.height > view.y;
        },
        { message: "the rail marks a date whose entry is nowhere in the pane" },
      )
      .toBe(true);
  });

  test("a date focused at the archive's edge keeps the whole of its focus ring", async ({
    page,
  }) => {
    /*
     * What `scroll-py-2` on the pane's viewport is for, and the only thing that
     * says it is doing anything. Chrome scrolls a newly focused element into
     * view only when its border box is not already fully inside the scrollport,
     * and a focus ring bleeding past that box does not count - so a link that
     * comes to rest flush against an edge keeps its position and loses the
     * stroke on that side. `scroll-padding` is what moves the edge the browser
     * measures against.
     *
     * The position is set rather than hunted for. The bug needs a link that is
     * fully visible and hard against the edge, and tabbing and arrowing until
     * one happens to land there would be a different test on every machine.
     * Everything after that is a real keyboard move, because `:focus-visible`
     * is what paints the ring and Chrome only matches it when the last thing
     * the user did was press a key.
     *
     * Measured against the ring the link actually declares rather than a number
     * written down here, so restyling the ring cannot leave this passing over a
     * clipped one. It is a floor either way: Chrome paints an `auto` outline a
     * little wider than its computed width.
     */
    const dates = page.locator("[data-slot=now-archived] > p > a");
    const count = await dates.count();
    test.skip(count < 2, "one archived entry - nothing can sit against the pane's edge");

    const pane = page
      .locator("[data-slot=scroll-area-viewport]")
      .filter({ has: page.locator("[data-slot=now-archived]") });
    test.skip(
      !(await pane.evaluate((el) => el.scrollHeight > el.clientHeight + 1)),
      "the whole archive fits in the pane - nothing can sit against its edge",
    );

    // Not the last one: placing a link against the bottom edge needs room left
    // to scroll past it, and the last entry has none.
    const target = dates.nth(count - 2);
    await target.focus();
    // Away and back, so the return trip is a keypress and the ring is painted.
    await page.keyboard.press("Shift+Tab");

    const flush = await target.evaluate((link) => {
      const port = link.closest("[data-slot=scroll-area-viewport]") as HTMLElement;
      port.scrollTop += link.getBoundingClientRect().bottom - port.getBoundingClientRect().bottom;
      return port.getBoundingClientRect().bottom - link.getBoundingClientRect().bottom;
    });
    expect(Math.abs(flush), "could not place a date against the pane's edge").toBeLessThan(1);

    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();

    const measured = await target.evaluate((link) => {
      const port = link.closest("[data-slot=scroll-area-viewport]") as HTMLElement;
      const ring = getComputedStyle(link);
      const scrollport = getComputedStyle(port);
      return {
        clearance: port.getBoundingClientRect().bottom - link.getBoundingClientRect().bottom,
        reach: parseFloat(ring.outlineOffset) + parseFloat(ring.outlineWidth),
        top: parseFloat(scrollport.scrollPaddingTop),
        bottom: parseFloat(scrollport.scrollPaddingBottom),
      };
    });

    expect(measured.reach, "the focused date draws no ring to clear").toBeGreaterThan(0);
    expect(
      measured.clearance,
      "the focus ring is clipped by the pane's edge",
    ).toBeGreaterThanOrEqual(measured.reach);
    // The top edge clips the same way and cannot be driven into the same
    // position from inside the pane, so it is held by what the pane reserves.
    expect(measured.top, "the pane reserves nothing at its top edge").toBeGreaterThanOrEqual(
      measured.reach,
    );
    expect(measured.bottom).toBeGreaterThanOrEqual(measured.reach);
  });

  test("the archive prints a photo count and never a carousel", async ({ page }) => {
    /*
     * Holds at any entry count, with photos or without, which is why it is not
     * skipped: it is the assertion that keeps the pane from quietly growing a
     * carousel per archived entry. The pane is a fixed height and mounts every
     * entry at once, so that would be one embla instance per entry inside a
     * scrolling container, and taller than the pane on a phone.
     */
    const archived = page.locator("[data-slot=now-archived]");
    if ((await archived.count()) === 0) return;

    await expect(archived.locator("[data-slot=carousel]")).toHaveCount(0);

    // The count, when there is one, is a sibling of the date rather than inside
    // it - `datetime="2026-08-10"` must not end up describing "August 10, 2026
    // - 3 photos".
    const stamps = await archived
      .locator("time")
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
    for (const stamp of stamps) expect(stamp).not.toMatch(/photos?/i);
  });
});

test.describe("comics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/comics");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  test("the shelf filter swaps the list and syncs the URL", async ({ page }) => {
    const tiles = page.locator("[data-slot=comic]");
    const filter = page.getByRole("radiogroup", { name: /which comics/i });
    await expect(filter).toBeVisible();

    // The collection is the default, and it is the bare URL rather than
    // `?shelf=series` - one address per view.
    expect(new URL(page.url()).searchParams.has("shelf")).toBe(false);
    const collection = await tiles.count();
    expect(collection).toBeGreaterThan(0);

    await filter.getByRole("radio", { name: /^Wants/i }).click();
    await page.waitForURL("**/comics?shelf=wants");

    /*
     * The list re-renders a tick after the URL changes, and `count()` reads
     * once rather than retrying - the same race that made the blog filter test
     * flaky. Wait for the count to settle before trusting it.
     */
    await expect.poll(() => tiles.count()).not.toBe(collection);
    expect(await tiles.count()).toBeGreaterThan(0);
  });

  test("every shelf the filter offers can actually be shown", async ({ page }) => {
    const filter = page.getByRole("radiogroup", { name: /which comics/i });
    const options = filter.getByRole("radio");
    const count = await options.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      await options.nth(i).click();
      // The click and the shelf swap are separate renders, so wait for the
      // radio to report checked before reading the page - counting tiles
      // straight after the click reads whichever shelf was still on screen.
      await expect(options.nth(i)).toBeChecked();
      // Either tiles or an explicit empty state - never a blank page. A pull
      // list is genuinely empty most of the week, so both are correct.
      await expect(
        page
          .locator("[data-slot=comic]")
          .first()
          .or(page.getByText(/Nothing (pulled|on this list)/i)),
      ).toBeVisible();
    }
  });

  test("the per-run issue counts add up to the issues-held stat", async ({ page }) => {
    // The stat is summed from the payload and the tiles print it per run, so
    // the two disagreeing means one of them is reading the wrong field.
    const counts = await page.locator("[data-slot=comic]").evaluateAll((tiles) =>
      tiles.map((tile) => {
        const line = [...tile.querySelectorAll("p")].find((p) =>
          /^\d+\s+issues?$/i.test(p.textContent?.trim() ?? ""),
        );
        return Number(line?.textContent?.trim().split(/\s+/)[0] ?? 0);
      }),
    );

    const total = counts.reduce((sum, n) => sum + n, 0);
    expect(total).toBeGreaterThan(0);

    const stat = Number(
      await page
        .getByRole("term")
        .filter({ hasText: /^Issues held$/i })
        .locator("+ dd")
        .innerText(),
    );
    expect(total).toBe(stat);
  });

  test("cover art is served from this site, not League of Comic Geeks", async ({ page }) => {
    // Same reason the records are committed: leaning on their CDN would put a
    // third-party request on every page view and break links.spec.ts.
    const sources = await page
      .locator("[data-slot=comic] img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("src") ?? ""));

    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src).toMatch(/^\/img\/comics\//);
  });

  test("every tile opens its League of Comic Geeks page safely", async ({ page }) => {
    const links = page.locator("[data-slot=comic] a");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute("href", /^https:\/\/leagueofcomicgeeks\.com\//);
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });
});

test.describe("controls", () => {
  // Every filter control on the site comes from `components/filter-toggle.tsx`
  // and is measured there once, so two rows of pills cannot end up a
  // quarter-step out of line. Height is the thing you actually see, so that is
  // the thing asserted.
  for (const path of ["/vinyl", "/blog"]) {
    test(`${path} filter controls share one height`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      const heights = await page.evaluate(() => {
        const nodes = [
          ...document.querySelectorAll("[data-slot=toggle-group-item]"),
          ...document.querySelectorAll("input[type=search]"),
          // The sort control is shadcn's Select, so the thing on screen is its
          // trigger button rather than a native `<select>`.
          ...document.querySelectorAll("[data-slot=select-trigger]"),
        ];
        return nodes.map((n) => Math.round(n.getBoundingClientRect().height));
      });

      expect(heights.length).toBeGreaterThan(1);
      expect([...new Set(heights)]).toHaveLength(1);
    });
  }

  for (const path of ["/vinyl", "/blog"]) {
    test(`${path} filter labels keep their padding`, async ({ page }) => {
      /*
       * shadcn puts `flex-1` on every ToggleGroupItem, which forces one width
       * across the row whatever the labels say. Combined with `min-w-0` and
       * `whitespace-nowrap`, the longest label spills through its own padding
       * and sits against the pill's edge, while a short one looks twice as
       * roomy.
       */
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      const spilling = await page.evaluate(() => {
        const bad: string[] = [];
        document.querySelectorAll("[data-slot=toggle-group-item]").forEach((el) => {
          const style = getComputedStyle(el as HTMLElement);
          const inner =
            el.getBoundingClientRect().width -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight);
          const range = document.createRange();
          range.selectNodeContents(el);
          if (range.getBoundingClientRect().width > inner + 0.5) {
            bad.push((el.textContent ?? "?").trim());
          }
        });
        return bad;
      });

      expect(spilling).toEqual([]);
    });
  }

  test("everything clickable shows a finger, not an arrow", async ({ page }) => {
    /*
     * Tailwind v4's preflight sets `button { cursor: default }` and shadcn does
     * not put it back, so anything clickable defaults to the wrong cursor until
     * someone remembers `cursor-pointer`.
     *
     * A check scoped to a hand-written list of pages does not catch the thing it
     * exists to catch: a page that is not on the list ships a grid of buttons
     * with an arrow cursor and the check stays green. So this sweeps every route
     * and every interactive element instead.
     */
    for (const path of ROUTES) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();

      const wrong = await page
        .locator("button, select, summary, [role=button]")
        .evaluateAll((els) =>
          els
            // A disabled control is not clickable, so `default` is right there.
            .filter(
              (el) =>
                !el.hasAttribute("disabled") &&
                el.getAttribute("aria-disabled") !== "true" &&
                // Only what is actually on screen: the mobile menu holds a copy
                // of the nav that is display:none until it opens.
                (el as HTMLElement).offsetParent !== null,
            )
            .filter((el) => getComputedStyle(el).cursor !== "pointer")
            .map(
              (el) =>
                `<${el.tagName.toLowerCase()}> ${(el.textContent ?? "").trim().slice(0, 40)}` +
                ` [cursor: ${getComputedStyle(el).cursor}]`,
            ),
        );

      expect(wrong, `${path} has clickable elements without a pointer`).toEqual([]);
    }
  });
});

/**
 * Measures the focus indicator painted on `document.activeElement`.
 *
 * Handed to `page.evaluate`, which serialises it and runs it in the page, so it
 * closes over nothing in this file and carries its own helpers.
 *
 * Two things it deliberately does not do. It computes over resolved token
 * colours rather than painted pixels, so it cannot see the grain overlay -
 * measured against real pixels the same ring reads about 0.2 lower, so anything
 * landing within ~0.3 of 3.0 needs a manual check against a screenshot. And it
 * credits any painted outline, ring or border on the focused element, without
 * proving that candidate appeared *because* of the focus - so an element with a
 * permanent 3:1 border and a broken focus ring passes.
 *
 * That second one is not hypothetical. The landing page's "Get to know me" is
 * exactly that element: `border-ember` over `bg-ember` scores 5.91:1 against the
 * page behind it whether or not the control has any focus indicator, so this
 * sweep cannot tell those two apart. Closing it properly means proving a
 * candidate is focus-conditional - by reading each element's resting style, or
 * by looking for a matching rule whose selector carries `:focus` - and that is a
 * change to this file that has not been made.
 *
 * What it does catch is a `border-ring` with no width: a zero-width border is
 * not a candidate at all.
 *
 * `opacity` is folded in, because it composites an element's whole rendering -
 * its outline along with it - over what is behind it, so the colour the computed
 * style names is not the colour that reaches the screen. Without it a control
 * dimmed to half strength scores as though its ring were at full strength; with
 * it, the same ring reads 2.15:1 in dark and 2.63:1 in light, which is 1.4.11
 * failed by a margin the ~0.2 above would never account for.
 *
 * It is folded as one multiplication down the chain against an already-flattened
 * backdrop: exact for a single translucent element over an opaque page, and
 * drifting where two of them stack, because real nested groups composite their
 * contents before the outer opacity applies. `filter`, `mix-blend-mode` and
 * `backdrop-filter` are not read at all.
 */
const measureFocusIndicator = async () => {
  // Two frames, so nothing is read mid-transition.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;

  const style = getComputedStyle(el);

  /* Canvas is the only reliable way to turn `oklch(...)`,
   `oklab(... / .5)` and `color-mix(...)` into sRGB and to composite
   alpha over a backdrop. An unparseable colour leaves `fillStyle`
   alone, so it reads as the backdrop and scores 1:1 - loudly wrong
   rather than quietly passing.

   `alpha` is the compositing `opacity` applies on top of whatever the
   colour carries itself, which is what `globalAlpha` multiplies. */
  const paint = (color: string, over: string, alpha = 1) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = over;
    ctx.fillRect(0, 0, 1, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };

  const luminance = (rgb: number[]) =>
    rgb
      .map((channel) => channel / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

  /* The adjacent colour 1.4.11 measures against, composited from the
     root down rather than taken from the first ancestor that declares
     one. Plenty of them are translucent: the select trigger's
     `dark:bg-input/30` reads as a light grey over white and a near
     black over the page it is actually on. */
  const flatten = (color: string, over: string, alpha = 1) => {
    const [r, g, b] = paint(color, over, alpha);
    return `rgb(${r}, ${g}, ${b})`;
  };

  /* A computed `opacity` is a plain number, but a browser handing back
     anything else must not turn every measurement below into NaN. */
  const opacityOf = (declared: string) => {
    const value = parseFloat(declared);
    return Number.isFinite(value) ? value : 1;
  };

  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) chain.push(node);
  chain.reverse();

  /* Multiplied down the chain, because an ancestor's `opacity` dims the
     focused element as surely as its own does - and it dims that ancestor's
     background at the same time, so the backdrop is built with it too. */
  let opacity = 1;
  let outside = "rgb(255, 255, 255)";
  for (const node of chain.slice(0, -1)) {
    const ancestor = getComputedStyle(node);
    opacity *= opacityOf(ancestor.opacity);
    outside = flatten(ancestor.backgroundColor, outside, opacity);
  }
  opacity *= opacityOf(style.opacity);
  const inside = flatten(style.backgroundColor, outside, opacity);

  const ratio = (color: string, behind: string) => {
    const front = luminance(paint(color, behind, opacity));
    const back = luminance(paint(behind, behind));
    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
  };

  const candidates: { what: string; contrast: number }[] = [];

  if (style.outlineStyle === "auto") {
    /*
     * Chrome's own focus ring. It paints the author's `outline-color` *and* a
     * contrasting companion stroke the computed style does not expose, so the
     * author colour is not the whole indicator and measuring it against what
     * surrounds the element would fail elements that are fine.
     *
     * What the companion stroke cannot rescue is a ring drawn in the colour of
     * the fill it hugs. `auto` puts the stroke hard against the element's edge,
     * so `--ring` on a `bg-ember` control paints ember on ember and reads as
     * the control having grown by a pixel - which is how a primary call to
     * action ends up with no keyboard indicator at all while this sweep scores
     * it `Infinity` and passes.
     *
     * So the browser's ring is credited only where the author's colour is
     * distinguishable from the element's own background. Where it is not, the
     * sweep reports that measurement instead, and fails on it.
     */
    const onItsOwnFill = ratio(style.outlineColor, inside);
    candidates.push({
      what: `the browser's own focus ring, ${style.outlineColor} on ${inside}`,
      contrast: onItsOwnFill >= 3 ? Infinity : onItsOwnFill,
    });
  } else if (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) {
    // A negative offset paints the outline inside the box, over the
    // element's own background rather than over what surrounds it.
    const behind = parseFloat(style.outlineOffset) < 0 ? inside : outside;
    candidates.push({
      what: `outline ${style.outlineWidth} ${style.outlineColor}`,
      contrast: ratio(style.outlineColor, behind),
    });
  }

  // Rings are box-shadows. Split on top-level commas only - `rgba(0, 0,
  // 0, 0)` has commas of its own - and keep the ones with real spread.
  const shadows: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of style.boxShadow === "none" ? "" : style.boxShadow) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      shadows.push(current);
      current = "";
    } else current += character;
  }
  if (current.trim()) shadows.push(current);

  for (const shadow of shadows) {
    const at = shadow.search(/(^|\s)-?[\d.]+px/);
    if (at < 0) continue;
    const lengths = (shadow.slice(at).match(/-?[\d.]+px/g) ?? []).map(parseFloat);
    const spread = lengths.length >= 4 ? lengths[3] : 0;
    const color = shadow.slice(0, at).trim();
    if (spread > 0 && color) {
      const behind = shadow.includes("inset") ? inside : outside;
      candidates.push({
        what: `ring ${spread}px ${color}`,
        contrast: ratio(color, behind),
      });
    }
  }

  // Width first. `focus-visible:border-ring` sets a colour on a border
  // Tailwind's preflight gave a width of 0, which paints nothing at all.
  if (parseFloat(style.borderTopWidth) > 0) {
    // A border runs along an edge with the element's own background on
    // one side and the page on the other. Contrast against either side
    // makes it visible, so take the better of the two.
    candidates.push({
      what: `border ${style.borderTopWidth} ${style.borderTopColor}`,
      contrast: Math.max(ratio(style.borderTopColor, inside), ratio(style.borderTopColor, outside)),
    });
  }

  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
  const slot = el.getAttribute("data-slot");

  return {
    // Identity, for spotting the wrap back to the first stop.
    key: `${el.tagName}|${el.className}|${text}`,
    label: `${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ""} "${text}"`,
    // 1.4.11 is satisfied if *an* indicator clears 3:1.
    best: Math.max(0, ...candidates.map((candidate) => candidate.contrast)),
    candidates,
    // Already folded into every contrast above. Reported so a failure caused by
    // a dimmed control does not read as a badly chosen colour.
    opacity,
    transitionDuration: style.transitionDuration,
  };
};

type FocusIndicator = NonNullable<Awaited<ReturnType<typeof measureFocusIndicator>>>;

/** The one-line failure a measurement under 3:1 turns into. */
function describeFailure(result: FocusIndicator) {
  const detail = result.candidates
    .map((candidate) => `${candidate.what} at ${candidate.contrast.toFixed(2)}:1`)
    .join("; ");
  const dimmed =
    result.opacity < 1 ? `, painted at ${Math.round(result.opacity * 100)}% opacity` : "";
  return `${result.label} - ${detail || "no indicator at all"}${dimmed}`;
}

/**
 * Stop every transition on the page, for the length of one measurement.
 *
 * The site's `prefers-reduced-motion` block stops what moves and deliberately
 * lets colour and opacity keep transitioning, so the preference alone no longer
 * settles a style read two frames after focus lands. `ui/button.tsx` carries
 * `transition-all` and `transition-colors` animates `outline-color`, which
 * starts at `currentColor` - so an unsettled reading measures the text colour
 * and reports a control with a perfectly good ring as having none.
 *
 * Injected after each `goto`, because a navigation drops the tag with the
 * document.
 */
const freezeTransitions = (page: Page) =>
  page.addStyleTag({
    content:
      "*,*::before,*::after{transition-duration:0s !important;animation-duration:0s !important}",
  });

test.describe("focus indicators", () => {
  /* What proves `freezeTransitions` is still in place. Without it every
     measurement below is taken mid-transition and means nothing. */
  const expectSettled = (transitionDuration: string) =>
    expect(
      parseFloat(transitionDuration),
      "transitions are no longer frozen, so these readings are mid-transition",
    ).toBeLessThanOrEqual(0.001);

  test("the end of the photo strip keeps the keyboard", async ({ page }) => {
    /*
     * `disabled` on the arrow that has just been pressed takes the button out
     * of the tab order under the reader's hands, and focus falls to `<body>` -
     * from where the whole document has to be tabbed through again. The end
     * state is announced instead, and this is what says focus stayed put.
     */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/shows/bilmuri-los-angeles-2026");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await freezeTransitions(page);

    const counter = page.locator("[data-slot=carousel] [aria-live=polite]");
    const slides = await page.locator("[data-slot=carousel-item]").count();
    expect(slides, "the show has no photo strip to advance").toBeGreaterThan(1);

    const next = page.getByRole("button", { name: "Next slide" });
    await next.focus();
    for (let slide = 2; slide <= slides; slide++) {
      await page.keyboard.press("Enter");
      await expect(counter).toHaveText(new RegExp(`^${String(slide).padStart(2, "0")}\\b`));
    }

    // The press that lands on the end state, which is where focus is at risk.
    await page.keyboard.press("Enter");
    await expect(next).toHaveAttribute("aria-disabled", "true");
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute("data-slot") ?? null),
      "the arrow dropped focus when it reached the end",
    ).toBe("carousel-next");

    const result = await page.evaluate(measureFocusIndicator);
    expect(result, "nothing is focused").not.toBeNull();
    expectSettled(result!.transitionDuration);
    expect(result!.best, describeFailure(result!)).toBeGreaterThanOrEqual(3);
  });

  test("an arrow at the end of the strip dims its icon and not its ring", async ({ page }) => {
    /*
     * `ui/carousel.tsx` puts the end-state dimming on the icon rather than on
     * the button, because `opacity` composites everything an element paints and
     * a ring at half strength is one an arrow deliberately left focusable
     * cannot fall back on 1.4.11's exception for.
     *
     * Both halves are here because either alone is satisfiable by a wrong
     * implementation: dimming the whole button still dims the icon, and
     * deleting the dimming outright still leaves the ring perfect.
     */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await freezeTransitions(page);

    const counter = page.locator("[data-slot=carousel] [aria-live=polite]");
    const slides = await page.locator("[data-slot=carousel-item]").count();
    expect(slides, "the show has no photo strip with two ends").toBeGreaterThan(1);

    /* One arrow as it is painted right now, plus the indicator it shows while
       focused. The alpha is multiplied down from the root rather than read off
       each element, because an `opacity` on any ancestor of the icon reaches
       the button's ring on the way past. */
    const readOne = async (slot: string) => {
      const button = page.locator(`[data-slot=${slot}]`);
      await button.focus();

      const indicator = await page.evaluate(measureFocusIndicator);
      expect(indicator, `${slot} would not take focus`).not.toBeNull();

      const paint = await button.evaluate((el) => {
        const alphaTo = (from: Element) => {
          let alpha = 1;
          for (let node: Element | null = from; node; node = node.parentElement) {
            const declared = parseFloat(getComputedStyle(node).opacity);
            alpha *= Number.isFinite(declared) ? declared : 1;
          }
          return alpha;
        };
        const icon = el.querySelector("svg");
        return {
          ended: el.getAttribute("aria-disabled") === "true",
          control: alphaTo(el),
          icon: icon ? alphaTo(icon) : null,
        };
      });

      expect(paint.icon, `${slot} has no icon to dim`).not.toBeNull();
      return { slot, ...paint, indicator: indicator! };
    };

    const readArrows = async () => ({
      "carousel-previous": await readOne("carousel-previous"),
      "carousel-next": await readOne("carousel-next"),
    });

    const first = await readArrows();
    expectSettled(first["carousel-previous"].indicator.transitionDuration);
    expect(first["carousel-previous"].ended, "the strip did not open on its first slide").toBe(
      true,
    );
    expect(first["carousel-next"].ended, "the strip has nowhere to advance to").toBe(false);

    const next = page.getByRole("button", { name: "Next slide" });
    await next.focus();
    for (let slide = 2; slide <= slides; slide++) {
      await page.keyboard.press("Enter");
      await expect(counter).toHaveText(new RegExp(`^${String(slide).padStart(2, "0")}\\b`));
    }

    const last = await readArrows();
    expect(last["carousel-next"].ended, "the last slide left the next arrow live").toBe(true);
    expect(
      last["carousel-previous"].ended,
      "the last slide left the previous arrow at an end",
    ).toBe(false);

    // Each arrow against itself in the other state, so the comparison is one
    // element on one page and needs no constant to lean on.
    for (const [ended, live] of [
      [first["carousel-previous"], last["carousel-previous"]],
      [last["carousel-next"], first["carousel-next"]],
    ]) {
      expect(
        ended.icon,
        `${ended.slot} at the end of the strip is painted exactly like a live one`,
      ).toBeLessThan(live.icon!);

      expect(
        ended.control,
        `${ended.slot} dims the whole control, so its focus ring goes with it`,
      ).toBe(1);

      /* The consequence, measured rather than inferred. The guard is what
         stops it passing on two arrows that both show nothing. */
      expect(live.indicator.best, describeFailure(live.indicator)).toBeGreaterThanOrEqual(3);
      expect(
        ended.indicator.best,
        `${ended.slot}'s focus indicator weakened at the end of the strip: ${describeFailure(ended.indicator)}`,
      ).toBeGreaterThanOrEqual(live.indicator.best);
    }
  });

  test("the cover picker keeps the whole of a thumbnail's ring", async ({ page }) => {
    /*
     * The strip scrolls, and a scroll container clips at its padding box. The
     * first thumbnail sits hard against the start of the strip, so unless the
     * strip reserves the room there is nothing on its left or its top for an
     * outward ring to land in - `overflow-x` pulls the block axis to `auto`
     * with it, which is why the top edge clips as well as the side.
     *
     * The room is the assertion rather than the padding: what has to be true is
     * that the ring the thumbnail actually declares fits, so restyling the ring
     * cannot leave this passing over a clipped one.
     *
     * An inward stroke is the other answer to a clipping container, and it is
     * the wrong one here: the thumbnail is a photograph, so nothing about what
     * the stroke would sit on can be guaranteed.
     */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await reachOpenState(page, openState("the share popover open"));
    await freezeTransitions(page);

    const thumbs = page.locator("[data-slot=toggle-group-item]");
    const count = await thumbs.count();
    expect(count, "this show offers no cover to pick").toBeGreaterThan(1);

    const first = thumbs.first();
    await first.focus();
    // Away and back, so the return trip is a keypress and the ring is painted.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();

    const measured = await first.evaluate((thumb) => {
      const strip = thumb.parentElement!;
      const scrollport = getComputedStyle(strip);
      const style = getComputedStyle(thumb);
      const box = thumb.getBoundingClientRect();
      const port = strip.getBoundingClientRect();
      const edge = (side: "Top" | "Left" | "Bottom") =>
        parseFloat(scrollport[`border${side}Width` as "borderTopWidth"]);

      return {
        reach: parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth),
        clips: scrollport.overflowX !== "visible" || scrollport.overflowY !== "visible",
        top: box.top - (port.top + edge("Top")),
        left: box.left - (port.left + edge("Left")),
        bottom: port.bottom - edge("Bottom") - box.bottom,
      };
    });

    expect(measured.clips, "the strip no longer clips, so this measures nothing").toBe(true);
    expect(measured.reach, "the focused thumbnail draws no ring to clear").toBeGreaterThan(0);
    for (const side of ["top", "left", "bottom"] as const) {
      expect(
        measured[side],
        `the strip clips the ${side} of the first thumbnail's focus ring`,
      ).toBeGreaterThanOrEqual(measured.reach);
    }
  });

  /*
   * The other answer, for the case the cover picker cannot use. An option fills
   * the listbox's width and the panel scrolls, so an outward ring is clipped -
   * but what an option's ring sits on is `--accent`, a neutral, so a stroke
   * just inside its own edge is safe to measure and safe to see.
   *
   * The listbox is opened from the keyboard end to end, for the reason the menu
   * sweep gives: `:focus-visible` is what paints the ring, and a mouse-opened
   * panel is entitled to paint nothing.
   *
   * This is the only measurement of an option's indicator anywhere: the route
   * sweep reaches what Tab reaches from a page load, and a listbox that has to
   * be opened first is not in it. Both themes for the same reason the sweeps
   * below give - the palettes are independent.
   */
  for (const colorScheme of ["light", "dark"] as const) {
    test(`a sort option paints its ring where nothing can clip it in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await page.goto("/vinyl");
      await page.getByRole("heading", { level: 1 }).waitFor();
      await freezeTransitions(page);

      await page.getByRole("combobox", { name: /sort records/i }).press("Enter");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("ArrowDown");

      const option = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const style = getComputedStyle(el);
        return {
          slot: el.getAttribute("data-slot"),
          visible: el.matches(":focus-visible"),
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          // At or below zero the whole stroke is inside the option's own border
          // box, which is the only place the panel cannot reach it.
          reach: parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth),
        };
      });

      expect(option?.slot, "arrowing down the listbox focused something else").toBe("select-item");
      expect(
        option!.visible,
        "the option does not match :focus-visible, so it paints no ring",
      ).toBe(true);
      expect(option!.style, "the option suppresses the site's outline").not.toBe("none");
      expect(option!.width, "the option's ring has no width").toBeGreaterThan(0);
      expect(
        option!.reach,
        "the option's ring reaches outside the panel that clips it",
      ).toBeLessThanOrEqual(0);

      const indicator = await page.evaluate(measureFocusIndicator);
      expect(indicator, "nothing is focused").not.toBeNull();
      expectSettled(indicator!.transitionDuration);
      expect(indicator!.best, describeFailure(indicator!)).toBeGreaterThanOrEqual(3);
    });
  }

  /* Both themes, for the reason `tests/a11y.spec.ts` gives: the palettes are
     independent and contrast is the most fragile thing in them. Separate tests
     rather than one loop, so they run in parallel and name the theme that
     broke. */
  for (const colorScheme of ["light", "dark"] as const) {
    test(`every focus indicator clears 3:1 against what is behind it in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });

      /*
       * WCAG 1.4.11 wants 3:1 between a focus indicator and its adjacent colour.
       * Nothing else on this site guards that: axe has no focus-indicator rule at
       * all, so this measurement is the whole of the coverage.
       *
       * Swept across every route rather than pinned to one selector, for the
       * reason `CLAUDE.md` gives for the cursor sweep: a check scoped to one page
       * passes happily while another page ships the defect.
       *
       * It reaches only what Tab reaches from a fresh page load, so anything
       * behind a closed disclosure is invisible to it. The menu sweep below
       * covers the navigation menus; nothing covers the phone Sheet or the
       * Select listbox yet.
       */
      let guarded = false;

      for (const path of ROUTES) {
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.waitForLoadState("networkidle");
        await freezeTransitions(page);

        const seen = new Set<string>();
        const bad: string[] = [];

        for (let stop = 0; stop < 250; stop++) {
          await page.keyboard.press("Tab");

          const result = await page.evaluate(measureFocusIndicator);

          // Focus left the document, or wrapped back to a stop already measured.
          if (result === null || seen.has(result.key)) break;
          seen.add(result.key);

          if (!guarded) {
            expectSettled(result.transitionDuration);
            guarded = true;
          }

          if (result.best < 3) bad.push(describeFailure(result));
        }

        expect(bad, `${path} has focus indicators under 3:1 in ${colorScheme} mode`).toEqual([]);
      }
    });

    test(`a navigation menu's own links clear 3:1 in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });

      /*
       * A separate test rather than a branch inside the sweep above, because
       * opening things mid-sweep means deciding which of 250 blind tab stops is
       * safe to press Enter on. Here the trigger is known, so the drive is
       * three keystrokes and the panel's contents are the whole subject.
       *
       * It exists because the sweep cannot see a closed disclosure, and
       * `ui/navigation-menu.tsx` shipped a rule that zeroed both the ring and
       * the outline on every link in the Hobbies panel - written against
       * `:focus`, which out-specifies the link's own `:focus-visible`
       * indicator, so it took the ring away from keyboard users specifically.
       * The sweep reported green throughout.
       *
       * Driven by keyboard end to end: `locator.press` focuses and then sends a
       * real keydown, which is what makes the links match `:focus-visible` when
       * Tab arrives. A mouse-opened menu is entitled to paint nothing.
       *
       * Below `sm` the bar collapses into the phone Sheet and these triggers
       * are `display: none`, so on the mobile project this measures nothing.
       * That is not coverage of the phone menu, which has none.
       */
      let guarded = false;

      for (const path of ROUTES) {
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.waitForLoadState("networkidle");
        await freezeTransitions(page);

        const triggers = page.locator("[data-slot=navigation-menu-trigger]:visible");
        const bad: string[] = [];

        for (let index = 0; index < (await triggers.count()); index++) {
          const trigger = triggers.nth(index);
          const label = (await trigger.textContent())?.trim() || `menu ${index + 1}`;

          await trigger.press("Enter");
          const panel = page.locator("[data-slot=navigation-menu-content]");
          await panel.waitFor();

          const links = await panel.locator("[data-slot=navigation-menu-link]").count();
          expect(links, `${path}: the ${label} menu opened with nothing in it`).toBeGreaterThan(0);

          for (let stop = 0; stop < links; stop++) {
            await page.keyboard.press("Tab");

            // Every link in an open panel is an ordinary tab stop, so falling
            // out of it early means the panel closed under the test and the
            // measurements after this point would be of the page behind it.
            const inPanel = await panel.evaluate((node) => node.contains(document.activeElement));
            expect(inPanel, `${path}: focus left the ${label} menu at stop ${stop + 1}`).toBe(true);

            const result = await page.evaluate(measureFocusIndicator);
            if (result === null) continue;

            if (!guarded) {
              expectSettled(result.transitionDuration);
              guarded = true;
            }

            if (result.best < 3) bad.push(`${label}: ${describeFailure(result)}`);
          }

          await page.keyboard.press("Escape");
        }

        expect(bad, `${path} has menu links under 3:1 in ${colorScheme} mode`).toEqual([]);
      }
    });
  }
});

/**
 * Every surface a panel or a page can put on screen.
 *
 * The overlays live in portals outside `main`, and the navigation panel is in
 * neither - so each root is named rather than the sweep starting at `body`,
 * which would take in the fixed backdrop layers as well.
 */
const SURFACES =
  "main, [role=dialog], [data-slot=select-content], [data-slot=navigation-menu-content]";

/**
 * Elements separating themselves with a shadow rather than a hairline.
 *
 * Blur is what is measured, not the presence of a `box-shadow`: a spread-only
 * `0 0 0 1px` takes no layout space and is how a grid cell draws its own seam
 * on this site, so those have to pass.
 *
 * Handed to `page.evaluate`, which serialises it and runs it in the page, so it
 * closes over nothing in this file.
 */
const blurredShadows = (surfaces: string) => {
  const found: string[] = [];
  const seen = new Set<Element>();

  for (const root of document.querySelectorAll(surfaces)) {
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (seen.has(el)) continue;
      seen.add(el);

      const shadow = getComputedStyle(el).boxShadow;
      if (shadow === "none") continue;

      // Split on top-level commas only - `rgba(0, 0, 0, 0.1)` has commas of
      // its own - then read the third length, which is the blur radius.
      const layers: string[] = [];
      let depth = 0;
      let current = "";
      for (const character of shadow) {
        if (character === "(") depth += 1;
        if (character === ")") depth -= 1;
        if (character === "," && depth === 0) {
          layers.push(current);
          current = "";
        } else current += character;
      }
      if (current.trim()) layers.push(current);

      for (const layer of layers) {
        const lengths = (layer.match(/-?[\d.]+px/g) ?? []).map(parseFloat);
        if ((lengths[2] ?? 0) > 0) {
          const slot = el.getAttribute("data-slot");
          found.push(`<${el.tagName.toLowerCase()}>${slot ? `[${slot}]` : ""} ${layer.trim()}`);
        }
      }
    }
  }
  return found;
};

/**
 * Corners rounded past what the radius tokens allow.
 *
 * `--radius` is the cap and every named step resolves to it or below, so a
 * corner above it can only come from a hand-written value or a utility that
 * derives from nothing, a full round being the one that matters. Read from the
 * whole page rather than from the named surfaces: a scrollbar thumb is inside
 * none of them, and a thumb is exactly what a component library rounds off.
 *
 * Handed to `page.evaluate`, so it closes over nothing in this file.
 */
const overRounded = (cap: number) => {
  const corners = [
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
  ] as const;
  const found: string[] = [];

  for (const el of document.querySelectorAll("*")) {
    const style = getComputedStyle(el);
    for (const corner of corners) {
      // A percentage or a keyword parses as NaN, and neither is a radius this
      // site declares - so an unreadable one is reported rather than skipped.
      const radius = parseFloat(style[corner]);
      if (Number.isFinite(radius) && radius <= cap + 0.01) continue;
      const slot = el.getAttribute("data-slot");
      found.push(`<${el.tagName.toLowerCase()}>${slot ? `[${slot}]` : ""} ${style[corner]}`);
    }
  }
  return [...new Set(found)];
};

test.describe("surfaces", () => {
  /** `--radius`, in pixels. Every named step resolves to this or below. */
  const RADIUS = 4;

  test("nothing on a route rounds a corner past the radius", async ({ page }) => {
    for (const path of ROUTES) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      // The archive's scrollbar only exists where the pane overflows, which is
      // a width the desktop project never reaches.
      await page.waitForLoadState("networkidle");

      expect(await page.evaluate(overRounded, RADIUS), path).toEqual([]);
    }
  });

  test("nothing a panel opens rounds a corner past the radius", async ({ page }) => {
    for (const state of OPEN_STATES) {
      await reachOpenState(page, state);

      expect(await page.evaluate(overRounded, RADIUS), `${state.path} with ${state.name}`).toEqual(
        [],
      );
    }
  });

  test("nothing on a route separates itself with a shadow", async ({ page }) => {
    for (const path of ROUTES) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();

      expect(await page.evaluate(blurredShadows, SURFACES), path).toEqual([]);
    }
  });

  test("nothing a panel opens separates itself with a shadow", async ({ page }) => {
    // The raised surfaces are exactly the ones a route load never renders, so
    // a sweep over `ROUTES` alone sees none of them.
    for (const state of OPEN_STATES) {
      await reachOpenState(page, state);

      expect(
        await page.evaluate(blurredShadows, SURFACES),
        `${state.path} with ${state.name}`,
      ).toEqual([]);
    }
  });
});

/**
 * Elements set in the readout style that do not compute the readout style.
 *
 * The utility is one rule in `index.css`, and the way it comes apart is a
 * utility on the call site out-ranking it: a badge, a button variant or a
 * dialog title arrives with a weight of its own and quietly wins. That is
 * invisible to every other check here - the words are still there, still mono,
 * still uppercase - and it is what happened when the last hand-rolled copy of
 * the five declarations was deleted and a dialog title's own `font-semibold`
 * stopped losing to it.
 *
 * The utility itself is the reference, read off a probe, so this cannot drift
 * away from the rule it is checking. Four declarations rather than five:
 * font-size is deliberately not one of them, because two call sites set the
 * `sm` step on purpose and `responsive.spec.ts` already holds every rendered
 * size to the scale. Tracking is checked as a ratio for the same reason - the
 * utility declares it in `em`, so it follows whichever of the two sizes the
 * element is set at.
 *
 * Handed to `page.evaluate`, so it closes over nothing in this file.
 */
const readoutFaults = (selector: string) => {
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;visibility:hidden";
  const probe = document.createElement("span");
  probe.className = "readout";
  holder.append(probe);
  document.body.append(holder);

  const model = getComputedStyle(probe);
  const want = {
    family: model.fontFamily,
    weight: model.fontWeight,
    transform: model.textTransform,
    tracking: parseFloat(model.letterSpacing) / parseFloat(model.fontSize),
  };
  holder.remove();

  const faults: string[] = [];
  for (const el of document.querySelectorAll(selector)) {
    const style = getComputedStyle(el);
    const name = `<${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().slice(0, 24)}"`;
    const got = {
      family: style.fontFamily,
      weight: style.fontWeight,
      transform: style.textTransform,
      tracking: parseFloat(style.letterSpacing) / parseFloat(style.fontSize),
    };

    for (const key of ["family", "weight", "transform"] as const) {
      if (got[key] !== want[key]) faults.push(`${name} ${key} is ${got[key]}, not ${want[key]}`);
    }
    if (!(Math.abs(got.tracking - want.tracking) < 0.001)) {
      faults.push(`${name} tracking is ${got.tracking}em, not ${want.tracking}em`);
    }
  }
  return [...new Set(faults)];
};

/** Everything the readout style reaches: the two utilities, and the badge. */
const READOUTS = ".readout, .readout-dim, [data-slot=badge]";

test.describe("the readout", () => {
  test("every readout on a route computes the readout style", async ({ page }) => {
    for (const path of ROUTES) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      expect(await page.evaluate(readoutFaults, READOUTS), path).toEqual([]);
    }
  });

  test("every readout a panel opens computes the readout style", async ({ page }) => {
    // A dialog title is exactly where a component's own weight beats the
    // utility, and no route load puts one on screen.
    for (const state of OPEN_STATES) {
      await reachOpenState(page, state);
      await page.evaluate(() => document.fonts.ready);

      expect(
        await page.evaluate(readoutFaults, READOUTS),
        `${state.path} with ${state.name}`,
      ).toEqual([]);
    }
  });
});

test.describe("chrome", () => {
  test("the skip link is the first stop for a keyboard", async ({ page }) => {
    /*
     * Every route, not just the front page. The skip link is only worth having
     * if it is the first thing a keyboard reaches, and what moves it is not the
     * markup - it is anything that scrolls an element into view on mount, which
     * also moves the sequential focus navigation starting point to wherever it
     * scrolled. That leaves the skip link, the home link, the whole nav and the
     * theme toggle behind the reader's first Tab, on that page only.
     */
    for (const path of ROUTES) {
      // `loadAndSettle` rather than `goto`: tabbing before React has hydrated
      // moves focus in the pre-render, where the skip link is not there to
      // receive it - and tabbing before a mount effect has run asks the
      // question before anything could have moved the answer.
      await loadAndSettle(page, path);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus"), `${path} does not start at the skip link`).toContainText(
        "Skip to content",
      );
    }
  });

  test("an inline link that is not coloured is underlined instead", async ({ page }) => {
    /*
     * WCAG 1.4.1: colour cannot be the only thing marking a link, and neither
     * can hover. A link inside a readout line inherits the paragraph's colour
     * by design - keeping a dim line dim - so with the underline held back
     * until the pointer arrives, a keyboard or touch reader meets it as plain
     * text and never learns it is a control.
     *
     * Scoped to anchors directly inside a `<p>` that also holds text of its
     * own, which is what "a link in a block of text" means - the surrounding
     * text is the thing the link has to be distinguishable from. Nav lists,
     * cards and buttons-as-links sit in their own containers and are marked by
     * position and shape, and 1.4.1 does not reach them. Nor does it reach a
     * paragraph used purely as a block wrapper: `/about` puts each account
     * handle in a bordered chip that is a `<p>`'s only content, and underlining
     * that would be marking a control that is already marked.
     *
     * Swept rather than pinned, in the spirit of the cursor test: this pattern
     * has been written three times in this repo already, and the point is to
     * catch the fourth before it ships.
     */
    for (const path of ROUTES) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForLoadState("networkidle");

      const bare = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>("p > a")]
          .filter((link) => {
            const paragraph = link.parentElement!;

            // Text in the paragraph that is not inside a link of its own.
            const copy = paragraph.cloneNode(true) as HTMLElement;
            for (const anchor of copy.querySelectorAll("a")) anchor.remove();
            if (!(copy.textContent ?? "").trim()) return false;

            const own = getComputedStyle(link);
            const around = getComputedStyle(paragraph);
            return own.color === around.color && own.textDecorationLine === "none";
          })
          .map(
            (link) =>
              `"${(link.textContent ?? "").trim().slice(0, 30)}" to ${link.getAttribute("href")}`,
          ),
      );

      expect(bare, `${path} has a link that reads as plain text`).toEqual([]);
    }
  });

  test("external links open safely", async ({ page }) => {
    await page.goto("/career");
    const github = page.locator('a[href="https://github.com/davner"]').first();
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("rel", /noopener/);
  });

  test("the email address is not in the page until you ask for it", async ({ page }) => {
    const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
    // The footer signs off rather than listing an address, so the reveal lives
    // on Career now.
    await page.goto("/career");

    // Split in the source and joined in an event handler, so a harvester
    // scraping the served HTML finds nothing to take.
    expect(await page.content()).not.toMatch(EMAIL);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

    await page
      .getByRole("button", { name: /Show email/i })
      .first()
      .click();

    const link = page.locator('a[href^="mailto:"]').first();
    await expect(link).toBeVisible();
    expect(await link.getAttribute("href")).toMatch(EMAIL);
  });

  test("the marquee is decorative", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".marquee-host").first()).toHaveAttribute("aria-hidden", "true");
  });

  /*
   * Route chunks are content-hashed and a deploy deletes the old ones, so a tab
   * opened before a deploy asks for a file that is gone. Three nightly jobs
   * each trigger a deploy here, so this is a most-nights event rather than an
   * edge case - and without a boundary it renders a blank page.
   */
  test.describe("a lazy route whose chunk went missing", () => {
    /** Serves the 404.html GitHub Pages returns for a file that is not there. */
    const breakChunk = (page: import("@playwright/test").Page, lift?: () => boolean) =>
      page.route("**/assets/fortnite-*.js", async (route) => {
        if (lift?.()) return route.continue();
        await route.fulfill({
          status: 404,
          contentType: "text/html",
          body: "<!doctype html><html></html>",
        });
      });

    test("reloads itself and comes back", async ({ page }) => {
      // Gone for the first load and present after, which is what a redeploy
      // looks like from a tab that was already open.
      let lifted = false;
      await breakChunk(page, () => lifted);

      await page.goto("/");
      await page.getByRole("link", { name: "Fortnite" }).first().click();
      setTimeout(() => {
        lifted = true;
      }, 50);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(/droppin/i, {
        timeout: 15_000,
      });
      await expect(page.locator("[data-slot=stat]").first()).toBeVisible();
    });

    test("gives up rather than reloading forever", async ({ page }) => {
      // Never comes back, so the reload cannot help. The guard has to notice.
      let navigations = 0;
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) navigations += 1;
      });
      await breakChunk(page);

      await page.goto("/");
      const before = navigations;
      await page.getByRole("link", { name: "Fortnite" }).first().click();

      await expect(page.getByRole("button", { name: "Reload" })).toBeVisible({
        timeout: 15_000,
      });
      // One reload spent, not a loop.
      expect(navigations - before).toBeLessThanOrEqual(3);
      expect((await page.locator("body").textContent())?.trim()).not.toBe("");
    });
  });

  /*
   * A lazy route paints the shell around a fallback while its chunk is in
   * flight, and the footer goes wherever the fallback leaves it. Below the fold
   * is the only place it can sit without moving when the real page arrives, and
   * the jump it makes otherwise is the largest layout shift on the site.
   *
   * Swept rather than pinned to the page it was found on: `App` names the
   * fallback once per lazy route, so nothing stops the next one being given a
   * shorter stand-in. Eager routes leave the loop on their own - they arrive
   * with their `h1` already rendered, and a fallback has none.
   */
  test("a route waiting on its chunk keeps the footer below the fold", async ({ page }) => {
    /*
     * The routes `App` imports directly rather than through `lazy`. Every other
     * entry in `ROUTES` waits on a chunk, and the count is what the sweep
     * checks itself against at the end.
     */
    const EAGER_ROUTES = ["/", "/about", "/career", "/blog"];

    /*
     * Taller than the fallback reaches unaided, so only a container that grows
     * to the viewport can put the footer past it. Both projects' stock heights
     * are shorter than the fallback's own content, which means the footer
     * clears those folds whether the container stretches or not and the
     * assertion below would hold on the exact layout it exists to catch. The
     * second measurement in the loop is what keeps this number ahead of the
     * fallback as the fallback changes. Width is left as the project set it.
     */
    const FOLD = 1200;
    await page.setViewportSize({ width: page.viewportSize()!.width, height: FOLD });

    /*
     * The chunks a route waits on are every script under `assets/` except the
     * one the document loads: nothing else is statically imported, so
     * everything else arrives on demand. Read off the page rather than named,
     * because the filename is content-hashed. Holding the entry too would
     * spend the delay before React has run, with no shell and no fallback on
     * screen, and then spend it again on the route chunk.
     */
    await page.goto("/");
    const entry = await page.locator("script[type=module][src]").first().getAttribute("src");
    expect(entry, "the document loads no module script").not.toBeNull();

    /*
     * Held until the reads below are done rather than for a fixed spell. Each
     * page carries a `modulepreload` for its own chunk, so the request goes out
     * while the document is still parsing - ahead of the entry, ahead of React,
     * ahead of anything there is to measure. A fixed window can expire before
     * the fallback is on screen, and a route whose chunk landed early renders
     * its `h1` in the first commit, takes the eager branch below, and is skipped
     * without failing anything.
     */
    let holding = false;
    await page.route(
      (url) => /^\/assets\/.+\.js$/.test(url.pathname) && url.pathname !== entry,
      async (route) => {
        while (holding) await new Promise((resolve) => setTimeout(resolve, 25));
        await route.continue();
      },
    );

    const footer = page.locator("footer");
    const title = page.getByRole("heading", { level: 1 });
    let measured = 0;

    for (const path of ROUTES) {
      holding = true;
      // `commit` rather than the default: `load` does not resolve until the
      // held chunk has landed, by which point the fallback is gone.
      await page.goto(path, { waitUntil: "commit" });
      await footer.waitFor();

      // An eager route renders its page in the same commit as the shell, so
      // there is no fallback on screen to measure.
      if ((await title.count()) > 0) {
        holding = false;
        continue;
      }

      const box = await footer.boundingBox();
      // The bottom of the fallback's own content, which is what the footer
      // would sit under if the container did not stretch.
      const content = await page.locator("[data-slot=skeleton]").last().boundingBox();
      holding = false;
      measured += 1;

      expect(box, `${path} renders no footer while its chunk loads`).not.toBeNull();
      expect(
        box!.y,
        `${path} paints its footer above the fold while loading`,
      ).toBeGreaterThanOrEqual(FOLD);

      expect(content, `${path} renders no fallback content to measure`).not.toBeNull();
      expect(
        content!.y + content!.height,
        `${path}'s fallback now fills the pinned viewport by itself, so this ` +
          `test can no longer tell a stretched container from an unstretched ` +
          `one - raise FOLD`,
      ).toBeLessThan(FOLD);

      // Let the chunk land before the next route pulls the page out from under
      // the request that is still being held.
      await title.waitFor();
    }

    /*
     * Every lazy route, not merely one of them. A fallback that stopped
     * rendering, or a chunk that arrived before the fallback could, puts routes
     * in the eager branch one at a time - and a sweep that only needs a single
     * catch keeps passing while the coverage drains away.
     */
    expect(measured, "a lazy route was not caught waiting on its chunk").toBe(
      ROUTES.length - EAGER_ROUTES.length,
    );
  });

  /*
   * react-markdown@10 hands each overridden component the mdast `node` it came
   * from, in with the rest of its props. A component that spreads those onto a
   * DOM element ships `node` to the browser, which stringifies it, so every
   * link in every post renders as `<a href="..." node="[object Object]">`.
   * Invalid HTML on the most common element the site prints, and it arrives
   * silently - React passes unknown lowercase attributes straight through
   * without a warning.
   *
   * A sweep rather than a check on the pages known to render prose, for the
   * reason the cursor sweep is one: a test that names its pages passes while a
   * route that is not named ships the defect.
   */
  test("no markdown override leaks react-markdown's node prop into the DOM", async ({ page }) => {
    const leaked: string[] = [];
    let prose = 0;

    for (const path of ROUTES) {
      await page.goto(path);
      // The prose routes are lazy, so their markdown is not in the document
      // until the chunk has mounted and drawn its heading.
      await page.getByRole("heading", { level: 1 }).waitFor();

      prose += await page.locator("main .prose-dan").count();
      leaked.push(
        ...(await page.evaluate(
          (where) =>
            [...document.querySelectorAll("main [node]")].map(
              (el) => `${where} <${el.tagName.toLowerCase()}>`,
            ),
          path,
        )),
      );
    }

    expect(leaked).toEqual([]);
    // Otherwise a sweep that rendered no markdown at all would pass on zero.
    expect(prose, "no route rendered any prose, so the sweep proved nothing").toBeGreaterThan(0);
  });
});

/**
 * The Fortnite page draws two things that can disagree: a stat board for one
 * window, and a season history that switches which window that is.
 *
 * The numbers themselves are baked in at build time from
 * `src/content/fortnite.json`, so there is nothing here worth asserting a value
 * against - it would only restate the file. What these pin is the wiring: that
 * every season the history offers can actually be shown, that picking one moves
 * the URL, and that a board with no numbers behind it says so rather than
 * rendering empty tiles.
 */
test.describe("fortnite", () => {
  test("the season history switches the board and syncs the URL", async ({ page }) => {
    await page.goto("/fortnite");

    const cards = page.locator("section[aria-labelledby=mains] li button");
    // `count()` does not wait for anything, and this page is rendered by React
    // after load, so the count has to be taken after something has appeared.
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();

    // The oldest season, which is never the default, so a change is a real one.
    const oldest = cards.nth(total - 1);
    // `textContent` rather than `innerText`, because the label is uppercased in
    // CSS and `toContainText` below compares against the un-transformed text.
    const label = ((await oldest.locator("p").first().textContent()) ?? "").trim();
    expect(label).not.toBe("");
    await oldest.click();

    await expect(page).toHaveURL(/[?&]season=/);
    await expect(oldest).toHaveAttribute("aria-current", "true");
    // The select names the season the history just picked, which is the
    // assertion that the two controls agree about what is on screen.
    await expect(page.getByRole("combobox", { name: "Season" })).toContainText(label);

    // And the line above the board says what the numbers cover. A season shows
    // its run of dates; lifetime says so in words.
    await expect(page.locator("[data-slot=window-dates]")).toHaveText(
      /\d{4}\s*-\s*\w+ \d{1,2}, \d{4}/,
    );
  });

  test("the board says which window it is showing", async ({ page }) => {
    await page.goto("/fortnite");
    await expect(page.locator("[data-slot=window-dates]")).toHaveText("All time");
  });

  test("every season it offers has either numbers or a reason it has none", async ({ page }) => {
    await page.goto("/fortnite");

    /*
     * The keys come from the calendar rather than the DOM. shadcn's Select
     * renders its options into a portal only while open, so reading them off
     * the page would mean opening the listbox, and the calendar is the source
     * the page builds that listbox from anyway.
     */
    const calendar = JSON.parse(readFileSync("src/content/fortnite-seasons.json", "utf8")) as {
      seasons: { key: string }[];
    };

    const keys = ["lifetime", ...calendar.seasons.map((season) => season.key)];
    expect(keys.length).toBeGreaterThan(1);

    for (const value of keys) {
      await page.goto(`/fortnite?season=${value}`);

      // One or the other has to render, and waiting for whichever arrives is
      // what stops an unrendered page from reading as an empty board.
      await expect(page.locator("[data-slot=stat], [data-slot=empty]").first()).toBeVisible();

      const tiles = page.locator("[data-slot=stat]");
      if ((await tiles.count()) > 0) {
        // A half-successful fetch shows as a tile with a term and no figure.
        for (const text of await tiles.locator("dd").allInnerTexts()) {
          expect(text.trim(), `empty stat tile on ?season=${value}`).not.toBe("");
        }
        continue;
      }

      // Scoped to the panel rather than the page: the season history below it
      // also prints "No numbers" on every card without a stat board.
      await expect(page.locator("[data-slot=empty]")).toContainText(/no numbers|no stats yet/i);
    }
  });

  test("says why it is empty rather than showing a blank board", async ({ page }) => {
    await page.goto("/fortnite");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/droppin/i);

    const board = page.locator("[data-slot=stat]");
    if ((await board.count()) > 0) {
      // Stats have landed: every tile must carry a figure, since an empty tile
      // is the shape a half-successful fetch takes.
      for (const text of await board.locator("dd").allInnerTexts()) {
        expect(text.trim()).not.toBe("");
      }
      return;
    }

    await expect(page.getByText(/no stats yet/i)).toBeVisible();
  });

  test("is reachable from the hobbies group and the footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/fortnite"]').first()).toBeAttached();
  });
});

/**
 * The landing page's side quests: a box that was ticked a long time ago, drawn
 * rather than built out of a checkbox.
 *
 * Nothing else in the suite can see this one. The repo's cursor sweep reads
 * interactive elements, and the whole point here is that there is no longer an
 * interactive element to read - so a checkbox coming back, or a `not-allowed`
 * cursor coming back with it, is a change that passes every existing check.
 */
test.describe("home", () => {
  /** The side quests line, found the way a reader finds it. */
  function questLine(page: Page) {
    return page.locator("main p").filter({ hasText: /^Side quests:/ });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  test("the ticked side quest reads as a sentence rather than a control", async ({ page }) => {
    /*
     * What the line is announced as, which is the whole argument for drawing
     * the tick rather than building it out of a checkbox: a checkbox offers a
     * state change the page cannot make and announces itself as a control
     * nobody can operate.
     *
     * A paragraph and its words, then - on one line, because a role appearing
     * inside it would nest and this would not match. And the tick is spoken as
     * the word it stands for, since a mark nobody can see leaves the line
     * reading as an instruction rather than as something already done.
     */
    const spoken = await questLine(page).ariaSnapshot();

    expect(spoken).toMatch(/^- paragraph: "Side quests: Accept all\s*, accepted"$/);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("nothing in the side quests line takes focus", async ({ page }) => {
    /*
     * Asked of every element rather than of a list of the ones that usually
     * take focus: `focus()` moves focus only to something that can hold it,
     * whatever made it focusable - a control, a `tabindex`, an editable host.
     */
    const takesFocus = await questLine(page).evaluate(
      (line) =>
        [...line.querySelectorAll("*")].filter((el) => {
          (el as HTMLElement).focus();
          return document.activeElement === el;
        }).length,
    );

    expect(takesFocus, "a keyboard can land on a line with nothing to do").toBe(0);
  });

  test("the ticked box shows no cursor that makes it look interactive", async ({ page }) => {
    /*
     * The inverse of the rule the rest of the site is held to. `pointer` says
     * this does something; `not-allowed` says it is a control that is switched
     * off, which is the opposite of what a ticked box means. A mark says
     * neither.
     */
    const cursors = await questLine(page).evaluate((line) => [
      ...new Set(
        [line, ...line.querySelectorAll("*")].map((el) => getComputedStyle(el as Element).cursor),
      ),
    ]);

    expect(cursors).not.toContain("pointer");
    expect(cursors).not.toContain("not-allowed");
  });
});
