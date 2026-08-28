import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { nowSummary, nowTitle } from "./src/lib/now-summary";
import { showHeading, showSummary } from "./src/lib/show-summary";
import { DEFAULT_SHARE_IMAGE, SHOW_FALLBACK_IMAGE, SITE_NAME, SITE_URL } from "./src/lib/site";
import { readNow, readShows } from "./vite-plugin-content";

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
 * Writes a real HTML file per shareable entry: `dist/shows/<slug>/index.html`
 * for every show, `dist/now/<date>/index.html` for every now entry.
 *
 * The site is a client-rendered SPA, so the crawlers behind iMessage, Slack,
 * WhatsApp, and Instagram see whatever is in the served HTML and nothing the
 * router does afterwards. Without this, every shared link previews as the
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
        const photo = show.photos[0]?.src ?? SHOW_FALLBACK_IMAGE;
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

      /*
       * Every now entry, current and archived alike.
       *
       * The current entry gets a file even though `/now/<its date>` redirects
       * to `/now`, and the two halves have to be read together or someone will
       * later "fix" one of them: the crawler fetches the HTML and never runs
       * the router, so this file is what makes the preview correct, while the
       * redirect is for humans, who land on `/now` showing the same entry.
       *
       * The consequence, stated so it is not filed as a bug: one entry carries
       * two titles depending on which URL you arrive by. `/now` sets
       * "Now · Dan Avner", because the front door is undated - it is always
       * whatever is current. `dist/now/<current-date>/index.html` says
       * "Now · August 27, 2026 · Dan Avner", because a permalink being dated is
       * the entire reason it exists.
       */
      const { current, archive } = readNow(root, publicDir);
      const entries = [current, ...archive].filter((entry) => entry.updated);

      for (const entry of entries) {
        const title = `${nowTitle(entry)} · ${SITE_NAME}`;
        // Never empty: `parseNowEntry` fails the build on an entry whose body
        // holds no paragraphs, so by the time `readNow` returns one there is
        // something for the preview to say.
        const description = nowSummary(entry);
        const url = `${SITE_URL}/now/${entry.updated}`;

        // The site's own card rather than the show fallback: a now entry is
        // about the person, so the portrait is the right stand-in here, which
        // is exactly what it is not for a festival.
        const photo = entry.photos[0]?.src ?? DEFAULT_SHARE_IMAGE;
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
        html = html.replace(
          /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/,
          '<meta name="twitter:card" content="summary_large_image" />',
        );

        const dir = path.join(outDir, "now", entry.updated);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "index.html"), html);
      }

      if (entries.length > 0) {
        console.log(
          `share-pages: wrote ${entries.length} now page(s) with their own link previews`,
        );
      }
    },
  };
}
