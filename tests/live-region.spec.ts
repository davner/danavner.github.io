import { expect, test, type Page } from "@playwright/test";

/**
 * `src/components/filter-status.tsx` is the site's first live region: the one
 * thing on the page that speaks without being asked. `/vinyl` is its only
 * caller so far, at `src/routes/vinyl.tsx`.
 *
 * Everything worth testing about it is about *when* it speaks, which is not
 * visible in a screenshot, not visible in the DOM at rest, and not something
 * axe has a rule for. So the drive here is a MutationObserver installed before
 * the app loads, recording every change an assistive technology would react
 * to: the region arriving, and its text changing afterwards. The two are
 * separate kinds because the difference between them is the whole design -
 * a region that arrives *with* its content is not announced, and that is what
 * stops every page load reading its own result count out loud.
 */

/** What a screen reader would have reacted to, in order. */
interface Announcement {
  kind: "mounted" | "changed";
  text: string;
}

/**
 * `SETTLE_MS` in the component, with room around it.
 *
 * Every other wait in this file is a wait on a condition. These are not: the
 * assertion is that nothing was announced, and there is no condition to poll
 * for the absence of an event. A fixed multiple of the component's own settle
 * window is the honest way to do it, and it fails safe - too short only ever
 * turns a real failure into a pass, never the other way round. The burst test
 * below is what proves the harness sees announcements at all, so the negative
 * ones are not passing because nothing is being recorded.
 */
const SETTLED = 1_500;

const readAnnouncements = (page: Page) =>
  page.evaluate(() => (window as unknown as { __announcements: Announcement[] }).__announcements);

/** Just the announcements, in order. A mount is not one; a later change is. */
async function spoken(page: Page): Promise<string[]> {
  const log = await readAnnouncements(page);
  return log.filter((entry) => entry.kind === "changed").map((entry) => entry.text);
}

/** `55 of 55 records shown`, read off the page rather than written down: the
    shelf is refilled from Discogs nightly, so any figure here goes stale. */
async function shelfSentence(page: Page): Promise<string> {
  const shown = await page.locator("[data-slot=record]").count();
  const total = await page.locator("[data-slot=stat] dd").first().innerText();
  return `${shown} of ${Number(total)} records shown`;
}

test.describe("the filtered-count live region", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const log: Announcement[] = [];
      (window as unknown as { __announcements: Announcement[] }).__announcements = log;

      const regionIn = (node: Node): Element | null => {
        if (!(node instanceof Element)) return null;
        return node.matches('[role="status"]') ? node : node.querySelector('[role="status"]');
      };

      new MutationObserver((records) => {
        for (const record of records) {
          for (const added of record.addedNodes) {
            const region = regionIn(added);
            if (region) log.push({ kind: "mounted", text: region.textContent ?? "" });
          }

          // A text change inside a region that was already on the page. When
          // the region itself arrives the mutation's target is its parent, so
          // this deliberately does not fire for the mount.
          const host =
            record.target instanceof Element ? record.target : record.target.parentElement;
          const region = host?.closest('[role="status"]');
          if (region) log.push({ kind: "changed", text: region.textContent ?? "" });
        }
        // `document` rather than `document.documentElement`, which is still
        // null this early: an init script runs before the page's own scripts
        // and before the parser has built the root element.
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });

    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });

  test("the region is polite, and rendered before it has anything to say", async ({ page }) => {
    const region = page.locator('[role="status"]');

    await expect(region).toHaveCount(1);
    // `role="status"` is already polite; the component restates it because some
    // screen readers have honoured one and not the other.
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toHaveText(await shelfSentence(page));

    /*
     * Out of sight and still in the accessibility tree. `sr-only` clips it
     * rather than hiding it, and the difference matters: `display: none` and
     * `visibility: hidden` both stop a live region announcing at all, and
     * neither is visible as a change on screen.
     */
    await expect(region).not.toBeInViewport();
    const style = await region.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { display: computed.display, visibility: computed.visibility };
    });
    expect(style.display, "a display:none live region never announces").not.toBe("none");
    expect(style.visibility, "a visibility:hidden live region never announces").not.toBe("hidden");
  });

  test("arriving on the page announces nothing", async ({ page }) => {
    await page.waitForTimeout(SETTLED);

    const log = await readAnnouncements(page);
    expect(
      log.filter((entry) => entry.kind === "mounted"),
      "the region has to be on the page before its content changes, or the change is missed",
    ).toHaveLength(1);
    expect(
      log.filter((entry) => entry.kind === "changed").map((entry) => entry.text),
      "the shelf read its own count out loud to anyone who just arrived",
    ).toEqual([]);
  });

  test("a burst of keystrokes announces the answer once, not every step", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: /search the collection/i });
    const artist = (
      await page.locator("[data-slot=record] a > div > p:first-child").first().innerText()
    )
      .trim()
      .slice(0, 6);

    // Every gap is under the component's 500ms settle, so this is one burst of
    // typing rather than six separate searches.
    await search.pressSequentially(artist, { delay: 60 });
    await expect.poll(() => page.locator("[data-slot=record]").count()).toBeGreaterThan(0);
    const answer = await shelfSentence(page);

    await page.waitForTimeout(SETTLED);
    expect(
      await spoken(page),
      "a polite region queues what it is given, so one announcement per keystroke would read " +
        "the intermediate counts out while the reader is still typing",
    ).toEqual([answer]);
  });

  test("a search with no matches announces none of the shelf", async ({ page }) => {
    const total = Number(await page.locator("[data-slot=stat] dd").first().innerText());

    await page
      .getByRole("searchbox", { name: /search the collection/i })
      .pressSequentially("zzzzz-not-a-record-zzzzz", { delay: 20 });
    await expect(page.locator("[data-slot=record]")).toHaveCount(0);

    await page.waitForTimeout(SETTLED);
    // The empty shelf is the state a sighted reader can see and this one cannot,
    // so it is the state that most needs saying.
    expect(await spoken(page)).toEqual([`0 of ${total} records shown`]);
  });

  test("clearing the search announces the shelf coming back", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: /search the collection/i });
    const whole = await shelfSentence(page);

    await search.pressSequentially("zzzzz-not-a-record-zzzzz", { delay: 20 });
    await expect(page.locator("[data-slot=record]")).toHaveCount(0);
    await page.waitForTimeout(SETTLED);

    await search.fill("");
    await expect.poll(() => page.locator("[data-slot=record]").count()).toBeGreaterThan(0);
    await page.waitForTimeout(SETTLED);

    // Two announcements, in order, and the second is the shelf as it was. A
    // timer that is cleared and never restarted would leave the reader on the
    // empty count while the whole shelf is back on screen.
    const said = await spoken(page);
    expect(said).toHaveLength(2);
    expect(said[1]).toBe(whole);
  });

  test("sorting the shelf announces nothing", async ({ page }) => {
    /*
     * Sorting re-renders every tile and the sentence stays word for word the
     * same, because the count did not move. Nothing should reach the region at
     * all - which is why this compares the whole log rather than the spoken
     * half of it. A rewrite that drops the same-value bail-out the component
     * leans on would show up as a change; one that lets the region be
     * remounted, which is the other way a live region stops working, would
     * show up as a second mount and not as a change at all.
     */
    // Snapshotted after the page has had its own settle window, so an
    // announcement the *load* should not have made is caught by the test named
    // for that rather than landing in the middle of this one.
    await page.waitForTimeout(SETTLED);
    const before = await readAnnouncements(page);

    await page.getByRole("combobox", { name: /sort records/i }).click();
    // The label from `SORT_LABEL` in src/lib/vinyl.ts, written out rather than
    // imported: that module pulls in the `virtual:` content plugin, which Node
    // cannot resolve when Playwright loads this file.
    await page.getByRole("option", { name: "By artist" }).click();
    await page.waitForURL("**/vinyl?sort=artist");

    await page.waitForTimeout(SETTLED);
    expect(await readAnnouncements(page), "reordering the shelf is not a change of status").toEqual(
      before,
    );
  });
});
