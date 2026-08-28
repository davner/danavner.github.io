import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve("src/content/now");

/**
 * Entry dates that carry at least `count` photos.
 *
 * No now entry has any yet, so everything the poster path does has no subject
 * to exercise. The tests over it are written and skipped with a reason rather
 * than omitted: a skip prints on every CI run, so the gap announces itself,
 * where an absent test just leaves a green suite over an unexercised path. The
 * moment an entry gains photos the skips lift on their own and nothing here has
 * to be edited.
 *
 * Read off disk rather than off the page, so this can be computed at module
 * scope and used in `test.skip` before a browser exists. A regex over the
 * frontmatter rather than a YAML parse: `js-yaml` is a dependency of the build,
 * not of the suite, and the shape being counted is one line.
 */
export function nowEntriesWithPhotos(count = 1): string[] {
  return readdirSync(DIR)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    .filter((file) => {
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(
        readFileSync(path.join(DIR, file), "utf8"),
      )?.[1];
      return (frontmatter?.match(/^\s*-\s+src:/gm)?.length ?? 0) >= count;
    })
    .map((file) => file.replace(/\.md$/, ""));
}

export const PHOTO_GAP = "no now entry has photos yet - poster path unverified";
