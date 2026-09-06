import { expect, test, type Locator, type Page } from "@playwright/test";

import { ALL_SECTIONS } from "../src/lib/site";

/**
 * The home index: nine sections, each saying what it holds and what it last
 * gained.
 *
 * No date, title or count is typed into this file. The log moves - the sheet
 * writes an album a day, the shelf grows overnight - so a literal here would
 * pin the index to whatever was newest the morning it was written, and would go
 * on passing long after the digest stopped tracking anything. Every case reads
 * the fact off the collection's own page instead and asks whether the home row
 * agrees with it.
 *
 * What the digest itself decides - that a draft is never named, that a shelf
 * with nothing on it counts to nothing rather than to zero - is settled in Node
 * by `tests/site-index.spec.ts`. This file is the other half: that the page
 * prints what it was handed, and prints nothing where it was handed nothing.
 */

/** The row that opens a section, found by the link that opens it. */
function rowFor(page: Page, to: string): Locator {
  return page.locator(`[data-slot=index-row]:has(a[href="${to}"])`);
}

/**
 * The link a row draws to the entry it names. The section's own link is a
 * direct child of the row; only the entry's sits inside a paragraph.
 */
function itemLink(row: Locator): Locator {
  return row.locator("p a");
}

async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();
}

/*
 * Both widths, because a phone is where the description earns its place: nine
 * display words on their own tell a first-time reader what "dan.fm" and
 * "Fortnite" are, which is nothing. The viewport is set here rather than left
 * to the project, so the desktop and the mobile run both measure both widths.
 */
for (const width of [375, 1280]) {
  test(`every section says what it holds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openHome(page);

    await expect(page.locator("[data-slot=index-row]")).toHaveCount(ALL_SECTIONS.length);

    for (const section of ALL_SECTIONS) {
      const row = rowFor(page, section.to);
      await expect(row, `${section.to} has no row on the index`).toHaveCount(1);
      await expect(row, `${section.to}'s row is not named`).toContainText(section.label);

      // Against `section.blurb` rather than a sentence typed here, for
      // `tests/nav.spec.ts`' reason: a test holding its own copy is a third
      // copy, and the drift just moves into it.
      const blurb = row.locator("[data-slot=index-blurb]");
      await expect(blurb, section.to).toHaveText(section.blurb);
      await expect(blurb, `${section.to}'s description is hidden at ${width}px`).toBeVisible();
    }
  });
}

/**
 * The collections that print a machine date for every entry they list, so the
 * newest date on the page is the entry the home row has to be carrying.
 *
 * `/shows` and `/vinyl` are not here and cannot be: a show row prints the day
 * without its year and a record tile prints no added date at all. The shows row
 * is checked through the entry it links to instead; the vinyl row's date is
 * only checkable in Node, where `tests/site-index.spec.ts` has it.
 */
const DATED = ["/now", "/blog", "/dan-fm"];

test("a row's date is the newest one its collection prints", async ({ page }) => {
  let checked = 0;

  for (const to of DATED) {
    await page.goto(to);
    await page.getByRole("heading", { level: 1 }).waitFor();

    // Lexicographic, which is what an ISO date sorts by anyway.
    const newest = await page.locator("main time[datetime]").evaluateAll((els) => {
      const dates = els.map((el) => el.getAttribute("datetime") ?? "").filter(Boolean);
      return dates.sort().at(-1) ?? null;
    });

    await openHome(page);
    const stated = rowFor(page, to).locator("time");

    if (newest === null) {
      // Nothing logged. The row says what the section is for and stops: a date
      // the digest does not have would print as a blank readout under a
      // heading, which reads as broken rather than as nothing to say.
      await expect(stated, `${to} lists no entry but its row is dated`).toHaveCount(0);
      continue;
    }

    await expect(stated, `${to}'s row carries no date`).toHaveCount(1);
    await expect(stated).toHaveAttribute("datetime", newest);
    await expect(stated, `${to}'s date is spelled as an empty readout`).not.toHaveText("");
    checked += 1;
  }

  expect(checked, "no collection printed a date, so nothing above was compared").toBeGreaterThan(0);
});

/**
 * The collections listed newest first, each entry linking to its own page, so
 * the first such link is the entry the home row has to point at.
 *
 * Not `/dan-fm`. The station picks its featured album off the reader's clock
 * while the digest takes the newest one in the log, so the first link there is
 * not the one the row names - which is why that row is dated against the
 * archive above instead.
 */
const NEWEST_FIRST = ["/blog", "/shows"];

test("a row points at the entry its collection lists first", async ({ page }) => {
  for (const to of NEWEST_FIRST) {
    await page.goto(to);
    await page.getByRole("heading", { level: 1 }).waitFor();

    const newest = await page.locator(`main a[href^="${to}/"]`).first().getAttribute("href");
    expect(newest, `${to} lists no entry to compare against`).not.toBeNull();

    await openHome(page);
    await expect(itemLink(rowFor(page, to)), `${to}'s row names a different entry`).toHaveAttribute(
      "href",
      newest!,
    );
  }
});

/**
 * The two sections that are not logs. The digest fills no row for either, so
 * they render exactly what a collection renders before anything is logged in
 * it - which is how that case is reachable here without emptying one.
 */
const NOT_LOGS = ["/about", "/career"];

test("a section with nothing logged prints its blurb and no empty readout", async ({ page }) => {
  await openHome(page);

  const rows = await page.locator("[data-slot=index-row]").evaluateAll((items) =>
    items.map((li) => ({
      to: li.querySelector("a")?.getAttribute("href") ?? "",
      lines: [...li.querySelectorAll("p")].map((p) => (p.textContent ?? "").trim()),
      dates: [...li.querySelectorAll("time")].map((el) => (el.textContent ?? "").trim()),
    })),
  );

  expect(rows).toHaveLength(ALL_SECTIONS.length);

  // Swept over all nine rather than over the two below, because the row a fresh
  // checkout empties is whichever collection the job has not filled yet.
  for (const row of rows) {
    expect(row.lines, `${row.to} prints a line with nothing in it`).not.toContain("");
    expect(row.dates, `${row.to} prints a date with nothing in it`).not.toContain("");
  }

  for (const to of NOT_LOGS) {
    const row = rows.find((entry) => entry.to === to);
    const blurb = ALL_SECTIONS.find((section) => section.to === to)?.blurb;

    expect(row, `${to} has no row on the index`).toBeDefined();
    expect(row!.dates, `${to} has nothing logged and is dated anyway`).toEqual([]);
    expect(row!.lines, `${to} prints more than what it is`).toEqual([blurb]);
  }
});

/**
 * Brings `row` fully into view, clear of the bar.
 *
 * The header is sticky and 64px tall, so a row scrolled to the top of the
 * window sits under it and takes a click that was aimed at the row.
 */
async function showRow(row: Locator): Promise<void> {
  await row.scrollIntoViewIfNeeded();
  await row.evaluate((li) => {
    const bar = document.querySelector("header")?.getBoundingClientRect();
    const under = (bar?.bottom ?? 0) - li.getBoundingClientRect().top;
    if (under > 0) window.scrollBy(0, -under - 8);
  });
}

/**
 * A point inside the row that neither of its links draws a box over.
 *
 * Sampled rather than computed, because where the open space is depends on the
 * width: stacked, it is the end of the name's line, and in one line it is the
 * gap between the name and the description. Points the row does not own are
 * skipped, so nothing here can click the bar or an overlay by accident.
 */
async function openSpaceIn(row: Locator): Promise<{ x: number; y: number } | null> {
  return row.evaluate((li) => {
    const rect = li.getBoundingClientRect();
    const links = [...li.querySelectorAll("a")].map((link) => link.getBoundingClientRect());
    const clear = (x: number, y: number) =>
      links.every(
        (box) => x < box.left - 2 || x > box.right + 2 || y < box.top - 2 || y > box.bottom + 2,
      );

    for (const down of [0.5, 0.25, 0.75]) {
      const y = rect.top + rect.height * down;
      for (let across = 0.05; across < 1; across += 0.05) {
        const x = rect.left + rect.width * across;
        if (!clear(x, y)) continue;
        if (!li.contains(document.elementFromPoint(x, y))) continue;
        return { x, y };
      }
    }

    return null;
  });
}

/*
 * The row's whole area is the section's link, drawn by an `::after` on the name
 * that is absolute and inset to the `li`. Two things take that away without
 * changing a pixel of what the page looks like, and each has its own case here.
 *
 * A transform anywhere between the `li` and that pseudo-element makes the
 * transformed element its containing block, and a row-wide target collapses
 * onto the name - which is why the hover shift sits on a span inside the link
 * rather than on the link itself. And the newest item's own link is over that
 * overlay only because it is positioned; static, it is painted under it, and a
 * click meant for an album opens the section index instead.
 *
 * Both widths, because the row lays out twice: stacked below `lg`, and in one
 * line above it with the description alongside the name.
 */
for (const width of [375, 1280]) {
  test(`a click in a row's open space opens its section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const section of ALL_SECTIONS) {
      await openHome(page);

      const row = rowFor(page, section.to);
      await showRow(row);

      const point = await openSpaceIn(row);
      expect(
        point,
        `${section.to}'s row has no space that is not one of its own links`,
      ).not.toBeNull();

      await page.mouse.click(point!.x, point!.y);
      await expect(page, `a click in ${section.to}'s row went nowhere`).toHaveURL(section.to);
    }
  });

  test(`a row's newest item opens the item rather than the section at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    let checked = 0;

    for (const section of ALL_SECTIONS) {
      await openHome(page);

      const row = rowFor(page, section.to);
      const item = itemLink(row);
      if ((await item.count()) === 0) continue;

      /*
       * A row that draws an item link at all draws one that goes somewhere the
       * row does not - `src/lib/site-index.ts` refuses the other kind - so
       * every link found here has to be distinguishable from the overlay behind
       * it, and none of them may be skipped.
       */
      const href = await item.getAttribute("href");
      expect(href, `${section.to}'s newest entry links back to the row's own section`).not.toBe(
        section.to,
      );

      await showRow(row);
      const box = await item.boundingBox();
      expect(box, `${section.to}'s row names an entry with no box`).not.toBeNull();

      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(
        page,
        `a click on ${section.to}'s newest entry opened the section index instead`,
      ).toHaveURL(href!);
      checked += 1;
    }

    expect(checked, "no row named an entry with a page of its own").toBeGreaterThan(0);
  });
}
