import { execSync } from "node:child_process";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { SITE_TIME_ZONE } from "./src/lib/site";
import { contentPlugin } from "./vite-plugin-content";
import { coverVariantsPlugin } from "./vite-plugin-cover-variants";
import { pagesPlugin } from "./vite-plugin-pages";

/**
 * The date of the last commit. Since the site deploys on push to main, the
 * last commit is the last change that reached the live site.
 *
 * `%ct` is the committer date as a Unix timestamp, which carries no timezone of
 * its own, so the formatters apply the site's. Falls back to the build time if
 * git is unavailable (e.g. a source tarball with no history).
 */
function commitDate(): Date {
  try {
    const seconds = Number(execSync("git log -1 --format=%ct", { encoding: "utf8" }).trim());
    if (Number.isFinite(seconds)) return new Date(seconds * 1000);
  } catch {
    // git unavailable - fall through to the build time.
  }
  return new Date();
}

/** The commit date formatted for the footer's "last updated" line. */
function lastUpdated(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: SITE_TIME_ZONE,
  }).format(date);
}

/**
 * The commit date as the imprint's epoch stamp: the year plus the fraction of
 * it elapsed, like "J2026.67". The formula is year + dayOfYear / 365.25 kept
 * to two decimals - a house mark wearing Julian-epoch clothes, not an
 * ephemeris, so it is not to be corrected toward astronomical time.
 */
function epoch(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: SITE_TIME_ZONE,
  }).formatToParts(date);
  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = field("year");
  const dayOfYear =
    (Date.UTC(year, field("month") - 1, field("day")) - Date.UTC(year, 0, 1)) / 86_400_000 + 1;
  // Dec 31 of a leap year is day 366, which pushes the fraction past .99; the
  // stamp stays inside its own year rather than growing a third digit.
  const fraction = Math.min(Math.floor((dayOfYear / 365.25) * 100), 99);
  return `J${year}.${String(fraction).padStart(2, "0")}`;
}

/**
 * Preloads the self-hosted fonts so they start downloading with the first HTML
 * byte, in parallel with the JS bundle, rather than only once the bundled CSS
 * has parsed. Paired with the metric-matched fallbacks in `fonts.css`, this is
 * what makes the real fonts swap in fast and without a layout shift. The font
 * files are content-hashed at build time, so the links are injected from the
 * emitted bundle rather than hard-coded in `index.html`.
 */
function preloadFonts(): Plugin {
  return {
    name: "preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        // Sorted, because the bundle is keyed in the order the assets finished
        // emitting, which varies run to run. Unsorted, two builds of the same
        // source emit different HTML.
        const fonts = Object.keys(ctx.bundle)
          .filter((name) => name.endsWith(".woff2"))
          .sort();
        return {
          html,
          tags: fonts.map((name) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              href: `/${name}`,
              crossorigin: "",
            },
            injectTo: "head",
          })),
        };
      },
    },
  };
}

/**
 * The short commit id, printed under the colophon's barcode. Falls back to a
 * proof mark where git is unavailable, the same way `commitDate` falls back.
 */
function commitSha(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    if (sha) return sha;
  } catch {
    // git unavailable - fall through to the proof mark.
  }
  return "proof";
}

// One read, so the date line and the epoch stamp cannot disagree.
const pressed = commitDate();

export default defineConfig({
  define: {
    __LAST_UPDATED__: JSON.stringify(lastUpdated(pressed)),
    __EPOCH__: JSON.stringify(epoch(pressed)),
    // Set by deploy.yml from the workflow run number; null marks a local proof.
    __IMPRESSION__: JSON.stringify(process.env.IMPRESSION ?? null),
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
  plugins: [
    react(),
    tailwindcss(),
    contentPlugin(),
    preloadFonts(),
    coverVariantsPlugin(),
    pagesPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
