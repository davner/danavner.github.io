/**
 * The small cover the vinyl and comics grids offer beside the full one, and the
 * only place its name is spelled.
 *
 * Two halves of the build have to agree on that name: the tiles put it in a
 * `srcSet`, and `vite-plugin-cover-variants.ts` derives the file that answers
 * it. They are spelled once because a `srcSet` candidate that 404s does not
 * fall back to `src` - it leaves the tile blank.
 *
 * The variants are derived rather than committed. `scripts/update-vinyl.mjs`
 * and `scripts/update-comics.mjs` delete every `.webp` in those directories
 * that is not a cover they just fetched, and their workflows commit the result,
 * so a committed variant would be deleted on the next nightly run.
 *
 * This module imports nothing, `@/` least of all: the plugin reaches it by
 * relative path from Vite's config context, where alias resolution does not
 * apply. `tsconfig.node.json` lists it for the same reason it lists
 * `show-summary.ts`, so an aliased import here fails `tsc -b`.
 */

/** A grid of covers, and the two widths its tiles choose between. */
export interface CoverGrid {
  /** The directory under `public/`, leading and trailing slash included. */
  dir: string;
  /** The width the fetch script writes every cover in it at. */
  full: number;
  /**
   * The width the variant is derived at. It has to clear the width a tile
   * settles at once `max-w-6xl` stops the page growing, because below that a
   * desktop browser at DPR 1 skips the candidate and fetches the full cover -
   * which is the cost this exists to avoid. The `COVER_SIZES` note in each
   * route works that width out.
   *
   * It does not clear every DPR 1 width: three columns just under 1024px lay a
   * tile out wider than four columns ever do, and there the full cover is
   * fetched. A third candidate for one narrow band of viewports is not worth
   * the encode.
   */
  small: number;
}

export const COVER_GRIDS: readonly CoverGrid[] = [
  // A sleeve tops out at 276px, four columns of `max-w-6xl` less its padding.
  { dir: "/img/vinyl/", full: 500, small: 300 },
  // A comic tops out at 220px, five columns of the same shell.
  { dir: "/img/comics/", full: 400, small: 250 },
];

function gridFor(src: string): CoverGrid | null {
  return COVER_GRIDS.find((grid) => src.startsWith(grid.dir)) ?? null;
}

/**
 * The path the small variant of a cover is served at, or null for a path no
 * grid derives one for.
 *
 * The suffix form is the one `public/img/me1-768.webp` already uses for the
 * home hero, so the site has one convention for "the same picture, smaller".
 */
export function smallCover(src: string): string | null {
  const grid = gridFor(src);
  if (!grid) return null;

  const name = src.slice(grid.dir.length);
  // The build walks one flat directory of `.webp` files, so anything else here
  // would be a name nothing answers.
  if (!name.endsWith(".webp") || name.includes("/")) return null;

  const stem = name.slice(0, -".webp".length);
  return stem ? `${grid.dir}${stem}-${grid.small}.webp` : null;
}

/**
 * The two candidates a cover tile offers, or null where no variant exists and
 * the tile should ship the plain `src` alone.
 *
 * Returning null rather than a one-candidate `srcSet` is deliberate: a lone
 * candidate is what the `src` already says, and saying it twice is a second
 * copy to keep true.
 */
export function coverSrcSet(src: string): string | null {
  const grid = gridFor(src);
  const small = smallCover(src);
  if (!grid || !small) return null;

  return `${small} ${grid.small}w, ${src} ${grid.full}w`;
}
