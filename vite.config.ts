import { execSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { contentPlugin } from "./vite-plugin-content";
import { sharePagesPlugin } from "./vite-plugin-share-pages";

/**
 * The date of the last commit, formatted for the footer's "last updated" line.
 * Since the site deploys on push to main, the last commit is the last change
 * that reached the live site.
 *
 * `%ct` is the committer date as a Unix timestamp, which carries no timezone of
 * its own, and it is formatted in UTC. So the value is the same on every build
 * machine and the same for every visitor, rather than shifting with whoever's
 * clock happens to render it. Falls back to the build time if git is unavailable
 * (e.g. a source tarball with no history).
 */
function lastUpdated(): string {
  const format = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
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
        const fonts = Object.keys(ctx.bundle).filter((name) => name.endsWith(".woff2"));
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
 * GitHub Pages has no SPA rewrite rule, so a deep link like /blog/some-post
 * 404s on a hard refresh. Pages serves 404.html for unknown paths, so shipping
 * a copy of index.html under that name lets the client router take over.
 */
function githubPagesSpaFallback(): Plugin {
  return {
    name: "github-pages-spa-fallback",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, "dist");
      copyFileSync(path.join(outDir, "index.html"), path.join(outDir, "404.html"));
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
    githubPagesSpaFallback(),
    sharePagesPlugin(),
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
