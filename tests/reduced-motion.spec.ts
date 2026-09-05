import { expect, test, type Locator } from "@playwright/test";

import { statText } from "./stats";

/**
 * What `prefers-reduced-motion: reduce` does, and what it deliberately leaves
 * alone.
 *
 * The rule in `src/index.css` is an allowlist rather than a blanket
 * `transition-duration: 0`, because a colour or an opacity crossfade is not
 * movement and is the only hover and focus cue several controls have. That
 * makes this two claims rather than one - what stops, and what keeps going -
 * and a blanket rule would pass half of it while breaking the site's feedback.
 *
 * `emulateMedia` is set before the first `goto` in every test here: the strip
 * reads the preference on mount, and the CSS is matched at parse time.
 */

/** The transform two frames after whatever just happened. */
const twoFramesOn = (track: Locator) =>
  track.evaluate(
    (el) =>
      new Promise<string>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(getComputedStyle(el).transform)),
        );
      }),
  );

/** The transform once two consecutive reads agree. */
async function restingTransform(track: Locator): Promise<string> {
  let previous = "";
  await expect
    .poll(
      async () => {
        const now = await track.evaluate((el) => getComputedStyle(el).transform);
        const stopped = now === previous;
        previous = now;
        return stopped;
      },
      { message: "the photo strip never stopped moving" },
    )
    .toBe(true);
  return previous;
}

const SHOW_WITH_PHOTOS = "/shows/bilmuri-los-angeles-2026";

test.describe("the photo strip", () => {
  /*
   * Embla animates from script, so the CSS block cannot reach it and the option
   * has to be passed. Both directions are asserted: an option spelled in a way
   * embla reads as "no default" would make every strip jump for everyone, which
   * is a regression no reduced-motion test on its own can see.
   */
  test("arrives on the next slide rather than travelling to it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SHOW_WITH_PHOTOS);
    await page.getByRole("heading", { level: 1 }).waitFor();

    const track = page.locator("[data-slot=carousel-content] > div");
    const start = await track.evaluate((el) => getComputedStyle(el).transform);

    await page.getByRole("button", { name: "Next slide" }).click();
    const early = await twoFramesOn(track);
    const resting = await restingTransform(track);

    expect(resting, "the strip never moved at all").not.toBe(start);
    expect(early, "the strip is still on its way two frames after the click").toBe(resting);
  });

  test("travels when no preference was expressed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(SHOW_WITH_PHOTOS);
    await page.getByRole("heading", { level: 1 }).waitFor();

    const track = page.locator("[data-slot=carousel-content] > div");

    await page.getByRole("button", { name: "Next slide" }).click();
    const early = await twoFramesOn(track);
    const resting = await restingTransform(track);

    expect(early, "the strip jumped for a reader who never asked it to").not.toBe(resting);
  });
});

test.describe("overflowing tile text", () => {
  test("shows its whole line instead of waiting for a slide", async ({ page }) => {
    // The line reveals its tail by sliding under the pointer. Nothing slides
    // here, so the tail has to be on screen already.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);

    const lines = page.locator("[data-slot=record] .scroll-on-hover");
    expect(await lines.count(), "the shelf rendered no tile text to measure").toBeGreaterThan(0);

    const hidden = await lines.evaluateAll((els) =>
      els.flatMap((el) => {
        const inner = el.firstElementChild;
        if (!inner) return [];
        const over = inner.getBoundingClientRect().width - el.clientWidth;
        return over > 1
          ? [
              `${(el.textContent ?? "?").trim().slice(0, 40)} is ${over.toFixed(1)}px wide of its tile`,
            ]
          : [];
      }),
    );

    expect(hidden, "part of a line is unreachable, and nothing will move to reveal it").toEqual([]);

    // Wrapping is the mechanism, so a line that cannot wrap would spill out of
    // its tile and take the page with it.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
});

test.describe("the transition allowlist", () => {
  test("stops the transforms and leaves the colours alone", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const properties = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "transition-all";
      document.body.append(el);
      const list = getComputedStyle(el).transitionProperty;
      el.remove();
      return list;
    });

    expect(properties, "a transform is movement, and movement is what stops").not.toContain(
      "transform",
    );
    expect(
      properties,
      "a colour crossfade is not movement, and it is often the only cue",
    ).toContain("color");

    // And the duration survives, so the allowed properties still animate rather
    // than being collapsed by the back door.
    const colouring = await page
      .locator("[data-slot=navigation-menu-link] span")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(colouring), "every transition on the page is collapsed").toBeGreaterThan(0);
  });
});

test.describe("the route cross-fade", () => {
  /*
   * The allowlist's `*` selector cannot reach the view-transition pseudos, so
   * `index.css` zeroes them in their own block - and both directions are
   * asserted, because under reduced motion the pseudo computes `none`/`0s`
   * even where no rule reaches it at all. The no-preference read proving the
   * 150ms rule lands on the same pseudo is what shows the selector works,
   * which makes the `none` under reduce a decision rather than an accident.
   */
  test("finishes immediately under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const style = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement, "::view-transition-old(root)");
      return { name: cs.animationName, duration: cs.animationDuration };
    });

    expect(style.name, "the zeroing block no longer reaches the snapshot").toBe("none");
    expect(style.duration, "a duration survived the zeroing").toBe("0s");
  });

  test("runs at the fade's 150ms when no preference was expressed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const duration = await page.evaluate(
      () =>
        getComputedStyle(document.documentElement, "::view-transition-old(root)").animationDuration,
    );

    expect(duration, "the 150ms rule no longer reaches the snapshot").toBe("0.15s");
  });
});

test.describe("the stat odometers", () => {
  test("digits jump rather than rolling", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/vinyl");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const chip = page.getByRole("radio").nth(1);
    const chipCount = Number((await chip.innerText()).trim().split(/\s+/).pop());
    await chip.click();

    /*
     * NumberFlow rides WAAPI, which the CSS reduced-motion kill cannot reach;
     * its own preference guard is what this pins. Sampled per frame across
     * the roll's whole 180ms window, and scoped to the board's subtree - a
     * document-wide read would catch view transitions and the footer fire.
     */
    const board = page.locator("section[aria-label='What is on the shelf']");
    const running = await board.evaluate(async (el) => {
      let seen = 0;
      const start = performance.now();
      while (performance.now() - start < 300) {
        seen = Math.max(
          seen,
          el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return seen;
    });
    expect(running, "the odometer rolled under reduced motion").toBe(0);

    // And the digits did jump - to the pressed chip's own count.
    expect(Number(await statText(page.locator("[data-slot=stat] dd").first()))).toBe(chipCount);
  });
});

test.describe("the footer fire", () => {
  test("a press rearranges the standing frame without setting it moving", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const canvas = page.locator("footer canvas");
    await canvas.scrollIntoViewIfNeeded();

    // The settled still frame the reduced-motion path paints on mount.
    const before = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());

    await canvas.click();
    const after = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    expect(after, "the press changed nothing").not.toBe(before);

    // Rearranged, not animating: the new frame holds across two frames.
    const later = await canvas.evaluate(
      (el) =>
        new Promise<string>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve((el as HTMLCanvasElement).toDataURL())),
          );
        }),
    );
    expect(later, "the fire is animating under reduced motion").toBe(after);
  });
});
