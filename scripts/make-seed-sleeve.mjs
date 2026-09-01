#!/usr/bin/env node
/**
 * Generates the two sleeves `src/content/dan-fm.seed.json` names, into
 * `public/img/dan-fm/`.
 *
 *   node scripts/make-seed-sleeve.mjs
 *
 * Run by hand and commit the result, the same bargain `make-share-fallback.mjs`
 * takes: nothing at build time renders these, and they change only when the
 * palette does.
 *
 * They exist because the fixture is the only album log the browser suite ever
 * sees - `ci.yml` builds with `DANFM_SEED=1` - and every sleeve the page can
 * draw is behind a `cover` the fixture had none of. One on the newest album and
 * one on the oldest is what it takes to reach all of them: the newest is the
 * card on `/dan-fm` and a row in the archive under it, and the oldest is the
 * permalink `tests/routes.ts` sweeps.
 *
 * Drawn rather than borrowed. A real cover in the repo would be a licensing
 * question asked for a picture that only ever has to prove an `<img>` renders,
 * and these say plainly that they are not a record.
 *
 * The names are the load-bearing part. `update-dan-fm.mjs` prunes every sleeve
 * whose name is a 22-character Spotify id and the log does not claim, so a
 * fixture named like a real cover would be deleted by the first scheduled run
 * and the deletion committed. Anything else in this directory survives.
 */
import { writeFile } from "node:fs/promises";

import sharp from "sharp";

const DIR = new URL("../public/img/dan-fm/", import.meta.url);

/** `COVER_PX` in `update-dan-fm.mjs`: the widest a real sleeve is ever written at. */
const SIZE = 640;

// Straight from `src/index.css`.
const VOID = [8, 9, 13];
const EMBER = [230, 67, 26];

/**
 * The two of them, as fractions of the square so the geometry is readable
 * rather than counted in pixels.
 *
 * They differ in where the rings are struck from, which is what tells them
 * apart at the 56px the archive draws a sleeve at: one is a record seen
 * head-on, the other a corner of the same record, way off the edge.
 *
 * The gaps are wide for the same reason. Rings any closer together land inside
 * two or three pixels once the archive scales them down, and a thumbnail that
 * moires is a rendering fault a reader has to rule out before believing the
 * page.
 */
const SLEEVES = [
  { name: "seed-sleeve-a.webp", centre: [0.5, 0.5], glow: [0.5, -0.15], gap: 0.115 },
  { name: "seed-sleeve-b.webp", centre: [1.06, 0.04], glow: [0.12, 1.1], gap: 0.155 },
];

/** `base` moved `amount` of the way towards `over`, a channel at a time. */
function mix(base, over, amount) {
  return base.map((channel, index) => Math.round(channel + (over[index] - channel) * amount));
}

async function draw({ name, centre, glow, gap }) {
  const pixels = Buffer.alloc(SIZE * SIZE * 3);

  const [cx, cy] = centre.map((fraction) => fraction * SIZE);
  const [gx, gy] = glow.map((fraction) => fraction * SIZE);
  const ringGap = gap * SIZE;
  const glowRadius = SIZE * 0.9;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // The ember bloom the whole site paints, falling off from a point that is
      // usually just off the edge.
      const bloom = Math.max(0, 1 - Math.hypot(x - gx, y - gy) / glowRadius) ** 2 * 0.45;

      // A ring every `ringGap`, drawn as a soft band rather than a hard edge:
      // a one-pixel stroke aliases into a mess at the size the archive shows.
      const distance = Math.hypot(x - cx, y - cy);
      const across = (distance % ringGap) / ringGap;
      const ring = Math.max(0, 1 - Math.abs(across - 0.5) * 4) * 0.5;

      const colour = mix(VOID, EMBER, Math.min(1, bloom + ring));
      const offset = (y * SIZE + x) * 3;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
    }
  }

  const encoded = await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    // `COVER_QUALITY` in `update-dan-fm.mjs`, so the fixture is encoded the
    // way the thing it stands in for is.
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(new URL(name, DIR), encoded);
  console.log(`seed sleeve: wrote public/img/dan-fm/${name} (${encoded.length} bytes)`);
}

for (const sleeve of SLEEVES) await draw(sleeve);
