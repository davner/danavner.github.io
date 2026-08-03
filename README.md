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
vite-plugin-content.ts  reads and validates every markdown collection at build time
src/
  content/
    profile.ts          everything the Work / About / Home pages render
    blog/*.md           one markdown file per post
    shows/*.md          one markdown file per show
  routes/               one file per page
  components/
    ui/                 shadcn/ui components — owned by this repo, edit freely
  lib/
    blog.ts             post helpers over the plugin's output
    shows.ts            sorting, year grouping, and derived show stats
  index.css             design tokens and the poster primitives
  fonts.css             self-hosted Anton / Inter / JetBrains Mono
```

Updating the résumé side of the site — a new role, a project, a skill — is editing
`src/content/profile.ts`. Nothing else needs to change.

Both `blog/` and `shows/` are markdown collections read by the same Vite plugin.
A file whose name starts with `_` is ignored, which is how each directory keeps
its own notes next to its content.

## Adding a show

Create `src/content/shows/<slug>.md`. Everything on `/shows` — the totals, the
year groups, the most-seen act, the standouts ticker — is derived from these
files, so adding a show is dropping in a file and nothing else.

`lineup` is the whole bill, top billing first. Openers count — toward the
display, and toward "bands seen".

```md
---
lineup:                         # every band, top of the bill first
  - Knocked Loose               # shown large
  - Show Me the Body            # everyone below is listed as "w/ …"
  - Speed
date: 2026-06-20                # YYYY, YYYY-MM, or YYYY-MM-DD — use what you remember
venue: Hollywood Palladium      # optional
city: Los Angeles, CA           # required
video: https://youtu.be/xxxxx   # optional, full URL — renders a Watch link
standout: true                  # optional — adds a flame and pins it to the ticker
---

Free-form markdown about the night. Optional.
```

A one-band night can skip the list and just say `title: Turnstile`.

A festival gets `type: festival` and a `title` instead, because the event is not
a band — that keeps its name out of the "bands seen" count while its optional
`lineup` still counts. `endDate` covers multi-day runs, and partial dates are
fine: `2026` renders with no day label under the 2026 heading, `2026-06` renders
as "Jun".

See `src/content/shows/_README.md` for the same reference next to the files.

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

Posts are read and validated in Node by `vite-plugin-content.ts`, so bad frontmatter
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
