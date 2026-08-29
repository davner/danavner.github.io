import { readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import type { Plugin } from "vite";

import { COVER_GRIDS, smallCover, type CoverGrid } from "./src/lib/covers";

/**
 * The quality `update-vinyl.mjs` and `update-comics.mjs` write covers at. A
 * variant re-encodes an already-lossy file, and matching them keeps the second
 * pass from being the one that shows.
 */
const QUALITY = 82;

/**
 * Every variant one grid answers, keyed by the URL path and valued by the cover
 * it is resized from.
 *
 * The build and the dev server both read this, so the two cannot disagree about
 * which paths exist. That matters more than it looks: Playwright runs against
 * the build, so a dev-only difference is one nothing would catch.
 */
async function variantsOf(publicDir: string, grid: CoverGrid): Promise<Map<string, string>> {
  const dir = path.join(publicDir, grid.dir);

  let names: string[];
  try {
    names = await readdir(dir);
  } catch (cause) {
    throw new Error(`cover-variants: could not read public${grid.dir}`, { cause });
  }

  const sources = new Map<string, string>();
  for (const name of names) {
    const variant = smallCover(`${grid.dir}${name}`);
    if (variant) sources.set(variant, path.join(dir, name));
  }

  return sources;
}

/**
 * One cover, resized for the grid it is shown in.
 *
 * The width check is what keeps the `srcSet` honest. Both fetch scripts resize
 * to a fixed size, so every cover is exactly `grid.full` wide - and if that
 * ever stops being true, the tiles are offering the full cover under a `w`
 * descriptor it does not have, and the browser picks by a number that is a
 * lie. A cover narrower than `grid.small` would also come back upscaled, which
 * is bytes spent to add nothing.
 */
async function encodeVariant(file: string, grid: CoverGrid): Promise<Buffer> {
  const image = sharp(file);
  const { width } = await image.metadata();

  if (width !== grid.full) {
    throw new Error(
      `cover-variants: ${file} is ${width}px wide, but the tiles offer it as ${grid.full}w`,
    );
  }

  return image.resize({ width: grid.small }).webp({ quality: QUALITY }).toBuffer();
}

/**
 * Derives a grid-sized copy of every cover, into `dist` and never into git.
 *
 * The covers are written at one size for one purpose - 500px square sleeves and
 * 400px comic covers - and the grids lay them out at roughly half that.
 * Deriving the small one here rather than committing it is not a choice: the
 * nightly fetch scripts prune every `.webp` in those directories they did not
 * just write, and their workflows `git add -A` the result, so a committed
 * variant would be deleted and the deletion committed.
 *
 * `src/lib/covers.ts` owns the naming, and the tiles read it too.
 */
export function coverVariantsPlugin(): Plugin {
  let publicDir = "";

  return {
    name: "cover-variants",

    configResolved(config) {
      publicDir = config.publicDir;
    },

    async generateBundle() {
      let derived = 0;

      for (const grid of COVER_GRIDS) {
        const sources = await variantsOf(publicDir, grid);

        await Promise.all(
          [...sources].map(async ([variant, file]) => {
            this.emitFile({
              type: "asset",
              // An emitted name is relative to the out dir; the path it answers
              // at is not.
              fileName: variant.slice(1),
              source: await encodeVariant(file, grid),
            });
          }),
        );

        derived += sources.size;
      }

      console.log(`cover-variants: derived ${derived} cover(s)`);
    },

    configureServer(server) {
      /*
       * The same files, derived on demand. Without this, every tile on `/vinyl`
       * and `/comics` is blank in dev - the variants live in `dist`, and a
       * `srcSet` candidate that 404s renders nothing rather than falling back
       * to `src`.
       *
       * Derived per request rather than cached, so a local run of either fetch
       * script needs no restart. One readdir of a few dozen names is not worth
       * a staleness bug to save.
       */
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        const grid = url ? COVER_GRIDS.find((entry) => url.startsWith(entry.dir)) : undefined;
        if (!url || !grid || !url.endsWith(".webp")) return next();

        void (async () => {
          try {
            const file = (await variantsOf(publicDir, grid)).get(url);
            // The covers themselves live under the same prefix, and Vite's own
            // static handler is what serves those.
            if (!file) return next();

            const body = await encodeVariant(file, grid);
            res.setHeader("Content-Type", "image/webp");
            res.setHeader("Content-Length", body.byteLength);
            res.end(body);
          } catch (error) {
            next(error);
          }
        })();
      });
    },
  };
}
