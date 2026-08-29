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
