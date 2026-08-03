---
title: How this site is built
date: 2026-08-02
category: work
summary: React, Vite, and Tailwind on GitHub Pages, built to look like a gig flyer and made cheap to add to.
tags: [react, vite, tailwind, github-pages]
---

I rebuilt this site with two goals: make it look like something I would actually pin to a wall, and
make adding to it cheap. The old version was hand-written HTML with a Sass build, which was fine
until I wanted a second page.

## What inspired the look

Two things I care about share a visual language: the tour poster and the star chart. Both are stark,
mostly black, and set huge type next to small, precise data. So the site is void black with a bone
typeface, one ember accent for heat and a cyan for the readouts. Light mode is the same poster
printed on newsprint instead of pinned to a wall. If a panel reads like a gig flyer or the margin of
a sky atlas, it is doing its job.

## The stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite | Fast dev server, no config sprawl |
| UI | React + TypeScript | Familiar, and the types catch my content mistakes |
| Styling | Tailwind CSS v4 | CSS-first config, nothing to maintain |
| Components | shadcn/ui | The source lives in my repo, so I can rewrite it |
| Hosting | GitHub Pages | Free, already where the repo lives |

The best thing about shadcn/ui is that it is not a dependency. The CLI copies component source into my
repo, and from there it is mine to edit or delete. This design wanted hard edges and hairline rules,
not soft cards, so most of what I pulled in got rewritten.

## Posts are just files

There is no CMS and no database. A post is a markdown file in `src/content/blog/` with a YAML
frontmatter block for the metadata. A small Vite plugin reads the folder at build time, validates
each file, and hands the app a finished list.

Doing it at build time rather than in the browser buys three things: a bad `date` or `category` fails
the build with the filename instead of blanking a page for visitors, `draft: true` posts stay out of
the shipped bundle instead of merely hidden, and the YAML parser never reaches anyone's browser. The
filename becomes the slug, so renaming a file changes its URL.

## Deep links on GitHub Pages

Pages serves static files with no rewrite rules, so a hard refresh on `/blog/welcome` would normally
404. The standard trick is a `404.html` that is a byte-for-byte copy of `index.html`: the app boots,
the router reads the URL, and the right page renders.

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

It is a hack. It is also six lines, has no runtime cost, and means I never think about it again.
