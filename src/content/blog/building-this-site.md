---
title: How this site is built
date: 2026-08-02
category: work
summary: React, Vite, Tailwind, and shadcn/ui on GitHub Pages — plus a markdown pipeline that turns a file in a folder into a published post.
tags: [react, vite, tailwind, github-pages]
---

I rebuilt this site so that adding to it is cheap. The old version was hand-written HTML with a
Sass build on top, which was fine until I wanted a second page. Here is what replaced it, and how
the blog you are reading actually works.

## The stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite | Fast dev server, sane defaults, no config sprawl |
| UI | React + TypeScript | Familiar, and the type errors catch my content mistakes |
| Styling | Tailwind CSS v4 | CSS-first config, no `tailwind.config.js` to maintain |
| Components | shadcn/ui | Components live in my repo, so I can edit them |
| Routing | React Router | Client-side routes with a 404 fallback for Pages |
| Hosting | GitHub Pages | Free, already where the repo lives |

The thing I like most about shadcn/ui is that it is not a dependency. The CLI copies component
source into `src/components/ui/`, and from that point on it is my code. When I wanted the badge to
use a monospace font, I edited the file instead of fighting a theme API.

## Posts are just files

There is no CMS and no database. A post is a markdown file in `src/content/blog/`. Each one starts
with a YAML frontmatter block that supplies the metadata:

```md
---
title: How this site is built
date: 2026-08-02
category: work
summary: One or two sentences for the card and the meta description.
tags: [react, vite]
---

The body starts here.
```

My first attempt loaded those files in the browser with `import.meta.glob` and parsed the
frontmatter at runtime. It worked, and it was quietly wrong in two ways: a typo in a `date` field
produced a blank page for visitors instead of a failed build, and posts marked `draft: true` were
filtered out of the UI but still sitting in the JavaScript bundle for anyone who looked.

So the parsing moved into a small Vite plugin that runs in Node and exposes the result as a virtual
module:

```ts
export function blogPlugin(): Plugin {
  return {
    name: "blog",
    resolveId: (id) => (id === "virtual:blog" ? "\0virtual:blog" : null),
    load(id) {
      if (id !== "\0virtual:blog") return null;
      return `export const posts = ${JSON.stringify(loadPosts())};`;
    },
  };
}
```

`loadPosts()` reads the directory, validates every file, computes a reading time from the word
count, and sorts newest-first. Moving it across the boundary bought three things:

- **Validation fails the build.** A missing `title`, a malformed `date`, or a `category` that is
  not `work` or `personal` stops CI with the offending filename. I would rather hear it from the
  build than from the live site.
- **Drafts genuinely do not ship.** `draft: true` keeps a post visible under `npm run dev` and out
  of the production bundle entirely, rather than shipping it and hiding it.
- **The YAML parser stayed home.** `js-yaml` runs at build time now, which took about 45 kB off
  what every visitor downloads.

The filename becomes the slug, which means renaming a file changes its URL. Worth remembering
before anything gets linked.

## Deep links on GitHub Pages

GitHub Pages serves static files and has no rewrite rules, so a hard refresh on `/writing/welcome`
would normally 404 — there is no such file on disk. The standard workaround is to give Pages a
`404.html` that is a byte-for-byte copy of `index.html`; the app boots, React Router reads the URL,
and the right page renders. A small Vite plugin does the copy after every build:

```ts
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
```

> It is a hack. It is also six lines, has no runtime cost, and means I never think about it again.

## What I would change

The one thing I gave up is server-rendered HTML, which means crawlers and link previews see the
shell before the app hydrates. For a personal site with a handful of pages that trade is fine.
If the writing side ever grows enough to care about, prerendering the routes at build time is a
contained change — the content is already static, it just needs to be walked.
