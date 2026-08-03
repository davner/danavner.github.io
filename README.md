# danavner.com

Personal site — React, Vite, Tailwind CSS v4, and shadcn/ui, deployed to GitHub Pages.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check, then build to dist/
npm run preview  # serve the built site
```

## Where things live

```
public/              static assets served as-is (CNAME, favicon, photos)
vite-plugin-blog.ts  reads and validates the markdown posts at build time
src/
  content/
    profile.ts       everything the Work / About / Home pages render
    blog/*.md        one markdown file per post
  routes/            one file per page
  components/
    ui/              shadcn/ui components — owned by this repo, edit freely
  lib/
    blog.ts          post helpers over the plugin's output
```

Updating the résumé side of the site — a new role, a project, a skill — is editing
`src/content/profile.ts`. Nothing else needs to change.

## Adding a blog post

Create `src/content/blog/<slug>.md`. The filename becomes the URL, so
`hello-world.md` publishes at `/writing/hello-world`.

```md
---
title: Hello world
date: 2026-08-03
category: personal
summary: One or two sentences shown on the post card and used as the meta description.
tags: [writing]
draft: false
---

Post body in markdown. GitHub-flavored tables, task lists, and fenced code
blocks with syntax highlighting all work.
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Build fails without it |
| `date` | yes | `YYYY-MM-DD`; posts sort newest-first |
| `category` | yes | `work` or `personal` — drives the filter on `/writing` |
| `summary` | no | Recommended; used on cards and for link previews |
| `tags` | no | Free-form list, shown on the post page |
| `draft` | no | `true` keeps it in `npm run dev` and out of the build |

Posts are read and validated in Node by `vite-plugin-blog.ts`, so bad frontmatter
fails the build with the offending filename, and `draft: true` posts are absent
from the production bundle rather than merely hidden in the UI.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `master` and publishes `dist/`
to GitHub Pages.

**One-time setup:** in **Settings → Pages**, set **Source** to **GitHub Actions**. The
repo previously served files straight from the branch root, which would now serve the
un-built `index.html`.

The custom domain lives in `public/CNAME` so it survives every deploy. Deep links work
because the build writes a `404.html` copy of `index.html` — GitHub Pages serves it for
unknown paths and the client router takes over from there.
