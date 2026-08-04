#!/usr/bin/env node
/**
 * Prepares phone photos for the site.
 *
 *   node scripts/optimize-photos.mjs <destination> <file-or-directory>...
 *
 * `<destination>` is a folder under `public/img/`, so `about` writes to
 * `public/img/about/` and `shows/warped-2026` to `public/img/shows/warped-2026/`.
 * Pass `--name=<basename>` to rename a single photo on the way through, and
 * `--max=<px>` to cap the long edge below the default for photos that only ever
 * render small.
 *
 * Three things matter here beyond the file size:
 *
 * - EXIF is dropped. Phone photos carry GPS coordinates, and a show log is a
 *   list of places you were at a known time. That does not belong in a repo.
 * - Orientation is baked in first, so a portrait photo does not arrive sideways
 *   once the tag it depended on is gone. The rotation in that tag is honoured;
 *   the mirror is not. See `uprightPipeline`.
 * - Output is deterministic: same input, same bytes, so re-running does not
 *   churn the diff.
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

/** Long edge, in pixels. The carousel never shows one wider than this. */
const MAX_EDGE = 1600;
const QUALITY = 80;
const SOURCE_TYPES = /\.(jpe?g|png|heic|heif|webp|tiff?)$/i;

/**
 * EXIF orientations that include a mirror, mapped to the rotation-only value
 * underneath them.
 *
 * Phones write these on selfies, and twice now the mirror has been wrong: the
 * stored pixels already read correctly and flipping them left every sign in
 * frame back to front. A stored JPEG essentially never needs mirroring, so the
 * rotation is applied and the flip is dropped.
 */
/*
 * The rotation left over once the mirror is dropped.
 *
 * 5 and 7 are the two diagonal mirrors, and they are easy to get backwards.
 * Orientation 5 is a transpose - a 90° clockwise turn plus a horizontal flip -
 * so dropping the flip leaves 90°, which is tag 6. Orientation 7 is the other
 * diagonal, 270° plus a flip, so it leaves 270°, which is tag 8. Having these
 * two swapped lands the photo 180° out: upright in the frame, upside down on
 * the page.
 */
const DROP_MIRROR = { 2: 1, 4: 3, 5: 6, 7: 8 };
const ANGLE = { 1: 0, 3: 180, 6: 90, 8: 270 };

async function uprightPipeline(source) {
  const { orientation } = await sharp(source).metadata();
  const rotationOnly = DROP_MIRROR[orientation];

  // An explicit angle tells sharp not to auto-orient from the tag, so this
  // rotates the raw pixels and ignores the mirror the tag asked for.
  if (rotationOnly !== undefined) return sharp(source).rotate(ANGLE[rotationOnly]);

  // Rotation-only tags have been reliable; let sharp apply them.
  return sharp(source).rotate();
}

function kebab(name) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase() || "photo"
  );
}

function collect(target) {
  if (!existsSync(target)) throw new Error(`no such file or directory: ${target}`);
  if (!statSync(target).isDirectory()) return [target];

  return readdirSync(target)
    .filter((entry) => SOURCE_TYPES.test(entry))
    .sort()
    .map((entry) => path.join(target, entry));
}

const args = process.argv.slice(2);
const renameTo = args.find((arg) => arg.startsWith("--name="))?.slice("--name=".length);
const maxEdge = Number(args.find((arg) => arg.startsWith("--max="))?.slice("--max=".length)) || MAX_EDGE;
const [destination, ...targets] = args.filter((arg) => !arg.startsWith("--"));

if (!destination || targets.length === 0) {
  console.error(
    "usage: node scripts/optimize-photos.mjs <destination> [--name=<basename>] <file-or-directory>...\n" +
      "  <destination> is a folder under public/img/, e.g. `about` or `shows/warped-2026`",
  );
  process.exit(1);
}

const outDir = path.resolve("public/img", destination);
mkdirSync(outDir, { recursive: true });

const sources = targets.flatMap(collect);
if (sources.length === 0) {
  console.error("no images found in the given paths");
  process.exit(1);
}

const taken = new Set();
let savedBytes = 0;

if (renameTo && sources.length > 1) {
  console.error("--name renames a single photo; you passed " + sources.length);
  process.exit(1);
}

for (const source of sources) {
  let name = renameTo ? kebab(renameTo) : kebab(path.basename(source));
  // Two different source folders can both hold an IMG_0001; keep both.
  for (let n = 2; taken.has(name); n++) name = `${kebab(path.basename(source))}-${n}`;
  taken.add(name);

  const outPath = path.join(outDir, `${name}.jpg`);

  const output = await (await uprightPipeline(source))
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(outPath);

  const before = statSync(source).size;
  savedBytes += before - output.size;

  const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
  console.log(
    `${path.basename(source)} -> /img/${destination}/${name}.jpg` +
      `  ${output.width}x${output.height}  ${kb(before)} -> ${kb(output.size)}`,
  );
}

console.log(`\n${sources.length} photo(s), ${Math.round(savedBytes / 1024)} kB saved, EXIF stripped`);
console.log(`Reference them as /img/${destination}/<name>.jpg`);
