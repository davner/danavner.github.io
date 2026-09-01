import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REAL = path.resolve("src/content/dan-fm.json");
const SEED = path.resolve("src/content/dan-fm.seed.json");

/**
 * Every album address the built site serves, newest first.
 *
 * Read off the content files with the precedence `readDanFm` uses - the fetched
 * payload first, the seed fixture second - because the suite runs against
 * `dist` and cannot ask a bundle what it was built from. That inference holds
 * only for a build that was allowed to fall back to the fixture, meaning one
 * made with `DANFM_SEED=1` set: a build without it serves no albums at all, and
 * every slug here then names a page that is not there.
 *
 * Read off disk rather than out of the page so it can be computed at module
 * scope, before a browser exists.
 */
export function albumSlugs(): string[] {
  const file = existsSync(REAL) ? REAL : SEED;
  if (!existsSync(file)) return [];

  const payload = JSON.parse(readFileSync(file, "utf8")) as { albums?: { slug: string }[] };
  return (payload.albums ?? []).map((album) => album.slug);
}
