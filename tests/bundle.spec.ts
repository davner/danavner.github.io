import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * The checks that read the source and the build rather than a page.
 *
 * Everything here is about what a file may contain, so none of it needs a
 * browser - and none of it can be expressed as a measurement on a rendered
 * page, which is the reason each one is here rather than in a sweep.
 */
const SRC = path.resolve("src");

/** Every file under `src`, in the order the directory walk finds them. */
function sources(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/*
 * Tailwind's own size utilities, which `--text-*: initial` leaves generating
 * nothing. `sm` is deliberately not in here: `--text-sm` is a step of this
 * site's scale and 25-odd call sites keep the name.
 */
const STOCK_SIZE = /text-(xs|base|lg|xl|[2-9]xl)\b/;

test("no source file asks for a type size outside the scale", () => {
  /*
   * The third layer, and the only one that can see a missed `text-lg`. At 18px
   * that is byte-identical to `--text-lede`, and once the stock sizes are gone
   * it falls back to the 17px body step - both members of the scale, so neither
   * the size sweep nor the line-height check in `responsive.spec.ts` can tell it
   * from a deliberate one. A grep cannot miss it, does not depend on a route
   * being rendered, and costs milliseconds.
   *
   * It covers comments too, on purpose: Tailwind scans those along with code, so
   * a class name written into one is a class name in the bundle.
   */
  const offenders: string[] = [];

  for (const file of sources()) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (STOCK_SIZE.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${index + 1}  ${line.trim()}`);
        }
      });
  }

  expect(offenders, "these set type at a size the scale does not name").toEqual([]);
});

/**
 * Class names DESIGN.md rules out, as Tailwind spells them in a selector.
 *
 * The shipped CSS is what is read rather than the source, because the source is
 * not where these come from: Tailwind scans comments and markdown along with
 * code, so a class named in a docs paragraph, or in a comment explaining why
 * nothing uses it, is a class in the bundle. A source grep would report the
 * sentence; this reports the consequence.
 *
 * Naming them here is safe only because `src/index.css` excludes this directory
 * from Tailwind's scan. Without that line, writing this list generates every
 * rule in it.
 */
const BANNED = [
  ["an alpha on the muted-foreground token", String.raw`.text-muted-foreground\/70`],
  ["an alpha on the ember token", String.raw`.text-ember\/50`],
  ["a focus ring width", String.raw`.focus\:ring-2`],
  ["a focus ring colour", String.raw`.focus\:ring-ring`],
  ["a focus ring offset", String.raw`.focus\:ring-offset-2`],
  ["an outline kill on focus", String.raw`.focus\:outline-hidden`],
] as const;

test("the shipped stylesheet carries none of the banned spellings", () => {
  /*
   * The One Ring Rule and the two alpha spellings are both rules about what
   * ships, and nothing else can hold them: the ring utilities belong to
   * components this site does not use that way, and the alpha spellings are in
   * prose. Whichever file names one, the rule is broken in the same place - the
   * stylesheet a reader downloads - so that is where it is measured.
   */
  const stylesheets = readdirSync(path.resolve("dist", "assets"))
    .filter((file) => file.endsWith(".css"))
    .map((file) => path.join("dist", "assets", file));

  expect(stylesheets.length, "no stylesheet in dist - run the build first").toBeGreaterThan(0);

  const found: string[] = [];
  for (const file of stylesheets) {
    const css = readFileSync(file, "utf8");
    for (const [what, selector] of BANNED) {
      // The class as it was written, so the failure can be grepped for. The
      // selector escapes `/` and `:`; the source that named it did not.
      const written = selector.slice(1).replaceAll("\\", "");
      if (css.includes(selector)) {
        found.push(`${path.basename(file)} ships ${what} - grep the repo for ${written}`);
      }
    }
  }

  expect(found, "these reach the bundle from a comment or a docs paragraph").toEqual([]);
});
