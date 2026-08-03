import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { load as parseYaml } from "js-yaml";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:blog";
const RESOLVED_ID = "\0virtual:blog";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WORDS_PER_MINUTE = 200;
const CATEGORIES = ["work", "personal"];

interface ParsedPost {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  tags: string[];
  draft: boolean;
  readingTime: number;
  body: string;
}

function fail(file: string, message: string): never {
  throw new Error(`Invalid blog post — src/content/blog/${file}: ${message}`);
}

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function parsePost(file: string, raw: string): ParsedPost {
  const match = FRONTMATTER.exec(raw);
  if (!match) fail(file, "missing a `---` frontmatter block at the top of the file");

  const data = parseYaml(match[1]);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    fail(file, "frontmatter must be a YAML mapping of keys to values");
  }
  const meta = data as Record<string, unknown>;

  const title = typeof meta.title === "string" ? meta.title.trim() : "";
  if (!title) fail(file, "frontmatter needs a `title`");

  // js-yaml turns an unquoted `2026-01-01` into a Date, so normalise both forms.
  const rawDate = meta.date;
  const date =
    rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : typeof rawDate === "string"
        ? rawDate.trim().slice(0, 10)
        : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail(file, "frontmatter needs a `date` in `YYYY-MM-DD` form");
  }
  if (Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    fail(file, `frontmatter \`date\` is not a real calendar date: ${date}`);
  }

  const category = String(meta.category ?? "").trim();
  if (!CATEGORIES.includes(category)) {
    fail(file, `frontmatter \`category\` must be one of: ${CATEGORIES.join(", ")}`);
  }

  const body = raw.slice(match[0].length).trim();
  if (!body) fail(file, "the post has no body");

  const words = body.split(/\s+/).filter(Boolean).length;

  return {
    slug: file.replace(/\.md$/, ""),
    title,
    date,
    category,
    summary: typeof meta.summary === "string" ? meta.summary.trim() : "",
    tags: asStringArray(meta.tags),
    draft: meta.draft === true,
    readingTime: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    body,
  };
}

/**
 * Reads and validates `src/content/blog/*.md` at build time and exposes the
 * result as the `virtual:blog` module.
 *
 * Doing this in Node rather than in the browser buys two things the runtime
 * version could not: malformed frontmatter fails the build instead of the live
 * page, and `draft: true` posts are genuinely absent from the production
 * bundle rather than merely filtered out after shipping.
 */
export function blogPlugin(): Plugin {
  let contentDir = "";
  let includeDrafts = false;

  function loadPosts(): ParsedPost[] {
    const files = readdirSync(contentDir).filter((file) => file.endsWith(".md"));

    return files
      .map((file) => parsePost(file, readFileSync(path.join(contentDir, file), "utf8")))
      .filter((post) => includeDrafts || !post.draft)
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  }

  return {
    name: "blog",
    enforce: "pre",

    configResolved(config) {
      contentDir = path.resolve(config.root, "src/content/blog");
      includeDrafts = config.command === "serve";
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export const posts = ${JSON.stringify(loadPosts())};`;
    },

    configureServer(server) {
      // Editing, adding, or deleting a post should refresh the browser.
      const isPost = (file: string) => file.startsWith(contentDir) && file.endsWith(".md");

      const invalidate = (file: string) => {
        if (!isPost(file)) return;
        const module = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", invalidate);
      server.watcher.on("change", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}
