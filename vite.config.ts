import { execSync } from "node:child_process";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { contentPlugin } from "./vite-plugin-content";
import { coverVariantsPlugin } from "./vite-plugin-cover-variants";
import { pagesPlugin } from "./vite-plugin-pages";

/**
 * The zone the site reads a timestamp in. Fixed, so the value is the same on
 * every build machine and the same for every visitor rather than shifting with
 * whoever's clock happens to render it - and the site's own rather than UTC,
 * because the author writes from Pacific and UTC files an evening commit, or the
 * nightly jobs that commit in UTC, under tomorrow's date. A footer claiming a
 * date the reader has not reached yet reads as broken.
 */
const SITE_TIME_ZONE = "America/Los_Angeles";

/**
 * The date of the last commit, formatted for the footer's "last updated" line.
 * Since the site deploys on push to main, the last commit is the last change
 * that reached the live site.
 *
 * `%ct` is the committer date as a Unix timestamp, which carries no timezone of
 * its own, so the zone is the site's. Falls back to the build time if git is
 * unavailable (e.g. a source tarball with no history).
 */
function lastUpdated(): string {
  const format = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: SITE_TIME_ZONE,
    }).format(date);

  try {
    const seconds = Number(execSync("git log -1 --format=%ct", { encoding: "utf8" }).trim());
    return format(new Date(seconds * 1000));
  } catch {
    return format(new Date());
  }
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

export default defineConfig({
  define: {
    __LAST_UPDATED__: JSON.stringify(lastUpdated()),
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
