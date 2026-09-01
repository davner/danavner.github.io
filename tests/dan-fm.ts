import { existsSync, readFileSync, readdirSync } from "node:fs";
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
 * Read off the content files with the precedence `readDanFm` uses, because the
 * suite runs against `dist` and cannot ask a bundle what it was built from.
 * That mirroring is the whole contract: the two have to answer the same
 * question the same way, and when they drifted apart every case comparing the
 * page against these rows failed at once - the build serving the fixture while
 * this described the fetched log.
 *
 * Which file that is comes from `dist` rather than from `DANFM_SEED`, because
 * the variable is not reliably here to read: CI builds in one job and runs the
 * suite in another, so the process holding this has no idea what the process
 * that made the bundle was told. `dist/dan-fm/` holds one page per album the
 * build published, so the source whose slugs are the ones actually served is
 * the source the build read. A build with no album pages leaves this empty and
 * the callers stand down, which is the same answer as a log with nothing in it.
 *
 * Read off disk rather than out of the page so it can be computed at module
 * scope, before a browser exists.
 */
function servedSlugs(): Set<string> {
  const pages = path.resolve("dist/dan-fm");
  if (!existsSync(pages)) return new Set();

  return new Set(
    readdirSync(pages)
      .filter((name) => name.endsWith(".html") && name !== "index.html")
      .map((name) => name.slice(0, -".html".length)),
  );
}

export function albumsOnDisk(): LoggedAlbum[] {
  const served = servedSlugs();
  const holds = (file: string) =>
    existsSync(file) && rowsIn(file).some((album) => served.has(album.slug));

  // The fixture first only when `dist` says the build read it, so the two can
  // disagree about which log exists without this quietly picking the wrong one.
  const file = holds(SEED) ? SEED : holds(REAL) ? REAL : existsSync(REAL) ? REAL : SEED;
  if (!existsSync(file)) return [];

  return rowsIn(file);
}

/** The rows one payload file holds, or none when it holds none. */
function rowsIn(file: string): LoggedAlbum[] {
  const payload = JSON.parse(readFileSync(file, "utf8")) as { albums?: LoggedAlbum[] };
  return payload.albums ?? [];
}

/** Every album address the built site serves, in the order the file carries. */
export function albumSlugs(): string[] {
  return albumsOnDisk().map((album) => album.slug);
}
