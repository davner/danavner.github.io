import { expect, test } from "@playwright/test";

import { readFileSync } from "node:fs";

import { ROUTES } from "./routes";
import { ALL_SECTIONS } from "../src/lib/site";

/** Every section page, from the same list the header and footer render. */
const SECTION_PATHS = ALL_SECTIONS.map((section) => section.to);
const SECTION_LABELS = Object.fromEntries(
  ALL_SECTIONS.map((section) => [section.to, section.label]),
);

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
      // Trips was a section of its own until the travel writing moved into the
      // blog. Anything already linking to it lands there rather than on a 404.
      ["/trips", "**/blog"],
      ["/trips/spain-2026", "**/blog"],
    ] as const) {
      await page.goto(from);
      await page.waitForURL(to);
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
    expect(total).toBeGreaterThan(1);

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
    expect(work).toBeGreaterThan(0);
    await expect(posts.locator("h3").filter({ hasText: /HOW THIS SITE IS BUILT/i })).toHaveCount(1);

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

  test("a post renders markdown, code, tables, and heading anchors", async ({ page }) => {
    await page.goto("/blog/building-this-site");
    await expect(page).toHaveTitle("How this site is built · Dan Avner");
    await expect(page.locator("pre code .hljs-keyword").first()).toBeAttached();
    await expect(page.locator("table").first()).toBeAttached();
    await expect(page.locator("h2[id]").first()).toBeAttached();
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
    // Those all live on the show's own page now. Putting them back here is what
    // made the rows a screen tall each and left nothing to click through for.
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
    // These used to sit on a rail above the title, and they are stated nowhere
    // else on the page. A show page is the target of every share link, so if
    // they stop rendering, someone arriving from a text message gets a band
    // name and no way to tell which night it was.
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

  test("the collection README is not parsed as an entry", async ({ page }) => {
    const titles = await page.locator("[data-slot=show] h3").allInnerTexts();
    expect(titles.some((title) => /SHOW LOG/i.test(title))).toBe(false);
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
       * previous owner's shelf. That is what made this test pass 42 twice and
       * still add up to a plausible-looking number.
       *
       * Asserting against the pill's own count also makes the filter prove it -
       * a pill claiming 9 while the grid draws 42 is now a failure rather than
       * something only a careful reader would spot.
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
     * `src/content/now.md` may not exist. So this asserts whichever of the two
     * is on screen rather than assuming an entry is there - what it will not
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

  test("the archive appears only once an entry has been filed", async ({ page }) => {
    /*
     * The folder starts empty and fills on its own as `now.md` is rewritten, so
     * this asserts the rule rather than a count: entries present means a
     * timeline with a machine-readable date on each, none means no empty
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
    // Newest first, and never the same day twice - the build rejects a filed
    // entry dated the same day as the current one.
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
    const rail = page.getByRole("radiogroup", { name: "Jump to a date" });
    const archived = page.locator("[data-slot=now-archived]");
    const filed = await archived.count();

    if (filed === 0) {
      await expect(rail).toHaveCount(0);
      return;
    }

    // One date offered per entry filed.
    await expect(rail.getByRole("radio")).toHaveCount(filed);

    // The pane is the second scroll region on the page; the rail is the first.
    const pane = page.locator("[data-slot=scroll-area-viewport]").nth(1);
    await rail.getByRole("radio").last().click();

    const oldest = await archived.last().getAttribute("data-date");
    await expect(rail.locator("[aria-checked=true]")).toHaveAttribute("data-rail-date", oldest!);

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
      // Either tiles or an explicit empty state - never a blank page. A pull
      // list is genuinely empty most of the week, so both are correct.
      const tiles = await page.locator("[data-slot=comic]").count();
      if (tiles === 0) {
        await expect(page.getByText(/Nothing (pulled|on this list)/i)).toBeVisible();
      }
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
  // and is measured there once. Before that existed each page spelled its own
  // padding out, and /vinyl shipped two rows of pills a quarter-step out of
  // line with each other. Height is the thing you actually see, so that is the
  // thing asserted.
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
       * and sits against the pill's edge - "Everything 51" wanted 105px of
       * text in the 72px its share of the row left inside the padding, while
       * "Dan 42" wanted 46px and looked twice as roomy.
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
     * This used to be a hand-written list of five page-and-selector pairs, and
     * it passed while `/fortnite` shipped a grid of nine buttons with an arrow
     * cursor - the page simply was not on the list. A check you have to
     * remember to extend does not catch the thing it exists to catch, so this
     * sweeps every route and every interactive element instead.
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

  test("stat figures stay inside their tiles at 320px", async ({ page }) => {
    // Figures set in the display face used to overflow their own cells on the
    // narrowest screens, crossing the divider into the number beside them. The
    // page still did not scroll sideways, so the overflow check in
    // links.spec.ts could not see it.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);

    const overflowing = await page.evaluate(() => {
      const bad: string[] = [];
      document.querySelectorAll("[data-slot=stat] dd").forEach((dd) => {
        const cell = dd.parentElement!;
        const style = getComputedStyle(cell);
        const avail =
          cell.getBoundingClientRect().width -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        const range = document.createRange();
        range.selectNodeContents(dd);
        if (range.getBoundingClientRect().width > avail + 0.5) bad.push(dd.textContent ?? "?");
      });
      return bad;
    });

    expect(overflowing).toEqual([]);
  });
});

test.describe("chrome", () => {
  test("the skip link is the first stop for a keyboard", async ({ page }) => {
    await page.goto("/");
    // Tabbing before React has hydrated moves focus in the pre-render, where
    // the skip link is not there to receive it.
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toContainText("Skip to content");
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
   * edge case - and before `RouteBoundary` it rendered a blank page.
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
      // One reload spent, not a loop. This asserted 19 before the guard was
      // written the way it is now.
      expect(navigations - before).toBeLessThanOrEqual(3);
      expect((await page.locator("body").textContent())?.trim()).not.toBe("");
    });
  });

  test("no page scrolls horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ROUTES) {
      await page.goto(path);
      // Lazy routes render a skeleton first and the display face swaps in after
      // load, so measuring straight after `goto` measures a page mid-layout.
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            ),
          { message: `${path} overflows` },
        )
        .toBeLessThanOrEqual(1);
    }
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
