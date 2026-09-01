import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Album } from "../src/lib/dan-fm";

const REAL = path.resolve("src/content/dan-fm.json");
const SEED = path.resolve("src/content/dan-fm.seed.json");

/**
 * A row as the file carries it, which is an album short of its `ordinal`: the
 * numbering is derived from position by the build and is deliberately not a
 * field either file holds. Typing it in would hand every caller a `number` that
 * is `undefined` at runtime.
 */
export type LoggedAlbum = Omit<Album, "ordinal">;

/**
 * The album log the built site was made from, or an empty one when neither file
 * is committed.
 *
 * Read off the content files with the precedence `readDanFm` uses - the fetched
 * payload first, the seed fixture second - because the suite runs against
 * `dist` and cannot ask a bundle what it was built from. That inference holds
 * only for a build that was allowed to fall back to the fixture, meaning one
 * made with `DANFM_SEED=1` set: a build without it serves no albums at all, and
 * everything here then describes a page that is not there. A caller asserting
 * against these rows has to be able to tell that build apart on the page.
 *
 * Read off disk rather than out of the page so it can be computed at module
 * scope, before a browser exists.
 */
export function albumsOnDisk(): LoggedAlbum[] {
  const file = existsSync(REAL) ? REAL : SEED;
  if (!existsSync(file)) return [];

  const payload = JSON.parse(readFileSync(file, "utf8")) as { albums?: LoggedAlbum[] };
  return payload.albums ?? [];
}

/** Every album address the built site serves, in the order the file carries. */
export function albumSlugs(): string[] {
  return albumsOnDisk().map((album) => album.slug);
}
