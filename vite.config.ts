import { copyFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { contentPlugin } from "./vite-plugin-content";
import { sharePagesPlugin } from "./vite-plugin-share-pages";

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
