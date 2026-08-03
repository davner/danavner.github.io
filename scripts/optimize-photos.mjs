#!/usr/bin/env node
/**
 * Prepares phone photos for the show log.
 *
 *   node scripts/optimize-photos.mjs <show-slug> <file-or-directory>...
 *
 * Writes web-sized JPEGs to `public/img/shows/<show-slug>/`. Three things
 * matter here beyond the file size:
 *
 * - EXIF is dropped. Phone photos carry GPS coordinates, and a show log is a
 *   list of places you were at a known time. That does not belong in a repo.
 * - Orientation is baked in first, so a portrait photo does not arrive sideways
 *   once the tag it depended on is gone.
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

const [slug, ...targets] = process.argv.slice(2);

if (!slug || targets.length === 0) {
  console.error("usage: node scripts/optimize-photos.mjs <show-slug> <file-or-directory>...");
  process.exit(1);
}

const outDir = path.resolve("public/img/shows", slug);
mkdirSync(outDir, { recursive: true });

const sources = targets.flatMap(collect);
if (sources.length === 0) {
  console.error("no images found in the given paths");
  process.exit(1);
}

const taken = new Set();
let savedBytes = 0;

for (const source of sources) {
  let name = kebab(path.basename(source));
  // Two different source folders can both hold an IMG_0001; keep both.
  for (let n = 2; taken.has(name); n++) name = `${kebab(path.basename(source))}-${n}`;
  taken.add(name);

  const destination = path.join(outDir, `${name}.jpg`);

  const output = await sharp(source)
    .rotate() // Applies the EXIF orientation before the tag is discarded.
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(destination);

  const before = statSync(source).size;
  savedBytes += before - output.size;

  const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
  console.log(
    `${path.basename(source)} -> /img/shows/${slug}/${name}.jpg` +
      `  ${output.width}x${output.height}  ${kb(before)} -> ${kb(output.size)}`,
  );
}

console.log(`\n${sources.length} photo(s), ${Math.round(savedBytes / 1024)} kB saved, EXIF stripped`);
console.log(`Reference them in the show's frontmatter as /img/shows/${slug}/<name>.jpg`);
