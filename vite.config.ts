import { execSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { contentPlugin } from "./vite-plugin-content";
import { sharePagesPlugin } from "./vite-plugin-share-pages";

/**
 * The date of the last commit, stamped in at build time for the footer's "last
 * updated" line. Since the site deploys on push to main, the last commit is the
 * last change that reached the live site. Falls back to the build time if git is
 * unavailable (e.g. a source tarball with no history).
 */
function lastUpdatedISO(): string {
  try {
    return execSync("git log -1 --format=%cI", { encoding: "utf8" }).trim();
  } catch {
    return new Date().toISOString();
  }
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
    __LAST_UPDATED__: JSON.stringify(lastUpdatedISO()),
  },
  plugins: [react(), tailwindcss(), contentPlugin(), githubPagesSpaFallback(), sharePagesPlugin()],
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
