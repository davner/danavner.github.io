import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { showHeading, showSummary } from "./src/lib/show-summary";
import { DEFAULT_SHARE_IMAGE, SITE_NAME, SITE_URL } from "./src/lib/site";
import { readShows } from "./vite-plugin-content";

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replaces the content of a meta tag already present in index.html. */
function setMeta(html: string, selector: RegExp, value: string) {
  return html.replace(selector, (tag) =>
    tag.replace(/content="[^"]*"/, `content="${escapeAttribute(value)}"`),
  );
}

/**
 * Writes a real HTML file per show at `dist/shows/<slug>/index.html`.
 *
 * The site is a client-rendered SPA, so the crawlers behind iMessage, Slack,
 * WhatsApp, and Instagram see whatever is in the served HTML and nothing the
 * router does afterwards. Without this, every shared show link previews as the
 * generic site card. Each page is the same bundle with its own title,
 * description, and image, so the app still boots and routes normally.
 */
export function sharePagesPlugin(): Plugin {
  let root = "";
  let publicDir = "";

  return {
    name: "share-pages",
    apply: "build",

    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },

    closeBundle() {
      const outDir = path.resolve(root, "dist");
      const template = readFileSync(path.join(outDir, "index.html"), "utf8");
      const shows = readShows(root, publicDir);

      for (const show of shows) {
        const heading = showHeading(show);
        const title = `${heading} · ${SITE_NAME}`;
        const description = showSummary(show);
        const url = `${SITE_URL}/shows/${show.slug}`;
        const photo = show.photos[0]?.src ?? DEFAULT_SHARE_IMAGE;
        const image = /^https?:\/\//.test(photo) ? photo : `${SITE_URL}${photo}`;

        let html = template.replace(
          /<title>[^<]*<\/title>/,
          `<title>${escapeAttribute(title)}</title>`,
        );
        html = setMeta(html, /<meta\s+name="description"[^>]*>/, description);
        html = setMeta(html, /<meta\s+property="og:title"[^>]*>/, title);
        html = setMeta(html, /<meta\s+property="og:description"[^>]*>/, description);
        html = setMeta(html, /<meta\s+property="og:url"[^>]*>/, url);
        html = setMeta(html, /<meta\s+property="og:image"[^>]*>/, image);
        // A show always has a photo worth showing large, even if it is only
        // the site's fallback portrait.
        html = html.replace(
          /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/,
          '<meta name="twitter:card" content="summary_large_image" />',
        );

        const dir = path.join(outDir, "shows", show.slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "index.html"), html);
      }

      if (shows.length > 0) {
        console.log(`share-pages: wrote ${shows.length} show page(s) with their own link previews`);
      }
    },
  };
}
