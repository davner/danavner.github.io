# danavner.com

My personal site - work, writing, and a log of every show I have been to.
Live at **[danavner.com](https://danavner.com)**.

It is a static React site with no backend and no CMS. All the content is
markdown files and one TypeScript file, read and validated at build time.
If you want to fork it and make it yours, see [Making it yours](#making-it-yours).

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | [Vite](https://vite.dev) 7 | Fast dev server, sane defaults, minimal config |
| UI | [React](https://react.dev) 19 + TypeScript | Type errors catch content mistakes before the browser does |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 | CSS-first config - no `tailwind.config.js` to maintain |
| Components | [shadcn/ui](https://ui.shadcn.com) | Copied into the repo, so they are mine to edit or delete |
| Carousel | [Embla](https://embla-carousel.com) | What shadcn/ui's Carousel is built on |
| Icons | [lucide-react](https://lucide.dev) | Consistent 24px stroke set, tree-shakeable, ISC |
| Type | [Fontsource](https://fontsource.org) | Self-hosted Anton / Inter / JetBrains Mono |
| Routing | [React Router](https://reactrouter.com) 8 | Client routes, with a 404 fallback for GitHub Pages |
| Markdown | react-markdown + remark-gfm | GFM tables, task lists, fenced code |
| Highlighting | rehype-highlight | lowlight's `common` set, themed to the palette |
| Hosting | GitHub Pages | Free, already where the repo lives |

Every dependency is permissively licensed (MIT, ISC, Apache-2.0, BSD-3-Clause,
OFL-1.1 for the fonts). Nothing here phones home - no analytics, no font CDN,
no third-party scripts.

### Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, then build to dist/
npm run preview    # serve the built site
npm run typecheck  # types only, no build
npm test           # Playwright, against the production build
npm run test:ui    # the same suite, interactively
```

Node 22+. `npm test` builds nothing itself - run `npm run build` first, or let
CI do it.

## CI

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` | every push to `main` and every PR | type-check, build, then the full Playwright suite |
| `deploy.yml` | push to `main` | builds and publishes to GitHub Pages |
| `links.yml` | weekly, Mondays | external link check; opens an issue if anything is dead |

The Playwright suite runs against the **production build**, on desktop and
mobile viewports, and covers four things:

- **Behaviour** - routing, titles, the writing filter and its URL state, theme
  persistence, markdown rendering, and the derived show stats.
- **Accessibility** - axe (WCAG 2.1 A and AA) on every route in *both* themes.
  The palettes are independent, and contrast is the easiest thing to break.
- **Links and assets** - every in-site link resolves to a real route rather
  than the SPA's 404 fallback, and no image is broken.
- **No third parties** - fails if any request leaves the origin, which is what
  keeps the "nothing phones home" claim above honest.

External links are deliberately excluded from CI. They rot for reasons no
commit caused - a venue folds, a host starts refusing bots - and a red build
nobody can fix is worse than no check. They get the weekly run instead.

Content mistakes never reach the tests: the build validates every markdown
file, down to checking that a photo path actually exists in `public/`.

---

## Structure

```
public/                   served as-is (CNAME, favicon, photos)
scripts/
  optimize-photos.mjs     resizes any image and strips its EXIF
vite-plugin-content.ts    reads + validates the markdown collections at build time
vite-plugin-share-pages.ts writes one HTML file per show so links preview properly
vite.config.ts            aliases, Tailwind, the 404.html fallback
src/
  content/
    profile.ts            everything the Home / About / Career pages render
    blog/*.md             one markdown file per post
    shows/*.md            one markdown file per show
  routes/                 one file per page
  components/
    ui/                   shadcn/ui: Button, Badge, Carousel, Toggle, ToggleGroup
    framed-photo.tsx      the site's photo frame, caption printed on the image
  lib/
    blog.ts               post helpers over the plugin's output
    shows.ts              sorting, year grouping, derived show stats
    show-summary.ts       one-line show description, shared with the Node build
    show-card.ts          draws the shareable poster on a canvas
    theme.ts              light/dark store, synced with the pre-paint script
  index.css               design tokens, utilities, and the poster primitives
  fonts.css               self-hosted @font-face declarations
tests/                    Playwright: behaviour, accessibility, links
playwright.config.ts      runs the suite against the production build
```

shadcn/ui components are vendored, not installed - the CLI copies source into
`src/components/ui/` and it becomes yours. Anything built on top (the photo
strip, the solo badge, the filter row) composes those primitives rather than
reimplementing them.

### How content works

`vite-plugin-content.ts` reads `src/content/blog/` and `src/content/shows/` in
Node at build time, validates the frontmatter, and exposes each collection as a
virtual module (`virtual:blog`, `virtual:shows`). Three things fall out of doing
it there rather than in the browser:

- **Bad frontmatter fails the build**, naming the offending file, instead of
  rendering a broken card on the live site.
- **`draft: true` posts are absent from the production bundle**, rather than
  shipped and merely hidden.
- **The YAML parser never reaches the client** - it runs at build time only.

A file whose name starts with `_` is ignored, which is how each collection keeps
its own reference next to its content.

---

## Adding a blog post

Create `src/content/blog/<slug>.md`. The filename becomes the URL, so
`hello-world.md` publishes at `/blog/hello-world`.

```md
---
title: Hello world
date: 2026-08-03
category: personal
summary: One or two sentences, shown on the card and used as the meta description.
tags: [writing]
draft: false
---

Body in markdown. GFM tables, task lists, and fenced code blocks with syntax
highlighting all work.
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | |
| `date` | yes | `YYYY-MM-DD`. Posts sort newest-first. |
| `category` | yes | `work` or `personal` - drives the filter on `/blog` |
| `summary` | no | Recommended; used on cards and for link previews |
| `tags` | no | Free-form list, shown on the post page |
| `draft` | no | `true` keeps it in `npm run dev` and out of the build |

Reading time is computed from the word count. Renaming a file changes its URL.

---

## Adding a show

Create `src/content/shows/<slug>.md`. Everything on `/shows` - the totals, year
groups, most-seen act, average rating, standouts ticker - is derived from these
files, so adding a show is dropping in a file and nothing else.

`lineup` is the whole bill, **top billing first**. Openers count, toward the
display and toward "bands seen".

```md
---
lineup:
  - Knocked Loose               # tops the bill, shown large
  - Show Me the Body            # everyone below is listed as "w/ …"
  - Speed
date: 2026-06-20
venue: Hollywood Palladium
city: Los Angeles, CA
rating: 4.5
bestSong: Locked Out of Heaven
with: [Jasmine P.]
video: https://youtube.com/playlist?list=xxxxx
photos:
  - /img/shows/knocked-loose-2026/pit.jpg
  - src: /img/shows/knocked-loose-2026/stage.jpg
    alt: Underoath mid-set, lit red
    caption: Underoath
standout: true
---

Free-form markdown about the night. Optional.
```

| Field | Required | Notes |
| --- | --- | --- |
| `lineup` | shows | Every band, top billing first. No duplicates. |
| `title` | festivals | The event name. On a show, shorthand for a one-band night. |
| `type` | no | `show` (default) or `festival` |
| `date` | yes | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` - use what you remember |
| `endDate` | no | Multi-day festivals. Renders as "Nov 15–16". |
| `city` | yes | |
| `venue` | no | Omit for festivals with no fixed venue |
| `subtitle` | no | Qualifier under the heading, e.g. "Day 1" |
| `rating` | no | 0–5 🤘, decimals allowed. Omit for unrated. |
| `with` | no | List of names. Mutually exclusive with `solo`. |
| `solo` | no | `true` renders a **SOLO RUN · 1P** badge |
| `video` | no | Full URL. A YouTube playlist labels itself "Playlist". |
| `photos` | no | Objects with `src` / `alt` / `caption`. All three required. |
| `standout` | no | Adds a flame and pins it to the ticker |

Photos live in `public/img/shows/<slug>/` and render as a swipeable strip with
prev/next buttons and a counter. One photo drops the controls.

Run phone photos through the optimizer before committing them. It resizes to a
1600px long edge, re-encodes, bakes in the EXIF rotation, and then strips the
metadata - which matters, because phone photos carry GPS coordinates and a show
log is a list of places you were at a known time:

```bash
node scripts/optimize-photos.mjs shows/<show-slug> ~/Pictures/that-night
```

The first argument is a folder under `public/img/`, so the same script handles
every image on the site - `node scripts/optimize-photos.mjs about photo.jpg`
writes `public/img/about/photo.jpg`. Add `--name=<basename>` to rename a single
photo, or `--max=<px>` to cap the long edge below the 1600px default for photos
that only ever render small.

Every photo on the site carries a caption printed over the bottom of the image,
via `components/framed-photo.tsx` for one-offs and the carousel for show strips.
Show photos are validated at build time and fail without an `alt` and a
`caption`.

There is also an `add-show` skill in `.claude/skills/` that runs the whole
routine: looks up the tour name, venue, and openers, optimizes the photos,
writes their alt text and captions, and produces the markdown file.

`solo: true` renders a **SOLO RUN / 1P** badge. When the only name in `with` is
the partner named in `profile.ts`, the entry renders **MY DUO / 2P** instead.

**Every subsection is conditional** - no rating, no lineup, no companions, no
photos, no notes means nothing renders in its place. The stat row works the same
way: a figure only appears once it has something to say.

Three more details worth knowing:

- **A festival is not a band.** `type: festival` keeps the event's `title` out of
  the "bands seen" count while its `lineup` still counts.
- **Ratings fill proportionally.** `3.2` really shows a fifth of the fourth horn.
  Omitting `rating` renders nothing - unrated is not zero, and unrated entries
  stay out of the average.
- **Partial dates are fine.** `2026` renders with no day label under the 2026
  heading, `2026-06` renders as "Jun", a full date as "Jun 20".

### Sharing a show

Every entry has its own page at `/shows/<slug>` and a **Share** button.

The button renders a 1080×1920 poster from the entry on a canvas - photo,
lineup, rating, venue, date, and the URL - then hands the image and the link to
`navigator.share()`. On a phone that is one tap into an Instagram story or a
text message. Where `navigator.share` is missing, usually a desktop browser, it
falls back to a panel with the same image to save and the link to copy.

The link itself previews properly because `vite-plugin-share-pages.ts` writes a
real `dist/shows/<slug>/index.html` per show at build time, each with its own
title, description, and `og:image`. Crawlers behind iMessage, Slack, and
WhatsApp read the served HTML and never run the router, so without those files
every shared show would preview as the same generic site card.

---

## Editing the résumé side

A new role, skill, or interest is one edit to `src/content/profile.ts`.
Nothing else changes - Home, About, and Career all read from it.

The email address is stored as `emailUser` and `emailDomain` and only joined in a
click handler, so it never lands in the served HTML. `<EmailReveal />` is the only
thing that puts it on screen.

---

## Design system

Everything lives in `src/index.css`.

**Palette.** Void black, bone type, an `--ember` accent for heat and an `--ion`
cyan for readouts. Light mode is the same poster printed on newsprint. Tokens
follow the shadcn/ui naming (`--background`, `--primary`, …) so shadcn
components drop in unchanged, plus `--ember`, `--ion`, `--star`, and `--glow`.
Retheming is editing the two blocks at the top of that file.

**Type.** Anton for display, set large, uppercase and tight. Inter for body.
JetBrains Mono for readouts, labels, and code. Self-hosted latin subsets only -
three woff2 files, ~108 kB, declared by hand in `src/fonts.css` so `dist/`
carries exactly three font files rather than every subset Fontsource ships.

**Primitives.** `.display` for poster type, `.display-outline` /
`.display-outline-ember` for the stroked variants, `.readout` / `.readout-dim`
for the mono labels, `.rule-ticks` for the ruler edge, `.cut-corners` for
registration marks on hover, `.solo-badge` for the shimmer. Grain and the
starfield live in `components/backdrop.tsx`. Panels are plain `gap-px` grids
over a `bg-border` parent, which is what produces the hairline seams.

**Motion** is minimal and all of it respects `prefers-reduced-motion`.

**Contrast is enforced, not assumed.** Both palettes are checked by axe in CI.
That is not decoration: it caught white-on-ember at 3.35:1, which is why button
text on the ember accent is near-black rather than bone.

---

## Deployment

`.github/workflows/deploy.yml` builds on every push to the default branch and
publishes `dist/` to GitHub Pages.

> **One-time setup:** in **Settings → Pages**, set **Source** to
> **GitHub Actions**. Serving from the branch root would serve the un-built
> `index.html`.

The custom domain lives in `public/CNAME` so it survives every deploy. Deep
links work because the build writes a `404.html` copy of `index.html` - Pages
serves it for unknown paths and the client router takes over.

---

## Implementation notes

Things that were not obvious, in case you hit them too:

- **No theme flash.** A tiny inline script in `index.html` sets the `dark` class
  before first paint; `src/lib/theme.ts` reads back whatever it decided.
- **Route changes beat smooth scrolling.** `html { scroll-behavior: smooth }`
  means an in-flight scroll can outlive a route change and leave the next page
  scrolled part way down. `components/scroll-to-top.tsx` forces `auto`, scrolls,
  and re-asserts on the next frame.
- **Narrowing the syntax highlighter is not worth it.** rehype-highlight
  defaults to lowlight's `common` set, roughly 37 languages. Registering only
  eight measured 189.87 kB against 189.75 kB for the default - the grammars are
  tiny and the weight is all in the markdown pipeline. The default stays.
- **Heavy routes are lazy.** The markdown renderer only loads on `/blog/:slug`
  and `/shows`, keeping the initial bundle near 100 kB gzipped.
- **The footer fire is a simulation, not a sprite.** `components/pixel-fire.tsx`
  runs the Doom fire routine on a low-resolution canvas scaled up with
  `image-rendering: pixelated`. It pauses via `IntersectionObserver` when it is
  below the fold, which is most of the time, and settles into a single still
  frame under `prefers-reduced-motion`.
- **`lib/show-summary.ts` imports nothing.** It is called from the browser by
  the share button and from Node by the build that writes the per-show HTML, so
  a single `@/` alias or `virtual:` import in it would break the Node side.

---

## Making it yours

Fork it, then:

1. Replace `src/content/profile.ts` with your details.
2. Delete `src/content/blog/*.md` and `src/content/shows/*.md`, or replace them.
   Both pages handle being empty.
3. Swap the photos in `public/img/` and the favicon in `public/favicon.svg`.
4. Put your domain in `public/CNAME`, or delete it and use `<user>.github.io`.
   If you deploy to a project page rather than a user page, set `base` in
   `vite.config.ts` to `/<repo>/`.
5. Retheme via the token blocks at the top of `src/index.css`. Change the fonts
   in `src/fonts.css` and the `--font-*` values in the `@theme` block.
6. Update `.github/workflows/deploy.yml` if your default branch is not `master`.

The `/shows` section is the most reusable piece if you keep any kind of log -
it is a markdown collection, a validator, and a stats derivation, and none of it
is specific to gigs.

## License

MIT - see [LICENSE](LICENSE). Use whatever is useful.

The photographs of me in `public/img/` and the writing under
`src/content/blog/` are not covered; please swap those out.
