#!/usr/bin/env node
/**
 * Generates `public/img/og-card.jpg`, the link-preview card for the site itself
 * (what iMessage/Slack/etc. show when danavner.com is shared). Rather than a bare
 * portrait, it is a designed card in the site's own look - the photo faded into
 * the dark, an ember bloom, the wordmark, and a line advertising the site - the
 * same treatment as the per-show share cards.
 *
 *   node scripts/make-site-card.mjs
 *
 * Run by hand and commit the result. It renders in headless Chromium (already a
 * dev dependency for the tests) so it can use the real self-hosted fonts, with
 * the fonts and the photo embedded as data URIs so the render does not depend on
 * anything installed on the machine. Then sharp downscales the 2x screenshot to
 * the 1200x630 every crawler expects.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

const b64 = (p) => readFileSync(path.resolve(p)).toString("base64");
const font = (p) => `url(data:font/woff2;base64,${b64(p)}) format("woff2")`;

const anton = font("node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2");
const inter = font("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const mono = font(
  "node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
);
const photo = `data:image/jpeg;base64,${b64("public/img/me1.jpg")}`;

// Straight from src/index.css.
const INK = "#f4f1ea";
const EMBER = "#e6431a";
const VOID = "#08090d";

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: "Anton"; src: ${anton}; }
      @font-face { font-family: "Inter"; src: ${inter}; }
      @font-face { font-family: "JBM"; src: ${mono}; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        background: ${VOID};
        position: relative;
        overflow: hidden;
        font-family: "Inter", system-ui, sans-serif;
        color: ${INK};
      }
      /* The photo lives on the right and dissolves left into the card, the way
         the show cards fade their photo into the type. */
      .photo {
        position: absolute;
        top: 0;
        right: 0;
        width: 620px;
        height: 100%;
        object-fit: cover;
        object-position: 50% 28%;
      }
      .fade {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          ${VOID} 34%,
          rgba(8, 9, 13, 0.55) 60%,
          rgba(8, 9, 13, 0) 96%
        );
      }
      /* The ember bloom the site paints at the top of every page. */
      .glow {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          58% 62% at 40% -8%,
          rgba(230, 67, 26, 0.4),
          rgba(230, 67, 26, 0) 70%
        );
      }
      .content {
        position: absolute;
        inset: 0;
        padding: 72px 80px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .wordmark {
        font-family: "Anton", sans-serif;
        font-size: 168px;
        line-height: 0.86;
        text-transform: uppercase;
      }
      .wordmark .outline {
        color: transparent;
        -webkit-text-stroke: 2px ${EMBER};
      }
      /* The site's sections, read like the offerings on a business card. */
      .sections {
        margin-top: 34px;
        font-family: "JBM", monospace;
        font-weight: 500;
        font-size: 25px;
        letter-spacing: 2px;
        color: ${INK};
      }
      .sections .dot {
        color: ${EMBER};
        margin: 0 12px;
      }
      .url {
        position: absolute;
        left: 80px;
        bottom: 60px;
        font-family: "JBM", monospace;
        font-weight: 500;
        font-size: 24px;
        letter-spacing: 6px;
        text-transform: uppercase;
        color: ${EMBER};
      }
    </style>
  </head>
  <body>
    <img class="photo" src="${photo}" alt="" />
    <div class="fade"></div>
    <div class="glow"></div>
    <div class="content">
      <div class="wordmark"><span>Dan</span><br /><span class="outline">Avner</span></div>
      <div class="sections">Software<span class="dot">&middot;</span>Blog<span class="dot">&middot;</span>Shows</div>
    </div>
    <div class="url">danavner.com</div>
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

const out = path.resolve("public/img/og-card.jpg");
const { size } = await sharp(png)
  .resize(WIDTH, HEIGHT)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(out);

console.log(`wrote public/img/og-card.jpg  ${WIDTH}x${HEIGHT}  ${Math.round(size / 1024)} kB`);
