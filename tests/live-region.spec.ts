import { expect, test, type Page } from "@playwright/test";

/**
 * `src/components/filter-status.tsx` is the site's live region: the one thing on
 * the page that speaks without being asked. Four pages filter a collection, and
 * every one of them mounts it.
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

/** Record what a screen reader would react to, from before the app loads. */
async function watchAnnouncements(page: Page) {
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
        const host = record.target instanceof Element ? record.target : record.target.parentElement;
        const region = host?.closest('[role="status"]');
        if (region) log.push({ kind: "changed", text: region.textContent ?? "" });
      }
      // `document` rather than `document.documentElement`, which is still
      // null this early: an init script runs before the page's own scripts
      // and before the parser has built the root element.
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

/** The number a filter pill prints after its label. */
async function pillCount(page: Page, name: RegExp): Promise<number> {
  const text = (await page.getByRole("radio", { name }).innerText()).trim();
  const digits = /(\d+)\s*$/.exec(text);
  expect(digits, `the "${text}" pill prints no count to read a total off`).not.toBeNull();
  return Number(digits![1]);
}

/**
 * `55 of 55 records shown`, read off the page rather than written down: the
 * shelf is refilled from Discogs nightly, so any figure here goes stale.
 *
 * The total comes from the "Everything" pill and not from the Records stat.
 * The stat counts the shelf the owner filter left behind, so once a filter is
 * on, it is the shown figure a second time.
 */
async function shelfSentence(page: Page): Promise<string> {
  const shown = await page.locator("[data-slot=record]").count();
  return `${shown} of ${await pillCount(page, /^Everything/)} records shown`;
}

/**
 * The playlist row on `/fortnite`, which is only on the page when more than one
 * playlist was played in the window on screen.
 */
const playlists = (page: Page) => page.getByRole("radiogroup", { name: "Playlist" });

/**
 * `Showing Lifetime, Solo`, read off both controls rather than written down:
 * the seasons are refilled nightly, so a name in this file goes stale.
 *
 * Both dimensions, because both move the board. The playlist is read with
 * `textContent` and not `innerText`, because the pill is set in `readout` -
 * `text-transform: uppercase` - and `innerText` hands back the rendering rather
 * than the label the page built its sentence from.
 *
 * The playlist half is dropped when the row is not rendered, which mirrors the
 * page: a window with one playlist played offers no choice to announce.
 */
async function boardSentence(page: Page): Promise<string> {
  const season = await page.getByRole("combobox", { name: "Season" }).innerText();
  if ((await playlists(page).count()) === 0) return `Showing ${season}`;

  const playlist = await playlists(page).getByRole("radio", { checked: true }).textContent();
  return `Showing ${season}, ${playlist?.trim()}`;
}

/**
 * One control that filters a collection, and what the region owes the reader
 * once it has been used.
 *
 * `apply` waits on the page having re-rendered, not on the URL having moved.
 * The two are a commit apart, and reading the count in between measures the
 * list that was on screen before the click.
 *
 * Every collection page owns its own nouns - records, posts, comics, a season -
 * so the sentence is read back off the page rather than written down here. The
 * shelves are refilled nightly and the blog grows, so a figure in this file
 * goes stale the week after it is written.
 */
interface Control {
  /** Names the test, so a failure says which control went quiet. */
  name: string;
  /** Changes what is on screen, and fails if it did not. */
  apply: (page: Page) => Promise<void>;
  /** The sentence the region should be left holding once `apply` has settled. */
  sentence: (page: Page) => Promise<string>;
}

/**
 * A page that filters a collection, and every control that filters it.
 *
 * A list rather than one control per page, because a page with two of them has
 * to answer for both and a table shaped for one cannot ask. `/fortnite` is
 * filtered by season and by playlist, and the playlist is the dimension a
 * season-only sentence leaves silent while every figure on the board moves.
 */
interface Announcer {
  path: string;
  controls: Control[];
}

const ANNOUNCERS: Announcer[] = [
  {
    path: "/vinyl",
    controls: [
      {
        name: "owner",
        apply: async (page) => {
          const owners = page.getByRole("radio");
          expect(await owners.count(), "the shelf offers no owner to filter by").toBeGreaterThan(1);
          await owners.nth(1).click();
          await expect(owners.nth(1)).toHaveAttribute("aria-checked", "true");
        },
        sentence: shelfSentence,
      },
    ],
  },
  {
    path: "/blog",
    controls: [
      {
        name: "category",
        apply: async (page) => {
          const work = page.getByRole("radio", { name: /^Work/ });
          await work.click();
          await expect(work).toHaveAttribute("aria-checked", "true");
        },
        sentence: async (page) => {
          const shown = await page.locator("main article").count();
          return `${shown} of ${await pillCount(page, /^Everything/)} posts shown`;
        },
      },
    ],
  },
  {
    path: "/comics",
    controls: [
      {
        name: "shelf",
        apply: async (page) => {
          await page.getByRole("radio", { name: /^Wants/ }).click();
          await expect(page).toHaveURL(/shelf=wants/);
          // The shelf's own heading, which is rendered from the same label the
          // sentence is built out of.
          await expect(page.locator("#shelf-list")).toHaveText(/^Wants$/);
        },
        sentence: async (page) => {
          const shown = await page.locator("[data-slot=comic]").count();
          // The shelf's own `sr-only` heading, which is where the page says which
          // list is on screen - so the two cannot drift apart.
          return `${shown} comics on the ${await page.locator("#shelf-list").innerText()} shelf`;
        },
      },
    ],
  },
  {
    path: "/fortnite",
    controls: [
      {
        name: "season",
        apply: async (page) => {
          const season = page.getByRole("combobox", { name: "Season" });
          const before = await season.innerText();
          await season.click();
          await page.getByRole("option").nth(1).click();
          await expect(page).toHaveURL(/season=/);
          await expect(season).not.toHaveText(before);
        },
        sentence: boardSentence,
      },
      {
        name: "playlist",
        apply: async (page) => {
          const modes = playlists(page).getByRole("radio");
          expect(await modes.count(), "the board offers no playlist to filter by").toBeGreaterThan(
            1,
          );

          // The second pill rather than a named one: which playlists exist
          // depends on what was played in the window, and the nightly job
          // decides that.
          await modes.nth(1).click();
          await expect(page).toHaveURL(/mode=/);
          await expect(modes.nth(1)).toHaveAttribute("aria-checked", "true");
        },
        sentence: boardSentence,
      },
    ],
  },
];

test.describe("every page that filters says what the filter did", () => {
  for (const announcer of ANNOUNCERS) {
    test.describe(announcer.path, () => {
      test.beforeEach(async ({ page }) => {
        await watchAnnouncements(page);
        await page.goto(announcer.path);
        await page.getByRole("heading", { level: 1 }).waitFor();
      });

      test("the region is polite, and rendered before it has anything to say", async ({ page }) => {
        const region = page.locator('[role="status"]');

        await expect(region).toHaveCount(1);
        // `role="status"` is already polite; the component restates it because
        // some screen readers have honoured one and not the other.
        await expect(region).toHaveAttribute("aria-live", "polite");

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
        expect(style.visibility, "a visibility:hidden live region never announces").not.toBe(
          "hidden",
        );
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
          "the page read its own count out loud to anyone who just arrived",
        ).toEqual([]);
      });

      for (const control of announcer.controls) {
        test(`changing the ${control.name} announces the result`, async ({ page }) => {
          await page.waitForTimeout(SETTLED);

          await control.apply(page);
          const answer = await control.sentence(page);

          await page.waitForTimeout(SETTLED);
          expect(
            await spoken(page),
            "a sighted reader watched the list change and this one was told nothing",
          ).toEqual([answer]);
        });
      }
    });
  }
});

/**
 * The shelf's search box, which is the control the settle window exists for.
 *
 * It fires on every keystroke where every other filter on the site fires once,
 * so these are `/vinyl`-only by nature rather than by convenience.
 */
test.describe("the vinyl search box", () => {
  test.beforeEach(async ({ page }) => {
    await watchAnnouncements(page);
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
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
    const total = await pillCount(page, /^Everything/);

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
