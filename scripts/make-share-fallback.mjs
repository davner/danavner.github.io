#!/usr/bin/env node
/**
 * Generates `public/img/share-card.jpg`, the social image used for a show that
 * has no photos of its own.
 *
 *   node scripts/make-share-fallback.mjs
 *
 * Run by hand and commit the result. The build does not call it: rendering a
 * card at build time would mean shipping a headless browser or a font stack
 * with the site, and this image only changes when the palette does.
 *
 * It is deliberately wordless. A link preview already prints the show's title
 * and description next to the image, and sharp's SVG text rendering depends on
 * whatever fonts happen to be installed, which is not a promise this repo can
 * keep across machines.
 */
import path from "node:path";

import sharp from "sharp";

// The landscape shape every social crawler expects.
const WIDTH = 1200;
const HEIGHT = 630;

// Straight from `src/index.css`.
const VOID = [8, 9, 13];
const EMBER = [230, 67, 26];

const FIRE_ROWS = 26;
const CELL = HEIGHT / 100;

const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);

function put(x, y, [r, g, b]) {
  const offset = (y * WIDTH + x) * 3;
  pixels[offset] = r;
  pixels[offset + 1] = g;
  pixels[offset + 2] = b;
}

function mix(base, over, amount) {
  return base.map((channel, i) => Math.round(channel + (over[i] - channel) * amount));
}

// Ember bloom from above the top edge, the same gradient the site paints on
// every page.
const glowX = WIDTH / 2;
const glowY = -HEIGHT * 0.18;
const glowRadius = WIDTH * 0.62;

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const distance = Math.hypot(x - glowX, y - glowY);
    const falloff = Math.max(0, 1 - distance / glowRadius);
    put(x, y, mix(VOID, EMBER, falloff ** 2 * 0.42));
  }
}

// A band of pixel fire along the bottom, run the same way the footer runs it:
// per-column fuel that drifts, then heat rising and cooling by a random amount.
const columns = Math.ceil(WIDTH / CELL);
const fuel = new Float32Array(columns).fill(31);
const cells = new Uint8Array(columns * FIRE_ROWS);

for (let frame = 0; frame < 240; frame++) {
  for (let x = 0; x < columns; x++) {
    fuel[x] = Math.min(31, Math.max(0, fuel[x] + (Math.random() - 0.5) * 4));
  }
  let previous = fuel[0];
  for (let x = 1; x < columns - 1; x++) {
    const current = fuel[x];
    fuel[x] = (previous + current * 2 + fuel[x + 1]) / 4;
    previous = current;
  }

  for (let x = 0; x < columns; x++) cells[(FIRE_ROWS - 1) * columns + x] = fuel[x];

  for (let x = 0; x < columns; x++) {
    for (let y = 1; y < FIRE_ROWS; y++) {
      const target = x + ((Math.random() * 3) | 0) - 1;
      if (target < 0 || target >= columns) continue;
      const heat = cells[y * columns + x] - ((Math.random() * 6) | 0);
      cells[(y - 1) * columns + target] = heat > 0 ? heat : 0;
    }
  }
}

const STOPS = [
  [0, [214, 48, 12], 0],
  [0.12, [214, 48, 12], 0.27],
  [0.3, [220, 55, 14], 0.69],
  [0.55, [232, 72, 20], 0.96],
  [0.78, [255, 140, 35], 1],
  [0.92, [255, 205, 90], 1],
  [1, [255, 244, 214], 1],
];

function heatColour(heat) {
  const t = heat / 31;
  let upper = STOPS.findIndex(([position]) => position >= t);
  if (upper <= 0) upper = 1;
  const [lowPos, lowRgb, lowAlpha] = STOPS[upper - 1];
  const [highPos, highRgb, highAlpha] = STOPS[upper];
  const span = highPos === lowPos ? 0 : (t - lowPos) / (highPos - lowPos);
  return {
    rgb: lowRgb.map((c, i) => c + (highRgb[i] - c) * span),
    alpha: lowAlpha + (highAlpha - lowAlpha) * span,
  };
}

const fireTop = HEIGHT - FIRE_ROWS * CELL;

for (let row = 0; row < FIRE_ROWS; row++) {
  for (let column = 0; column < columns; column++) {
    const heat = cells[row * columns + column];
    if (heat === 0) continue;
    const { rgb, alpha } = heatColour(heat);

    for (
      let y = Math.floor(fireTop + row * CELL);
      y < Math.floor(fireTop + (row + 1) * CELL);
      y++
    ) {
      for (let x = Math.floor(column * CELL); x < Math.floor((column + 1) * CELL); x++) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
        const offset = (y * WIDTH + x) * 3;
        const base = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
        put(x, y, mix(base, rgb.map(Math.round), alpha));
      }
    }
  }
}

const out = path.resolve("public/img/share-card.jpg");
const { size } = await sharp(pixels, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(out);

console.log(`wrote public/img/share-card.jpg  ${WIDTH}x${HEIGHT}  ${Math.round(size / 1024)} kB`);
