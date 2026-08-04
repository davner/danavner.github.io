import { expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

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

  test("home links to every section", async ({ page }) => {
    await page.goto("/");
    for (const path of ["/about", "/career", "/blog", "/shows"]) {
      await expect(page.locator(`a[href="${path}"]`).first()).toBeAttached();
    }
  });

  test("each route sets its own title", async ({ page }) => {
    const titles: Record<string, string> = {
      "/about": "About · Dan Avner",
      "/career": "Career · Dan Avner",
      "/blog": "Blog · Dan Avner",
      "/shows": "Shows · Dan Avner",
    };

    for (const [path, title] of Object.entries(titles)) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    }
  });

  test("scroll resets between pages", async ({ page }) => {
    await page.goto("/career");
    await page.evaluate(() => window.scrollTo(0, 1500));
    // The header drops its index numbers below `sm`, so target the link itself
    // rather than a label that differs between viewports.
    await page.locator('header a[href="/about"]').click();
    await page.waitForURL("**/about");
    await page.getByRole("heading", { level: 1 }).waitFor();
    // A smooth scroll already in flight must not survive the route change.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
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
  test("filter narrows the list and syncs the URL", async ({ page }) => {
    await page.goto("/blog");
    const posts = page.locator("article");
    await expect(posts).toHaveCount(2);

    await page.getByRole("radio", { name: /^Work/i }).click();
    await page.waitForURL("**/blog?category=work");
    await expect(posts).toHaveCount(1);
    await expect(posts.locator("h3")).toContainText(/HOW THIS SITE IS BUILT/i);

    await page.getByRole("radio", { name: /^Personal/i }).click();
    await page.waitForURL("**/blog?category=personal");
    await expect(posts).toHaveCount(1);
  });

  test("filter survives a reload", async ({ page }) => {
    await page.goto("/blog?category=personal");
    await expect(page.locator("article")).toHaveCount(1);
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

      const buttons = page.getByRole("link", { name: /setlist on setlist\.fm$/i });
      const count = await buttons.count();
      // Every band named on the page - the headliner and the support acts.
      const bill = (await page.locator("main").innerText()).toLowerCase();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        await expect(button).toHaveAttribute("href", /^https:\/\/www\.setlist\.fm\//);
        // Opens off-site, so it has to open safely in its own tab.
        await expect(button).toHaveAttribute("target", "_blank");
        await expect(button).toHaveAttribute("rel", /noopener/);

        const band = (await button.innerText()).trim();
        expect(band.length).toBeGreaterThan(0);
        // A button never promises a set from a band the entry does not list.
        expect(bill).toContain(band.toLowerCase());
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
