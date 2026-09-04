# danavner.com

My personal site - work, writing, a log of every show I have been to, and
where I have travelled.
Live at **[danavner.com](https://danavner.com)**.

It is a static React site with no backend. All the content is markdown files
and one TypeScript file, read and validated at build time. The markdown can be
edited by hand or through [the admin page](#editing-from-the-browser) at
`/admin/`, which commits to this repo on your behalf - there is still no
server and no database behind any of it.

---

## Stack

| Layer        | Choice                                     | Why                                                        |
| ------------ | ------------------------------------------ | ---------------------------------------------------------- |
| Build        | [Vite](https://vite.dev) 7                 | Fast dev server, sane defaults, minimal config             |
| UI           | [React](https://react.dev) 19 + TypeScript | Type errors catch content mistakes before the browser does |
| Styling      | [Tailwind CSS](https://tailwindcss.com) v4 | CSS-first config - no `tailwind.config.js` to maintain     |
| Components   | [shadcn/ui](https://ui.shadcn.com)         | Copied into the repo, so they are mine to edit or delete   |
| Carousel     | [Embla](https://www.embla-carousel.com)    | What shadcn/ui's Carousel is built on                      |
| Icons        | [lucide-react](https://lucide.dev)         | Consistent 24px stroke set, tree-shakeable, ISC            |
| Type         | [Fontsource](https://fontsource.org)       | Self-hosted Anton / Inter / JetBrains Mono                 |
| Routing      | [React Router](https://reactrouter.com) 8  | Client routes, with a 404 fallback for GitHub Pages        |
| CMS          | [Sveltia CMS](https://sveltiacms.app)      | Git-based admin at `/admin/` - forms that commit           |
| Markdown     | react-markdown + remark-gfm                | GFM tables, task lists, fenced code                        |
| Highlighting | rehype-highlight                           | lowlight's `common` set, themed to the palette             |
| Hosting      | GitHub Pages                               | Free, already where the repo lives                         |
| Linting      | ESLint + typescript-eslint                 | Correctness only; every stylistic rule is off              |
| Formatting   | Prettier, `printWidth: 100`                | The width the codebase was already written at              |
| Hooks        | husky + lint-staged                        | Formats and lints what you staged, then type-checks        |

Every dependency is permissively licensed (MIT, ISC, Apache-2.0, BSD-3-Clause,
OFL-1.1 for the fonts). The only thing that leaves the origin is a
[GoatCounter](https://www.goatcounter.com) pageview beacon - cookie-free, no
personal data. Otherwise nothing here phones home: no font CDN, no third-party
scripts, no other analytics. `tests/links.spec.ts` fails the build if any
request goes anywhere but this origin and GoatCounter.

### Analytics, but nothing on the page

Pageviews are recorded with GoatCounter and read in its dashboard. There is no
visitor counter on the site any more.

There was one - a hit-counter odometer on the landing page - and it is gone. Not
for privacy reasons; GoatCounter is cookie-free and stores nothing personal. It
went because it could not be relied on to show a number. Ad blockers and DNS
blocklists match on domain rather than on intent, so `goatcounter.com` is on the
lists whatever it does or does not collect, and anyone running uBlock Origin,
AdGuard or Pi-hole saw a dead counter. The only real fix is proxying the read
through this domain to make it first-party, and this is static hosting with no
backend to do that with.

The same blocking applies to the recording beacon, so the dashboard sees fewer
visits than actually arrive - GoatCounter's author estimates the shortfall at
around a third. That is fine for a number nobody but me looks at. It was not
fine for a number printed on the page.

### Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check, then build to dist/
npm run preview      # serve the built site
npm run typecheck    # types only, no build
npm test             # Playwright, against the production build
npm run test:ui      # the same suite, interactively
npm run lint         # ESLint
npm run lint:fix     # ESLint, fixing what it can
npm run format       # Prettier, writing
npm run format:check # Prettier, reporting only
```

Node 22+. `npm test` builds nothing itself - run `npm run build` first, or let
CI do it.

### Formatting and linting

Prettier formats, ESLint checks correctness, and `eslint-config-prettier`
switches off every stylistic ESLint rule so the two cannot disagree about a line
break. `printWidth` is 100 - the width the codebase was already written at,
picked by measuring rather than by taste. Prettier's default of 80 would have
reformatted 50 of 74 files; 100 reformats far fewer and leaves the long tail,
which is mostly unbreakable strings, alone.

`.prettierignore` skips the generated content JSON. Those files are written by
the nightly jobs with their own `JSON.stringify` formatting, and a bot commit
landing while a hook reformats them is a fight with no upside.
`fortnite-seasons.json` is among them: hand-edited between seasons, but the
nightly job writes it at every rollover, and a bot write is a bot write.

The content markdown (`blog/`, `shows/`, `now/`) is skipped for the same
reason: the CMS writes those collections through the GitHub API, where no
pre-commit hook runs, and it preserves exactly what was typed - the first
phone-written now entry turned CI red over a trailing space. Content is data:
the build validates what matters (structure, dates, photos), and Prettier adds
nothing there but red builds.

**A pre-commit hook runs both.** `npm install` sets it up - the `prepare` script
runs husky, which points git at `.husky/`. On commit:

- `lint-staged` runs `eslint --fix` then `prettier --write` over the staged
  files only, and restages what it rewrote, so a commit lands formatted instead
  of failing over a line break. Anything ESLint cannot fix on its own fails the
  commit and names the file.
- `npm run typecheck` runs over the whole project, not just the staged files. A
  type error is rarely in the file that caused it: change a shared type and it
  is the callers that break, and those are exactly the files not in the commit.
  It costs about two seconds.

The Playwright suite is not in the hook. It needs a production build and takes
the better part of a minute, which is too much per commit - CI runs it on every
push and every PR. CI also repeats the lint and format checks, because a hook is
a convenience rather than a gate: `--no-verify` skips it.

## CI

| Workflow       | When                                    | What                                                                                                                                 |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`       | every push to `main` and every PR       | lint, format check, workflow lint (actionlint), admin-config schema check, deploy-trigger check, type-check, build, Playwright suite |
| `deploy.yml`   | push to `main`, or a data job finishing | builds and publishes to GitHub Pages                                                                                                 |
| `links.yml`    | weekly, Mondays                         | external link check; opens an issue if anything is dead                                                                              |
| `vinyl.yml`    | nightly                                 | reads the Discogs collection, commits it if it moved                                                                                 |
| `comics.yml`   | weekly, Mondays (probe - see below)     | reads the comic collection, commits it if it moved                                                                                   |
| `fortnite.yml` | nightly                                 | reads the Fortnite stats, commits them if they moved                                                                                 |
| `dan-fm.yml`   | every four hours                        | reads the album log from the sheet, commits it if it moved                                                                           |

### Why the data jobs are named in `deploy.yml`

The data jobs commit their JSON to `main`, and the site is built from those
files, so every refresh needs a rebuild to reach the page. That looks like it
should happen on its own - `deploy.yml` runs on push to `main`, and a commit is
a push.

It does not. **GitHub will not start a workflow from a push made with the
default `GITHUB_TOKEN`**, which is the loop guard, and there is no opting out of
it. So the bot commits land on `main` and the `push` trigger never sees them.

This was live for a while before anyone noticed, which is the point worth
recording: the vinyl refresh of 10 August sat on `main` from 09:08 until 16:03,
when an unrelated human push finally carried it out. Nothing was broken or red.
The data was simply as old as the last time someone happened to push.

So `deploy.yml` also triggers on `workflow_run` for Vinyl, Comics, Fortnite and
dan.fm. **A new data workflow has to be added to that list**, or its numbers
will go stale in exactly the same silent way - which is why it is no longer
something to remember. `npm run check:workflows` reads every workflow file,
finds the ones that can commit, and fails CI if any of them is missing from that
list, or if the list names a workflow that no longer exists.

Two details in there are load-bearing:

- The build is gated on `conclusion == 'success'`, since a failed data job has
  committed nothing worth publishing.
- The checkout takes `main` by name on a `workflow_run`. The SHA in that event
  is the one the _triggering_ run started from - the commit before the data job
  wrote anything - so checking it out would rebuild the tree without the refresh
  and publish it under a green tick.

The cost is a deploy on nights when a job finds nothing changed: a minute of CI
for no change. That is cheaper than a long-lived PAT to dodge the token rule,
and much cheaper than data that quietly stops updating.

The build step also exports `IMPRESSION` from `github.run_number`, which the
footer prints as the impression number - every deploy is a press run, data-job
deploys included, so the number advances several times a day on its own. A
build without the variable prints "Proof copy" instead.

The Playwright suite runs against the **production build**, on desktop and
mobile viewports, and covers four things:

- **Behaviour** - routing, titles, the writing filter and its URL state, theme
  persistence, markdown rendering, and the derived show stats.
- **Accessibility** - axe (WCAG 2.2 A and AA) on every route in _both_ themes.
  The palettes are independent, and contrast is the easiest thing to break.
- **Links and assets** - every in-site link resolves to a real route rather
  than the SPA's 404 fallback, and no image is broken.
- **No third parties** - fails if any request leaves the origin except the
  GoatCounter beacon, which keeps the claim above honest.

External links are deliberately excluded from CI. They rot for reasons no
commit caused - a venue folds, a host starts refusing bots - and a red build
nobody can fix is worse than no check. They get the weekly run instead.

Content mistakes never reach the tests: the build validates every markdown
file, down to checking that a photo path actually exists in `public/`.

---

## Structure

```
public/                   served as-is (CNAME, favicon, photos, fetched covers)
  admin/                  Sveltia CMS: index.html and config.yml, see "Editing from the browser"
  robots.txt              allows everything but /admin and /admin/, and names the sitemap
scripts/
  optimize-photos.mjs     resizes any image and strips its EXIF
  make-share-fallback.mjs draws the social image for a show with no photos
  make-site-card.mjs      draws the site's own link-preview card
  make-badge.mjs          draws the 88x31 button the colophon offers
  make-easings.mjs        solves the two spring curves behind the easing tokens
  gen-font-fallbacks.mjs  measures the fonts so fallbacks match their metrics
  update-vinyl.mjs        reads the Discogs collection nightly, saves the sleeves
  update-comics.mjs       reads League of Comic Geeks nightly, saves the covers
  update-fortnite.mjs     reads the Fortnite stats nightly, keeps a season archive
  backfill-fortnite.mjs   fills past seasons in from Epic, run by hand not by CI
  fetch-fortnite-skins.mjs downloads the render for each season's main outfit
  update-dan-fm.mjs       reads the album log from a published sheet, every four hours
  check-workflows.mjs     fails CI when a data workflow is not in the deploy trigger
eslint.config.js          the browser half, the Node half, prettier last
.prettierrc.json          printWidth 100, and .prettierignore beside it
.husky/pre-commit         lint-staged, then a whole-project type-check
.git-blame-ignore-revs    formatting-only commits, skipped by git blame
vite-plugin-content.ts    reads + validates every content collection at build time
vite-plugin-cover-variants.ts derives a smaller copy of every vinyl and comic cover, into dist
vite-plugin-pages.ts      writes a real HTML page per route, plus 404.html and sitemap.xml
vite.config.ts            aliases, Tailwind, fonts, and the footer's build date
src/
  content/
    profile.ts            everything the Home / About / Career pages render
    accounts.json         the handles the fetch scripts read
    blog/*.md             one markdown file per post
    shows/*.md            one markdown file per show
    now/*.md              one markdown file per now entry, newest is current
    vinyl.json            the record collection, written nightly from Discogs
    comics.json           the comic shelf, written nightly
    fortnite.json         the stats, written nightly and backfilled once
    fortnite-seasons.json the season calendar - rollovers by the job, names by hand
    dan-fm.json           the album log, written from a sheet every four hours
    dan-fm.seed.json      a hand-written album log, for a build asked for a full one
  routes/                 a file per page, or per pair sharing one lazy chunk
  components/
    ui/                   shadcn/ui, vendored: Badge, Button, Carousel, Checkbox,
                          Empty, Label, NavigationMenu, Popover, ScrollArea,
                          Select, Sheet, Skeleton, Toggle, ToggleGroup
    framed-photo.tsx      the site's photo frame, caption printed on the image
    source-line.tsx       "N shown · Read from <source> <date>", on every fetched page
    route-boundary.tsx    recovers a lazy route whose chunk a deploy deleted
    scrolling-text.tsx    a tile line that slides to reveal its tail when it overflows
    filter-toggle.tsx     the filter pills, and the one place a control's height lives
    select-control.tsx    the single-choice control, on shadcn's Select
    fact-line.tsx         a detail page's own facts, set under its title
    share.tsx             the share sheet, whatever the subject is
    share-show.tsx        a show as a share subject
    share-now.tsx         a now entry as a share subject
  lib/
    blog.ts               post helpers over the plugin's output
    shows.ts              sorting, year grouping, derived show stats
    show-summary.ts       one-line show description, shared with the Node build
    card-canvas.ts        the sheet, the palette, and the marks both cards share
    show-card.ts          composes the kit into a show's poster
    now-card.ts           composes the kit into a now entry's poster
    now-summary.ts        a now entry's title, date and excerpt, shared with the Node build
    dates.ts              the month table and the long date, one for each summary
    vinyl.ts              filtering, sorting, and derived collection stats
    comics.ts             the shelves, and the issue counts derived from them
    fortnite.ts           windows, playlists, placement tiers, and the deltas
    now.ts                the current entry and its archive
    site.ts               the nav, shared by the header, footer and tests
    stale-chunk.ts        the once-only guard behind route-boundary.tsx
    photo.ts              the Photo type, shared by the markdown collections
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

`vite-plugin-content.ts` reads every collection in Node at build time,
validates it, and exposes it as a virtual module:

| Source                                            | Module             | Written by                    |
| ------------------------------------------------- | ------------------ | ----------------------------- |
| `content/blog/*.md`                               | `virtual:blog`     | you                           |
| `content/shows/*.md`                              | `virtual:shows`    | you                           |
| `content/now/*.md`                                | `virtual:now`      | you                           |
| `content/vinyl.json`                              | `virtual:vinyl`    | `update-vinyl.mjs`, nightly   |
| `content/comics.json`                             | `virtual:comics`   | `update-comics.mjs`, nightly  |
| `content/fortnite.json` + `fortnite-seasons.json` | `virtual:fortnite` | the job; you name the seasons |

The generated files are validated exactly as strictly as the hand-written ones,
which is the point: a fetch that half-worked is the likeliest way bad data gets
in. The Fortnite reader also refuses figures that cannot be true - more wins
than matches, a negative death count - because a stat board is only worth
anything if it will not render nonsense. Three things fall out of doing all this
in Node rather than in the browser:

- **Bad frontmatter fails the build**, naming the offending file, instead of
  rendering a broken card on the live site.
- **`draft: true` posts are absent from the production bundle**, rather than
  shipped and merely hidden.
- **The YAML parser never reaches the client** - it runs at build time only.

A file whose name starts with `_` is ignored, which is how each collection keeps
its own reference next to its content.

---

## Editing from the browser

`/admin/` is [Sveltia CMS](https://sveltiacms.app): a login and three forms -
blog posts, shows, and the now page - that commit to this repo through the
GitHub API when you hit Save. The site stays static; the CMS is a single script
on one page, and everything downstream (the build-time validation, the deploy
workflow) runs off the commit exactly as if it were pushed by hand.

The two files behind it are `public/admin/index.html` and
`public/admin/config.yml`. The config mirrors the frontmatter schemas below;
the build-time validator stays the backstop for anything a form rule misses.

Details that took deliberate decisions, so they do not get undone casually:

- **Sign in with GitHub** goes through the
  [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) worker at
  `sveltia-cms-auth.danavner.workers.dev` (named by `base_url` in the config),
  which holds the OAuth app credentials and is locked to `danavner.com` via
  its `ALLOWED_DOMAINS` secret. The fallback stays available: **Sign In Using
  Access Token** with a fine-grained personal access token scoped to this one
  repository with read/write on Contents, generated at
  [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
  Either way the credential lives in the browser's local storage and the CMS
  talks to `api.github.com` directly.
- **Photo uploads are optimized in the browser** before they are committed:
  resized to the same 1600px long edge `scripts/optimize-photos.mjs` uses,
  re-encoded to WebP, and stripped of EXIF (phone photos carry GPS) as a side
  effect of the re-encode. Hand-added photos still go through the script.
- **A show's filename is built at creation** from the Slug field plus the City
  and Date fields: type just the headliner or festival (`knocked-loose`,
  `warped-tour-day-1`) and the CMS appends the city and year on save, e.g.
  `knocked-loose-los-angeles-ca-2026`. That is the
  `<headliner-or-festival>-<city>-<year>` convention hand-written files follow,
  except the city keeps its state suffix because Sveltia slugifies the whole
  City field. Older files drop the state part and that is fine - filenames are
  per-entry stable, and the filename is the URL.
- **Optional patterns admit the empty string** (`endDate`, `video`). Sveltia
  validates patterns even on empty optional fields, so a strict pattern would
  block every save that leaves the field blank.
- **CMS commits trigger the deploy.** They are made with your token, not the
  bot's `GITHUB_TOKEN`, so the push trigger in `deploy.yml` fires normally -
  none of the `workflow_run` plumbing below applies to them.
- The admin page loads the CMS bundle from unpkg, **pinned to an exact version
  with an SRI hash** - a modified or newer file refuses to run until the pin
  and hash are bumped together (the update commands are in
  `public/admin/index.html`). That is the one third-party script anywhere on
  this site, confined to `/admin/` - the promise that visitor-facing pages
  phone home to nobody still holds, and `tests/links.spec.ts` still enforces
  it on every route it sweeps. CI validates `config.yml` against the schema
  that same version of `@sveltia/cms` ships (`npm run check:admin`), so the
  devDependency in `package.json` must move together with the pinned script
  tag.

## Adding a blog post

Create `src/content/blog/<slug>.md` - by hand, or with the form at `/admin/`.
The filename becomes the URL, so `hello-world.md` publishes at
`/blog/hello-world`.

```md
---
title: Hello world
date: 2026-08-03
category: personal
summary: One or two sentences, shown on the card and used as the meta description.
tags: [writing]
draft: false
photos: # optional; alt and caption required on each
  - src: /img/blog/hello-world/table.jpg
    alt: A long table from above, plates cleared, one candle still going
    caption: The end of it
---

Body in markdown. GFM tables, task lists, and fenced code blocks with syntax
highlighting all work.
```

| Field      | Required | Notes                                                 |
| ---------- | -------- | ----------------------------------------------------- |
| `title`    | yes      |                                                       |
| `date`     | yes      | `YYYY-MM-DD`. Posts sort newest-first.                |
| `category` | yes      | `work` or `personal` - drives the filter on `/blog`   |
| `summary`  | no       | Recommended; used on cards and for link previews      |
| `tags`     | no       | Free-form list, shown on the post page                |
| `photos`   | no       | Same rules and same carousel as a show                |
| `draft`    | no       | `true` keeps it in `npm run dev` and out of the build |

Reading time is computed from the word count. Renaming a file changes its URL.

Markdown can embed an image inline with `![]()`, but nothing checks those - no
required alt text, no required caption, and no build-time check that the file is
there. Use `photos` when the pictures are part of the post rather than an
illustration inside it: they are validated like every other photo on the site and
render in the same carousel, below the writing. The carousel itself is loaded on
demand, so a post without photos never fetches it.

A post overtaken by events gets a dated editor's note, never a rewrite: a
blockquote opening `Editor's note, <date>.` renders as a remainder stamp - a
hairline box with a rotated REMAINDERED mark - instead of the pull quote every
other blockquote gets.

```md
> Editor's note, August 2026. The build this post describes has since been
> replaced; the reasoning below still holds.
```

---

## Adding a show

Create `src/content/shows/<slug>.md` - by hand, with the form at `/admin/`, or
with the `add-show` skill. Everything on `/shows` - the totals, year
groups, most-seen act, average rating, standouts ticker - is derived from these
files, so adding a show is dropping in a file and nothing else.

The slug convention for hand-written files is
`<headliner-or-festival>-<city>-<year>`, with `-day-1` / `-day-2` for
multi-day festivals. The admin's New Show form builds it automatically: type
just the identity part in the Slug field and the city and year are appended on
save (see "Editing from the browser" above).

`lineup` is the whole bill, **top billing first**. Openers count, toward the
display and toward "bands seen".

```md
---
lineup:
  - Knocked Loose # tops the bill, shown large
  - Show Me the Body # everyone below is listed as "w/ …"
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

| Field      | Required  | Notes                                                                                                   |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `lineup`   | shows     | Every band, top billing first. No duplicates.                                                           |
| `title`    | festivals | The event name. On a show, shorthand for a one-band night.                                              |
| `type`     | no        | `show` (default) or `festival`                                                                          |
| `date`     | yes       | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` - use what you remember                                              |
| `endDate`  | no        | Multi-day festivals. Renders as "Nov 15–16".                                                            |
| `city`     | yes       |                                                                                                         |
| `venue`    | no        | Omit for festivals with no fixed venue                                                                  |
| `capacity` | no        | How many the place holds for a night like this. Confirm it; never guess.                                |
| `subtitle` | no        | Qualifier under the heading, e.g. "Day 1"                                                               |
| `rating`   | no        | 0–5 🤘, decimals allowed. Omit for unrated.                                                             |
| `with`     | no        | List of names. Only ever one of `with` / `duo` / `solo`.                                                |
| `duo`      | no        | `true` renders the **MY DUO · 2P** badge without typing the partner's name. Only ever one of the three. |
| `solo`     | no        | `true` renders a **SOLO RUN · 1P** badge. Only ever one of the three.                                   |
| `video`    | no        | Full URL. A YouTube playlist labels itself "Playlist".                                                  |
| `setlists` | no        | `{ band, url }` pairs. Each `band` must be in `lineup`. Renders as per-band buttons.                    |
| `photos`   | no        | Objects with `src` / `alt` / `caption`. All three required.                                             |
| `standout` | no        | Adds a flame and pins it to the ticker                                                                  |

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

`solo: true` renders a **SOLO RUN / 1P** badge. `duo: true` renders the
**MY DUO / 2P** badge for the partner named in `profile.ts` without typing her
name - the preferred way to log a night for two, though a `with` list whose
only name is the partner still renders the same badge.

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

### Sharing a show, or a now entry

Both have their own page and a **Share** button, and both open the same panel -
`components/share.tsx`, with `share-show.tsx` and `share-now.tsx` as the two
adapters that say what the subject is.

The panel renders a 1080×1920 poster from the entry on a canvas and offers it
and the link as **separate** actions. What goes on the poster is the only part
that differs:

| Subject                    | The poster carries                                                           |
| -------------------------- | ---------------------------------------------------------------------------- |
| A show                     | Photo, name, tour, openers, rating, venue, date, and the URL                 |
| A now entry with photos    | Photo, the entry's date set large, as much of the prose as fits, and the URL |
| A now entry with no photos | Nothing - the sheet offers the link alone                                    |

**A now entry without photos shares as a link.** Without the photo the top third
of the card is empty and the biggest thing left on it is a date, which is a
screenshot of a calendar rather than something worth sending.

**The poster never quietly claims to be the whole entry.** It takes whole
paragraphs while they fit, so a cut never lands mid-sentence, and when anything
was dropped the last line takes an ellipsis _and_ the footer reads **READ THE
REST AT** rather than **READ IT AT**. An ellipsis says something is missing; the
footer is what says where to get it.

**A card that cannot be drawn still offers the link.** The link actions render
in every state of the panel - building, ready, and failed - because a poster
that failed to render is not a reason to withhold the one thing the panel can
always do.

That separation of poster and link is the whole design. Handing
`navigator.share()` a payload with a file _and_ a URL _and_ a body of text lets
each app decide what to do with all three, and Messages decides to stack them,
so you get a full-height poster, the entire lineup as a paragraph, and the link
underneath. Sending one thing at a time means an Instagram story gets the poster
and a text message gets a link that previews itself. On a desktop, where
`navigator.share` is usually missing, the panel offers the same poster to save
and the link to copy.

The link itself previews properly because `vite-plugin-pages.ts` writes a
real `dist/shows/<slug>.html` per show and a `dist/now/<date>.html` per now
entry at build time, each with its own title, description, `rel=canonical`,
and `og:image`. A page with a photo of its own also gets that photo's
`og:image:alt` and its real `og:image:width` and `og:image:height`, measured
from the file with sharp at build time so the card is never announced at the
wrong shape. A page with no photo falls back to a share card and keeps the
tags `index.html` ships: both cards are drawn 1200x630, and the alt there
describes the site card. A remote `http(s)` image gets an alt and no
dimensions, because measuring one would mean a network fetch during the build.
Crawlers behind iMessage, Slack, and WhatsApp read the served HTML
and never run the router, so without those files every shared link would preview
as the same generic site card.

#### Why a Spotify link looks better than an image, and where it does not

Two different mechanisms get confused for each other.

**In Messages, WhatsApp, Slack, Discord** a Spotify link expands into a card
because Spotify serves Open Graph tags and the app fetches them. That is exactly
what the per-show HTML above does, so **sending the link already behaves the
same way** - the show's photo, its title, and its summary, rendered by the
receiving app. Nothing more is needed there.

**In an Instagram story** Spotify gets a _tappable_ sticker, and that is not Open
Graph. It is Instagram's native Sharing to Stories integration: the app writes
`com.instagram.sharedSticker.stickerImage` and
`com.instagram.sharedSticker.contentURL` to the system pasteboard and opens
`instagram-stories://share?source_application=<Meta App ID>`. The `contentURL` is
what becomes the link.

That path needs a native app, a registered Meta App ID, and Meta's approval.
`navigator.share()` cannot write pasteboard sticker keys or pass an app ID, so a
static site has no route to it - the image arrives in the story editor as a
plain photo. Instagram also ignores anything embedded in the image itself, and
feed captions do not linkify.

So the honest split: **the link is already as good as Spotify's; the image can
never be.** The workarounds are adding a link sticker by hand in the story
editor, or putting a QR on the poster so the picture leads somewhere on its own
(see `TODO.md`).

`og:image` is the show's first photo. A show with no photos gets
`public/img/share-card.jpg` instead of the site portrait, because a festival
link that previews as a headshot looks like the wrong link. That image is
generated once by `scripts/make-share-fallback.mjs` and committed; the build
does not call it, since rendering a card at build time would mean shipping a
headless browser or a font stack with the site.

---

## The record collection

`/vinyl` is the one page whose content nobody writes. It is the Discogs
collection for the user `dnafam`, read nightly by `scripts/update-vinyl.mjs`,
committed as `src/content/vinyl.json`, and validated at build time like
everything else under `src/content/`.

### Why it is committed rather than fetched

The obvious version of this page calls the Discogs API from the browser on
load. It cannot work here, for three reasons in descending order of how binding
they are:

1. **The interesting half needs a token.** Unauthenticated,
   `/users/dnafam/collection/folders` returns a single "All" folder and
   `/collection/value` returns nothing. The Dan/Alexis split and every value
   stat are authenticated reads, and a token cannot ship in a client bundle.
2. **The site does not phone home.** `tests/links.spec.ts` fails if any request
   leaves the origin except the GoatCounter beacon. A live Discogs call breaks
   the test and the claim it protects.
3. **The sleeves are Discogs' bandwidth.** Hotlinking their CDN for every
   visitor is not ours to spend, so the covers are downloaded, squared off to
   500px WebP, and served from `public/img/vinyl/`.

A failed read writes nothing, so the last good collection stays committed and
keeps showing, and the file only changes when the shelf actually moved.

### Running it

```sh
DISCOGS_TOKEN=... node scripts/update-vinyl.mjs
```

The token is a personal access token from
[discogs.com/settings/developers](https://www.discogs.com/settings/developers).
CI reads it from the `DISCOGS_TOKEN` repository secret; the workflow skips the
fetch entirely when the secret is missing, because a tokenless run would commit
a payload with the owner filter and every price stripped out.

Whose record is whose comes from the Discogs folder it sits in - a folder named
`Dan` becomes the `dan` filter, `Alexis` becomes `alexis`. Adding a third
folder adds a third button with no code change. A record left in Discogs'
`Uncategorized` folder still counts in the totals but belongs to nobody.

### The valuation is whole-collection only, and the page says so

Discogs values a _collection_. It will not value a record, and it will not
value a folder.

The endpoint that prices one release, `/marketplace/price_suggestions`, is
gated behind seller privileges - on a buyer's account it returns an empty
object for every release, which is exactly what it did here on the first run.
So there is no per-record number to sum, and therefore no way to answer "what
is Alexis' shelf worth".

`/users/dnafam/collection/value` does work, and returns a low, median, and high
figure for everything together, pre-formatted with a currency symbol. Those are
carried through as strings rather than parsed and reformatted.

Because they cannot follow the owner filter, they are deliberately **not** in
the stat grid. They sit in their own block under a heading that names the count
they cover ("All 51 records"), so filtering down to Alexis' nine never leaves a
seventeen-hundred-dollar figure sitting next to them. `tests/site.spec.ts`
asserts that heading still reads the full count after the filter is applied.

Everything in the stat grid above it - records, discs, artists, labels, colored
wax - is computed in the browser from the filtered list, so those all do follow
the filter.

---

## The comic shelf

`/comics` is the record collection's twin: `scripts/update-comics.mjs` reads
League of Comic Geeks nightly, writes `src/content/comics.json`, saves the covers
into `public/img/comics/`, and commits both. Same reasoning as Discogs - the
site's standing promise is that nothing phones home, so the fetch happens in CI
and the result is committed.

It can also be run by hand, which is the fallback if CI ever stops being able to
reach the source:

```sh
node scripts/update-comics.mjs
```

No API key, because there is no API. League of Comic Geeks has never published
one, so the script talks to the same endpoint their own front end does and parses
what comes back. The header of the script explains why that is not a smaller
commitment than the npm library it replaced, which had already drifted.

### Keep the browser profile current - it is load-bearing

The site is behind Cloudflare, which scores how a client looks and where it is
calling from. A plain `curl` gets 403 from anywhere; `impit` presents a real
Chrome TLS handshake and gets 200. That part was always fine.

What was not fine: `impit`'s `browser: "chrome"` alias resolves to **Chrome
124**, released early 2024, and sends a matching two-year-old user agent. From a
home connection that passes - every profile impit offers is answered 200 there.
From a GitHub runner's datacenter address, where the score starts marginal, the
stale user agent was the signal that tipped it, and the job returned nothing but
403s.

Pinning a current profile fixed it. So **bump `browser:` in
`scripts/update-comics.mjs` when impit ships a newer one** - the whole reason
this broke is that a profile pinned by default aged out, and it will age out
again.

That fix has a ceiling, and 2026-08-24 found it. After months of green the job
went back to 403 on every request, and this time it is not a score any client
change can nudge: from a runner, every URL on the site - the homepage included -
comes back as the site's own branded "Restricted" block page, served at the
Cloudflare edge without ever asking the origin, with no challenge issued and no
cookie handed out. A current Chrome profile, Firefox's TLS stack, a cookie jar
warmed on the homepage, realistic headers, HTTP/3 (which never even connects
from a runner), an XHR-shaped request aimed straight at the data endpoint the
way the site's own front end calls it, spoofed X-Forwarded-For/X-Real-IP, and
an honest self-identifying User-Agent naming this site and a contact address
were each tried from CI on 2026-08-27 and refused identically, while the same
script read the whole shelf from a home connection the same day - and impit's
remaining profile families rule themselves out from home, where ios18 fails
the TLS handshake and okhttp is 403 before any datacenter enters the picture. That is a hard block on the runners' address range, and a rule
that never challenges offers nothing to pass. If the nightly job stays red, the
options are an egress that is not a datacenter (a self-hosted runner or a
tailnet exit at home), running the script locally now and then, or waiting to
see whether the site-side setting that flipped abruptly flips back.

Two things worth keeping from working the first incident out:

- **A real browser is not the answer.** Headless Chrome is refused instantly on
  its default user agent - `HeadlessChrome` is a 403 every time - and with a
  spoofed one it lands exactly where impit already lands. It is issued no
  `cf_clearance` cookie either, because there is no challenge to clear. It knows
  nothing impit does not, and costs a 150 MB Chromium in CI.
- **The failure used to be invisible.** The script warned and exited 0, so the
  workflow went green having committed nothing - identical to a night where the
  shelf had not changed. `comics.json` had only ever been committed by hand while
  `vinyl.json` was committed by the bot nightly, from the same CI. Both scripts
  now exit non-zero when they read nothing, which is what made this diagnosable
  at all.

Discogs has a real API and does not care what you look like or where you call
from, which is why that shelf never had any of these problems.

## The now page

`/now` is a folder of markdown files, `src/content/now/`, and it is the only
page here nothing generates. One file per entry, named `<YYYY-MM-DD>.md` for
its `updated` date: the newest entry is what the page shows, and every older
one is the timeline under it.

**A new entry is a new file** - written by hand, or with the form at `/admin/`.
Fixing something already published is an edit to that entry's file, not a new
file, which keeps a typo fix from becoming a second entry saying the same
thing. Two entries sharing an `updated` date fail the build, and deleting a
file removes it from the page - git history keeps the text.

**Every entry has a permanent address** at `/now/<YYYY-MM-DD>`, so a link keeps
meaning the entry it was sent for. `/now` stays the front door showing whatever
is current, and `/now/<the current date>` redirects there - one entry is never
live at two addresses at once. Both views are the same component in
`src/routes/now.tsx` behind one `lazy()`, because the redirect is the commonest
path a shared link takes and a second lazy identity would make it flash the
skeleton twice.

**Photos are optional.** They live in `public/img/now/<YYYY-MM-DD>/`, take the
same `src` / `alt` / `caption` objects a show's photos do, and go through
`scripts/optimize-photos.mjs` (or the CMS's in-browser resize) before they enter
the repo. The current entry renders them as a strip under the prose; archived
entries print a count instead, because the archive pane is a fixed height and a
carousel per entry would push the archive itself off a phone screen.

**A shared now link previews as itself.** `vite-plugin-pages.ts` writes a
real `dist/now/<date>.html` per entry, with that entry's date in the
title and its opening paragraph as the description - the same mechanism the
show pages use, and for the same reason: crawlers read the served HTML and
never run the router. The current entry gets a file too, even though its URL
redirects, because the crawler never follows the redirect.

One consequence worth knowing before it gets filed as a bug: **one entry has
two titles depending on which URL you arrive by.** `/now` is `Now · Dan Avner`,
because the front door is undated - it is always whatever is current.
`/now/2026-08-27` is `Now · August 27, 2026 · Dan Avner`, because being dated is
the whole reason a permalink exists.

`src/content/now/_index.md` has the frontmatter and the rest of the rules.

## Fortnite

`/fortnite` shows wins, kills, K/D and the supporting numbers for the Epic
account `danwiththeyams`, browseable by season and by playlist, with each
season's rates set against the lifetime figure underneath them.

Two files behind it:

| File                                | Written by              | Holds                                          |
| ----------------------------------- | ----------------------- | ---------------------------------------------- |
| `src/content/fortnite.json`         | the nightly job         | the numbers                                    |
| `src/content/fortnite-seasons.json` | you and the nightly job | the season calendar: names, dates, main outfit |

Both are validated at build time like every other collection. A recorded season
whose key is not in the calendar fails the build, because the calendar is where
everything except the numbers comes from.

### Setting it up

The stats endpoint is the one part of Fortnite-API behind a key.

1. Get a free key at [dash.fortnite-api.com](https://dash.fortnite-api.com).
2. Add it as the `FORTNITE_API_KEY` repository secret.
3. In Fortnite, turn on **Settings > Account and Privacy > Show on Career
   Leaderboard**. Epic defaults this off, and with it off the API answers 403 to
   everyone including you.
4. Run the `Fortnite` workflow by hand once, rather than waiting for the night.

Until that first run there is no `fortnite.json`, and the page renders an empty
state saying so. That is the same way the record shelf behaves before its first
fetch - a missing file is not a build error.

Locally:

```sh
FORTNITE_API_KEY=... node scripts/update-fortnite.mjs
```

### The season calendar

`src/content/fortnite-seasons.json` is the calendar: what each season was
called, when it ran, and the outfit worn through it. The nightly job starts
each entry and you finish it. One entry per season, newest first:

```json
{
  "key": "ch6-s1",
  "chapter": "Chapter 6",
  "season": "Season 1",
  "name": "Hunters",
  "start": "2024-12-01",
  "end": "2025-02-21",
  "main": { "name": "Jade", "id": "...", "image": "/img/fortnite/jade.webp" }
}
```

`end` is **exclusive** - the day the next season began - so consecutive ranges
meet exactly rather than leaving a day in neither. The dates are presentation:
the nightly job files numbers by `backendValue` (Epic's own sequential season
number, which the job stamps on the entries it creates), so a typo'd date
mislabels a tab rather than mis-filing a month of matches. `end` is optional
on the newest entry - the season still running has not ended - and gets filled
in automatically at the next rollover. A hand-scheduled end on the newest
entry, like ch7-s4's `2026-11-01`, is a schedule, and the rollover corrects it
to the day Epic actually shipped the next season.

`main` is the outfit worn all season. Epic's stats do not carry it, so it is
written down rather than read. Add the name and run

```sh
node scripts/fetch-fortnite-skins.mjs
```

which resolves it against Fortnite-API's cosmetics catalogue, downloads the
render into `public/img/fortnite/` as WebP with its transparency intact, and
writes the resolved id and image path back into the calendar. No key needed -
the cosmetics routes are the free half.

**Entries add themselves.** At a rollover the nightly job detects the new
season from Epic's backend numbering and prepends an entry with no `name` and
an open `end`; until then the previous newest entry stays open-ended. Fill in
`name` and `main` when you notice, and feel free to rewrite `chapter` and
`season` for a mini season ("Mini Season 2" rather than the "Season 2" the job
guessed) - but keep `key` and `backendValue`, which are the filing identity,
and never rename a `key` once stats are filed under it.

### Backfilling a season that already ended

Fortnite-API answers for two windows and no others: `lifetime`, and the season
running **right now**. Epic's own service, which it wraps, takes an arbitrary
window, and that is where the season history came from:

```sh
node scripts/backfill-fortnite.mjs --url   # prints where to get a code
EPIC_AUTHORIZATION_CODE=... node scripts/backfill-fortnite.mjs
```

**This is run by hand and never in CI.** The credential that would let a
scheduled job mint its own token is a device auth, which can log in as you - a
real key to the account rather than a scoped read-only one. A finished season is
a fixed set of numbers, so there is nothing for a nightly job to notice. Run it,
commit the JSON, let the short-lived token expire.

Epic retires its game clients without notice - `fortniteIOSGameClient` went dead
after Fortnite left the App Store - so the client is a flag: `--client=android`
or `--client=launcher`. A code only works for the client it was issued for, so
switching means getting a new one.

#### Why it is not as simple as passing the season's dates

Epic does not aggregate over the window you ask for. It compacts stats into
buckets and returns the buckets falling **wholly inside** the window, and the
big ones are per season - a whole season collapses into one bucket whose far
edge is the instant that season rolled over.

A window ending at midnight on the day the next season began does not contain
that bucket. It does not error; it answers a smaller number that looks like a
season:

| Window                                        | Matches |
| --------------------------------------------- | ------- |
| Ch6 S1, midnight boundaries                   | 42      |
| Ch6 S1, ending after the real rollover        | 443     |
| All nine seasons, midnight boundaries, summed | 846     |
| Lifetime                                      | 3765    |

Two things make it come out right:

- **`rollover` in the season calendar** - the measured instant each bucket
  closes, found by sweeping `endTime` a week at a time and binary searching each
  jump. They land on the published rollover times (Ch6 S1 at 07:00 UTC on 21
  February 2025), which is the cross-check that they are real.
- **Cumulative windows, subtracted** - every window runs from the beginning of
  time to one rollover, so only its right edge can be wrong, and a season is the
  difference between two of them. Asking for each season's own window instead
  means _both_ edges have to clear a bucket, and an hour's error on the left
  silently drops the whole season: that returned 6 matches for Ch6 S3 against
  its real 461.

The script refuses to write unless the seasons reconstruct the lifetime match
count. Every failure this went through would have been caught by that check, and
the numbers on the page now reconcile exactly: 3765 of 3765.

The `first` field on each season entry is the date its numbers start from. A
backfilled season starts from its own first day; one the nightly job saw
part-way through carries a `Tracked from ...` line on the page, because partial
numbers that look whole are worse than none.

## The album log

One album a day, typed into a published Google Sheet and read out of it by
`scripts/update-dan-fm.mjs` every four hours. The job writes
`src/content/dan-fm.json` and commits it, and `vite-plugin-content.ts` validates
that file at build time like every other collection.

The sheet is the only interface. There is no admin form and no markdown file: an
album is added, corrected or withdrawn by editing a row. The sheet's URL lives in
`src/content/accounts.json` under `danFmSheet` and is the CSV export of the
published sheet, so re-publishing it is one edit there. Nothing authenticates -
it is a public read of a page anyone with the link can see, which is also the
reason the sheet holds nothing that is not meant to be published.

### The columns

Read by name, never by position, so inserting a column in the sheet cannot shift
every field one to the left. All twenty have to be present or the run fails
before a single row is trusted:

```
Date, Artist, Album, Link, Year, Genre, Source, From, Score, Stars, Shelf,
Standout, Skip, Take, Review, Tag1, Tag2, Tag3, Later, Streak
```

`Stars` and `Streak` are read and thrown away - the score is the number that
counts, and the streak is a spreadsheet helper - but their absence means the
header is not this log's, so they are still required. Any column beyond these
twenty is ignored, so adding a working column to the sheet is safe.

`Take` and `Review` are both free text, at two different lengths. `Take` is the
verdict in a sentence or two. `Review` is the long piece, and only the album
being reviewed shows it: the front page renders the featured album's, and a list
of albums does not render any. The share poster is the one place it is cut
rather than withheld, setting up to two lines of its opening under the take.
Either may be blank.

That header check is also what catches a sheet that is no longer published,
because Google answers that with 200 and a page of HTML rather than an error.

### What a row has to say

| Outcome       | Rows                                                                                                                                                                                                                                                 | What happens                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Fatal**     | no `Date`, or one that is not a real `YYYY-MM-DD` day; two rows on one date; no `Artist` or `Album`; a `Score` or a `Later` that is not a quarter step from 1 to 5; a `Link` that is not a Spotify album link; a `Date` outside the two bounds below | the run fails and commits nothing, so the committed log keeps serving                          |
| **Held back** | a `Date` from tomorrow to seven days ahead                                                                                                                                                                                                           | left out of the payload and warned about, and picked up by the first run on or after that date |
| **Tolerated** | every other blank cell, and a `Year` nobody can read                                                                                                                                                                                                 | recorded blank                                                                                 |

Every problem is reported in one run rather than one per run, because a run
happens every four hours and finding typos one at a time would take a day.

A malformed row therefore turns the job red every four hours until the sheet is
fixed. That is the intended trade: the site keeps serving the last good log, and
a broken row is loud rather than quiet.

### If every row says its Date is not a date

The first thing to check when the log has never worked. The job wants the `Date`
cell to hold the literal text `2026-08-31`, and a spreadsheet is free to store a
date as a number and render it however its locale prefers - so a column
formatted as a date can export as `8/30/2026` and fail every row at once:

```
dan-fm: the sheet has 2 problems. The committed log stands, so the page is showing whatever it last read.
  line 2: Date "8/30/2026" is not a real YYYY-MM-DD day.
  line 3: Date "8/31/2026" is not a real YYYY-MM-DD day.
```

That is how it tells itself apart from a typo. A typo is one row and the quoted
value is wrong; this is every row, and each quoted value is the right day
written the wrong way round.

The fix is one-time and belongs in the sheet: set the `Date` column to plain
text (Format > Number > Plain text) so the cell keeps exactly what is typed,
then type the dates as `YYYY-MM-DD`. Nothing in the job changes, and the next
run picks them all up. **Worth doing before the first album is ever logged**,
because the alternative is finding out on the day the log starts.

### The two bounds on a date

A date more than seven days ahead is a mistyped year rather than a plan, and a
date before `LOG_EPOCH` in `scripts/update-dan-fm.mjs` is a mistyped year rather
than a backfill - a daily log started on a date is never extended backwards past
its own start. `LOG_EPOCH` holds a day the sheet was still empty, which is the
earliest date a row could honestly carry; **move it forward to the date of the
first row once the log has one**, which tightens it to the truth.

The bounds are deliberately not symmetric. A future date is held back rather
than refused up to a week out, because logging a day ahead is reasonable; a past
date needs no such band, because it is publishable the moment it is read.

### An empty sheet is where it starts

Zero rows is a valid answer, not a failed read, so the job says so and writes
nothing. What it refuses is zero rows while a payload with albums in it is
committed, which is a read that went wrong rather than an edit - deleting one
mistyped row is an edit, and is written out as one.

### Running it

```sh
node scripts/update-dan-fm.mjs
```

No token, no login. The one thing to know is that it writes into the repo, so
run it where a stray `src/content/dan-fm.json` will not surprise you.

### The seeded build

The job writes `src/content/dan-fm.json`, so a build made before its first
successful run has an empty log and `/dan-fm` renders four empty boxes. That is
the right answer for the live site and the wrong one for the test suite, which
sweeps every route for cursors, contrast, overflow and readout drift and can
only see what is rendered.

So `DANFM_SEED=1` builds from `src/content/dan-fm.seed.json`, a hand-written log
that nothing generates. `ci.yml`'s build job sets it and uploads that `dist` for
the Playwright job to sweep; `deploy.yml` builds without it, so the fixture never
reaches the site.

**Asking for the fixture by name is not the same as allowing it**, and the
difference is what keeps it useful:

| Build                        | Reads                                                |
| ---------------------------- | ---------------------------------------------------- |
| `DANFM_SEED=1 npm run build` | the fixture, over a fetched log if there is one      |
| `npm run dev`                | a fetched log if there is one, otherwise the fixture |
| `npm run build`              | a fetched log, otherwise nothing                     |

The dev server drops the fixture the day a real log lands, which is what someone
building against the page wants. A sweep does not, because it asked for what the
fixture holds - several albums, a score over the tape's bar, a second review -
and the fetched log is whatever was actually heard. On its first day that was one
album scoring 3.5, which is below the bar and has nothing to compare against.
Retire the fixture there too and every case written against it stops testing
anything, without one of them going red to say so.

### The schedule

Six runs a day at `7 6,10,14,18,22,2 * * *`, which is 03:07 to 23:07 in
California and an hour earlier in winter. The hours are listed rather than
written `*/4` for a reason the workflow header spells out: an album is typed in
the evening, and `*/4` puts the last evening run at 21:07 local, so anything
logged after that waits until 01:07 to reach the page.

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
registration marks on hover, `.solo-badge` for the shimmer, `.on-air-lamp` for the
glow on dan.fm's station dot. Grain and the starfield live in
`components/backdrop.tsx`. Panels are plain `gap-px` grids over a `bg-border`
parent, which is what produces the hairline seams.

**Motion** is minimal and all of it respects `prefers-reduced-motion`.

**Contrast is checked, with one known hole.** Both palettes go through axe in
CI, and it earns its place: it caught bone type on the ember accent at 3.35:1,
which is why button labels on ember are near-black rather than bone. Across the
13 routes in both themes it decides 1,896 of 2,292 contrast nodes and fails none
of them. The other 396 - 17% - come back `incomplete` rather than pass or fail,
mostly because the grain overlay in `components/backdrop.tsx` is a background
image and axe will not guess what is behind one. `color-contrast` is the only
undecided result `tests/a11y.spec.ts` tolerates; any other rule reaching no
verdict fails the build. That 17% is not covered by CI at all and has to be
measured from painted pixels by hand. `PRODUCT.md` breaks the 396 down.

---

## Deployment

`.github/workflows/deploy.yml` builds on every push to the default branch and
publishes `dist/` to GitHub Pages.

> **One-time setup:** in **Settings → Pages**, set **Source** to
> **GitHub Actions**. Serving from the branch root would serve the un-built
> `index.html`.

The custom domain lives in `public/CNAME` so it survives every deploy. Every
route the site serves has a real HTML file, so a bare request for `/vinyl`
answers 200 with that page's own meta. `404.html` is the backstop for everything
else - Pages serves it for unknown paths and the client router takes over.

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
- **Heavy routes are lazy, and the small ones are not worth splitting.** The
  markdown renderer and the syntax highlighter together outweigh the rest of the
  site - blog posts alone are 57 kB gzipped - so those routes load on demand.
  The entry bundle is about 131 kB gzipped. Folding the small pages back in was
  measured and rejected: Comics is 2 kB gzipped and Fortnite 5 kB, but making
  them eager pulls everything they _share_ into the entry too, which came to
  +24 kB. A route chunk earns its request or it does not.
- **Each page preloads its own route chunk.** Cold, the chain is HTML, then the
  entry bundle, then the route chunk - and the browser cannot see the third
  until the second has been fetched, parsed and run. `vite-plugin-pages.ts`
  writes a `modulepreload` for the route's own chunk into that route's HTML, so
  it is in flight while the entry is still parsing. The map from route to source
  module is written out rather than derived from the path: `/blog/:slug` renders
  `blog-post.tsx` and `/shows/:slug` renders `show.tsx`, so a rule that matched
  names would skip the two heaviest chunks on the site. A module that ends up in
  no chunk fails the build rather than quietly losing its preload. `404.html`
  gets none, because it stands in for every path and so has no route of its own.
- **A deploy can delete the chunk an open tab is about to ask for.** Chunk names
  are content-hashed, so a deploy writes new ones and removes the old. A tab
  opened before it still points at the old names, and clicking a lazy route used
  to render a blank page - three nightly jobs each trigger a deploy, so this
  happened most nights. `components/route-boundary.tsx` catches it and reloads
  once. The guard is a timestamp rather than a flag on purpose: the obvious
  version clears the flag when the app mounts, which happens _before_ the chunk
  fails again, and loops forever.
- **Only `index.html` preloads the home page's hero.** The photo is the home
  page's largest contentful paint and it is preloaded from the HTML, because
  React renders it and the URL otherwise does not exist until the bundle has run
  (1.5s of dead time on mobile). No other page shows it, and `index.html` is the
  only file Pages serves at `/`, so `vite-plugin-pages.ts` strips the preload out
  of every file it generates - `404.html` and each share page - and none of them
  pays 47 kB for a photo it never shows. The build fails if the markers that make
  the strip possible go missing.
- **The vinyl and comics grids offer a smaller cover, and it only pays off at
  DPR 1.** Each tile's `srcSet` names a 300w sleeve beside the 500w one and a
  250w comic cover beside the 400w one, with a `sizes` string giving the width
  the tile actually lays out at. Measured on a first load of a 1280px desktop
  viewport at DPR 1, the covers `/vinyl` fetches drop from 1280 KiB to 490 KiB
  and `/comics` from 1267 KiB to 558 KiB. On a Pixel 7 the saving is zero,
  which is worth stating rather than hiding: a tile there lays out at 189.5
  CSS px, and DPR 2.625 makes that 497 device px, so the 500w sleeve is
  already the right pick and the 400w comic cover is already under-sized. The
  win is entirely DPR 1. `vite-plugin-cover-variants.ts` derives the variants
  into `dist` and they are deliberately not committed: `update-vinyl.mjs` and
  `update-comics.mjs` delete every `.webp` in those directories that is not a
  cover they just fetched, and their workflows stage the result with
  `git add -A`, so a committed variant would be deleted on the next nightly run
  and the deletion committed. That costs about 0.3s of build time across the
  90 covers and about 1.7 MB of `dist`. The same plugin derives them on demand
  in dev, because a `srcSet` candidate that 404s leaves the tile blank rather
  than falling back to `src`.
- **Every route is a real file, and three of them are two files.**
  `vite-plugin-pages.ts` writes `about.html`, `blog/welcome.html`, and one page
  per show and per now entry, each carrying its own title, description, `og:*`
  tags and `rel=canonical`. Without them a bare request for anything but `/`
  answers 404 - humans never notice, because `404.html` boots the app anyway,
  but crawlers stop there and Lighthouse refuses to run at all. The flat name is
  what makes `/about` serve directly: the directory form costs a 301 to
  `/about/` first. `/blog`, `/shows` and `/now` also name directories this build
  fills, and nothing documents which form Pages prefers when both exist, so each
  of those is written twice with identical bytes.
- **The sitemap is generated and nothing on the site links to it.**
  `vite-plugin-pages.ts` writes `dist/sitemap.xml` from the same page list it
  just wrote files from, minus the current now entry's permalink, which
  redirects to `/now`. `public/robots.txt` names it, which is how a crawler
  finds it - and is the reason there is no link to it in the footer, because
  `tests/links.spec.ts` follows every in-site href and expects an `h1` at the
  other end. `<loc>` and nothing else: the deploy checks out at depth 1, so
  there is no per-file git history to read a `lastmod` out of.
- **The footer fire is a simulation, not a sprite.** `components/pixel-fire.tsx`
  runs the Doom fire routine on a low-resolution canvas scaled up with
  `image-rendering: pixelated`. It pauses via `IntersectionObserver` when it is
  below the fold, which is most of the time, and settles into a single still
  frame under `prefers-reduced-motion`.
- **The `lib/` modules the build reads may not import a `@/` alias or a
  `virtual:` specifier.** `show-summary.ts`, `now-summary.ts`, `routes.ts`,
  `site.ts` and `covers.ts` are each called from the browser - the share
  button, the page meta, the cover tiles - and from Node by the plugin that
  reaches them by relative path from Vite's config context,
  `vite-plugin-pages.ts` for the first four and `vite-plugin-cover-variants.ts`
  for `covers.ts`. Neither kind of specifier resolves there: `resolve.alias`
  applies to the app's module graph, not to the config bundle, and the
  `virtual:` modules do not exist yet because `contentPlugin` is what creates
  them. Bare npm specifiers are fine, which is why `now-summary.ts` can parse
  markdown with `mdast-util-from-markdown` and friends - esbuild leaves them
  external to the config bundle and Node loads them itself. `dates.ts` imports
  nothing at all, which is why the month table lives there rather than in
  either summary. The rule is enforced rather than remembered:
  `tsconfig.node.json` lists exactly these files and defines no `@` path, so an
  aliased import fails `tsc -b` before the build reaches Vite.
  `dan-fm-summary.ts` is on that list from the day it was written rather than
  from the day Node first reaches it: the constraint is invisible until an
  aliased import is already there, and by then honouring it is a refactor
  rather than a rule.

---

## License

MIT - see [LICENSE](LICENSE). Use whatever is useful.

The photographs of me in `public/img/` and the writing under
`src/content/blog/` are not covered by it.
