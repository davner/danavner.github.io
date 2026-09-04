#!/usr/bin/env node
/**
 * Generates `public/img/badge-88x31.png`, the classic web button the colophon
 * offers for linking here: a tiny gig flyer in the site's own look - press
 * black plate, ember registration ticks, the address in the mono face.
 *
 *   node scripts/make-badge.mjs
 *
 * Run by hand and commit the result, like `make-site-card.mjs`. It renders in
 * headless Chromium so it can use the real self-hosted fonts, embedded as data
 * URIs, then sharp downscales the 2x screenshot to exactly 88x31.
 *
 * This is the generator-script carve-out from the optimize-photos rule: that
 * pipeline re-encodes to resized JPEG, which is wrong on every axis for a
 * pixel-exact PNG, and a synthetic render carries no EXIF to strip.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";
import sharp from "sharp";

const WIDTH = 88;
const HEIGHT = 31;

const b64 = (p) => readFileSync(path.resolve(p)).toString("base64");
const font = (p) => `url(data:font/woff2;base64,${b64(p)}) format("woff2")`;

const mono = font(
  "node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
);

// INK/EMBER/VOID are make-site-card.mjs's conversions of the src/index.css
// tokens. RULE is not a token: it is picked by eye, brighter than the border
// token converts to, so the edge stays visible at actual 88x31 size.
const INK = "#f4f1ea";
const EMBER = "#e6431a";
const VOID = "#08090d";
const RULE = "#33363f";

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: "JBM"; src: ${mono}; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        background: ${VOID};
        border: 1px solid ${RULE};
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      /* The site's registration marks, at opposite corners like every
         interactive panel there - a button is one. */
      .tick {
        position: absolute;
        width: 5px;
        height: 5px;
      }
      .tick.tl { top: 2px; left: 2px; border-top: 1.5px solid ${EMBER}; border-left: 1.5px solid ${EMBER}; }
      .tick.br { bottom: 2px; right: 2px; border-bottom: 1.5px solid ${EMBER}; border-right: 1.5px solid ${EMBER}; }
      .address {
        font-family: "JBM", monospace;
        font-weight: 600;
        font-size: 10px;
        letter-spacing: 0.4px;
        color: ${INK};
      }
      .address .tld { color: ${EMBER}; }
    </style>
  </head>
  <body>
    <div class="tick tl"></div>
    <div class="tick br"></div>
    <div class="address">DANAVNER<span class="tld">.COM</span></div>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();

const out = path.resolve("public/img/badge-88x31.png");
const { size } = await sharp(png).resize(WIDTH, HEIGHT).png().toFile(out);

console.log(`wrote public/img/badge-88x31.png  ${WIDTH}x${HEIGHT}  ${size} B`);
