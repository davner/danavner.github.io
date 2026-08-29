import { expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

/**
 * The widths the design steps at, and the pixel either side of each step.
 *
 * The two structural breakpoints are `sm` (640) and `lg` (1024), so 639/640 and
 * 767/768 are here as pairs: a layout that breaks does it on one side of a step
 * and not the other, and a round number like 700 says which of the two states
 * broke without saying that the step is what broke it. 412 is the Pixel 7.
 *
 * Above roughly 1200px the content column is pixel-identical - the shell is
 * `max-w-6xl` with `sm:px-6` - so 1280 and 1440 exercise the same layout and
 * neither is redundant only because the other might stop being true.
 */
const WIDTHS = [320, 375, 390, 412, 639, 640, 767, 768, 1024, 1280, 1440];

/**
 * The type scale, by role, as `src/index.css` declares it.
 *
 * Six of the eight are `clamp()`s of the viewport, so the sweep resolves each
 * one in the page at the width being tested rather than restating a number
 * here that would only be true at one of them.
 */
const STEPS = ["hero", "poster", "poster-long", "feature", "heading", "title", "lede", "sm"];

/**
 * The steps that carry a line-height of their own, which is the body face's two.
 *
 * The display steps deliberately carry none: their leading belongs to the face,
 * and a paired line-height would arrive as a utility and out-rank it. See the
 * `@theme` block in `src/index.css`.
 */
const PAIRED = ["sm", "lede"];

/** The font-size a probe inherits when the step it asks for is not declared. */
const UNDECLARED = 7;

/**
 * Everything this sweep checks, in one pass over one loaded page.
 *
 * Handed to `page.evaluate`, so it closes over nothing and takes what it needs
 * as an argument. One page load per width and route is what makes eleven widths
 * across thirteen routes affordable at all; four separate assertions would be
 * four times the loads for the same coverage.
 */
function collectFaults(scale: { steps: string[]; paired: string[]; undeclared: number }) {
  const faults: string[] = [];
  const round = (value: number) => Math.round(value * 100) / 100;
  const name = (el: Element) =>
    `<${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().slice(0, 40)}"`;

  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (overflow > 1) faults.push(`the page scrolls sideways by ${overflow}px`);

  /** How much wider the element's own text is than the box it has to sit in. */
  const spill = (el: Element, box: Element) => {
    const style = getComputedStyle(box);
    const room =
      box.getBoundingClientRect().width -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width - room;
  };

  // A figure in the display face crossing its own divider into the number
  // beside it. The page does not scroll sideways when it happens, so the check
  // above cannot see it.
  for (const dd of document.querySelectorAll("[data-slot=stat] dd")) {
    const over = spill(dd, dd.parentElement!);
    if (over > 0.5) faults.push(`${name(dd)} is ${round(over)}px wider than its tile`);
  }

  // `whitespace-nowrap` on a pill means a label too long for its share of the
  // row spills straight through its own padding and touches the edge.
  for (const item of document.querySelectorAll("[data-slot=toggle-group-item]")) {
    const over = spill(item, item);
    if (over > 0.5) faults.push(`${name(item)} is ${round(over)}px wider than its padding`);
  }

  /*
   * The scale as it resolves at this width. The probe sits in a holder set to a
   * size no step can be, so a step that is not declared resolves to the
   * holder's size rather than silently inheriting the body's - which is a step,
   * and would leave the set looking complete.
   */
  const holder = document.createElement("div");
  holder.style.cssText = `position:absolute;visibility:hidden;font-size:${scale.undeclared}px`;
  const probe = document.createElement("span");
  holder.append(probe);
  document.body.append(holder);

  const resolved = scale.steps.map((step) => {
    probe.style.fontSize = `var(--text-${step})`;
    return { step, px: round(parseFloat(getComputedStyle(probe).fontSize)) };
  });

  probe.removeAttribute("style");
  probe.className = "readout";
  const readout = round(parseFloat(getComputedStyle(probe).fontSize));
  holder.remove();

  const missing = resolved.filter((entry) => entry.px === scale.undeclared);
  for (const entry of missing) faults.push(`--text-${entry.step} is not declared`);

  const body = round(parseFloat(getComputedStyle(document.body).fontSize));
  const sizes = new Set([...resolved.map((entry) => entry.px), readout, body]);
  const paired = new Set(
    resolved.filter((entry) => scale.paired.includes(entry.step)).map((entry) => entry.px),
  );

  for (const el of document.body.querySelectorAll("*")) {
    // Only what actually sets type: an element holding its own words, rather
    // than a wrapper reporting the size its children will be set at.
    const sets = [...el.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
    // A code face is a face, not a step. `.prose-dan code` renders at 0.85em of
    // the body step and `.prose-dan pre` at 0.85rem, and neither is a member of
    // anything - so they are carved out here rather than added to the scale.
    if (!sets || el.closest(".prose-dan code, .prose-dan pre")) continue;

    const style = getComputedStyle(el);
    const size = round(parseFloat(style.fontSize));
    if (!sizes.has(size)) faults.push(`${name(el)} is set at ${size}px, which is not a step`);

    /*
     * The body steps carry a line-height and the display steps do not, on
     * purpose: leading belongs to the display face, and a paired line-height
     * would arrive as a utility and out-rank `.display`'s 0.86. Dropping the
     * pairing from one of the two that do carry one is silent - the element
     * inherits the root's unitless 1.5 - so that flattening is what is asserted
     * rather than the pairing's presence.
     */
    if (paired.has(size) && Math.abs(parseFloat(style.lineHeight) - size * 1.5) < 0.05) {
      faults.push(`${name(el)} computes 1.5x its font-size, so its step lost its line-height`);
    }
  }

  return faults;
}

/*
 * One test per width, each walking every route. The alternative - a test per
 * width and route - is 143 tests reporting the same failure eleven times over,
 * and no more informative for it, because the message already says which route
 * and which width.
 */
for (const width of WIDTHS) {
  test(`the layout holds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const path of ROUTES) {
      await page.goto(path);
      // Lazy routes render a skeleton first and the display face swaps in after
      // load, so measuring straight after `goto` measures a page mid-layout.
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      await expect
        .poll(
          () =>
            page.evaluate(collectFaults, {
              steps: STEPS,
              paired: PAIRED,
              undeclared: UNDECLARED,
            }),
          { message: `${path} at ${width}px` },
        )
        .toEqual([]);
    }
  });
}
