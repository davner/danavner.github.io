# Show log

One markdown file per show. The filename becomes the slug. Everything at the top
of `/shows` is derived from these files: total, bands seen, venues, most-seen
act, average rating, and the year groups. Adding a show is dropping a file in
here and nothing else.

The same reference lives in the root `README.md`; this copy is here so it is next
to the files it describes. Files starting with `_` (like this one) are ignored.

## A normal show

`lineup` is the whole bill, **top billing first**. Openers count - toward the display,
and toward "bands seen".

```md
---
lineup:
  - Knocked Loose # tops the bill, shown large
  - Show Me the Body # everyone below is listed as "w/ …"
  - Speed
date: 2026-06-20
venue: Hollywood Palladium
city: Los Angeles, CA
rating: 4.5 # out of 5 horns, partials welcome
with:
  - Jasmine P.
video: https://youtu.be/xxxxx
standout: true
---

Free-form markdown about the night. Optional.
```

A one-band night can skip the list and just say `title: Turnstile`.

## Rating

`rating` is out of 5 🤘🏽 and takes any number in between - `4.5`, `3.2`, `4.75`.
The row fills proportionally, so a `3.2` really does show a fifth of the fourth
horn. Leave it off entirely and no rating renders; unrated is not the same as
zero, and unrated shows are excluded from the average at the top of the page.

## Who you went with

`with` is a list of names. Went alone? Use `solo: true` instead and the entry
gets a **SOLO RUN / 1P** badge. Setting both is an error - the build will say so.

When the only name is the partner set in `src/content/profile.ts`, the entry
renders a **MY DUO / 2P** badge instead of a list of one. Any other combination
is just names, because a duo is two players and nothing else.

## Video

`video` takes any URL. A YouTube playlist link (anything with a `list=` param)
labels itself **Playlist**; anything else labels itself **Watch**. The link sits
directly under the who-you-went-with line.

## Photos

Drop the files in `public/img/shows/<slug>/` and list them. A bare path is
enough; use the object form when you want alt text or a caption.

```yaml
photos:
  - /img/shows/warped-tour-long-beach-2026-day-1/pit.jpg
  - src: /img/shows/warped-tour-long-beach-2026-day-1/stage.jpg
    alt: Underoath mid-set, lit red # described for screen readers
    caption: Underoath # overlaid on the photo
```

They render as a swipeable strip with prev/next buttons and a counter. One photo
drops the controls. No photos, no strip at all.

Alt text falls back to a generated description, but write your own where the
photo actually shows something.

## Setlists

`setlists` links each band to its setlist.fm page for the night. It is a list of
`{ band, url }` pairs, and every `band` has to be a name from `lineup` - a
button never points at a band the entry does not claim to have seen.

```yaml
setlists:
  - band: Bilmuri
    url: https://www.setlist.fm/setlist/bilmuri/2026/...
  - band: The Home Team
    url: https://www.setlist.fm/setlist/the-home-team/2026/...
```

They render as small per-band buttons under the heading, top-billing-first
regardless of the order here. Leave a band out when you cannot find its setlist;
a missing one is just no button. Festivals use the same field - fill in whichever
bands you can confirm and skip the rest.

## A festival

Festivals get a `title`, because the event is not a band. `lineup` is optional - use
it for whoever you actually caught.

```md
---
title: Vans Warped Tour
type: festival
date: 2026 # partial dates are fine
endDate: 2026-06-21 # optional, for multi-day
city: Long Beach, CA
lineup:
  - Whoever you saw
---
```

## Fields

| Field      | Required  | Notes                                                                                |
| ---------- | --------- | ------------------------------------------------------------------------------------ |
| `lineup`   | shows     | Every band, top billing first. No duplicates.                                        |
| `title`    | festivals | The event name. On a show, an alternative to a one-item `lineup`.                    |
| `type`     | no        | `show` (default) or `festival`                                                       |
| `date`     | yes       | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` - use what you remember                           |
| `endDate`  | no        | Multi-day festivals. Renders as "Nov 15–16".                                         |
| `city`     | yes       |                                                                                      |
| `venue`    | no        | Omit for festivals with no fixed venue                                               |
| `capacity` | no        | How many the place holds for a night like this. Confirm it; never guess.             |
| `rating`   | no        | 0–5 horns, decimals allowed. Omit for unrated.                                       |
| `bestSong` | no        | The one that stayed with you. Shown as "Best live".                                  |
| `with`     | no        | List of names you went with                                                          |
| `solo`     | no        | `true` for a solo run. Mutually exclusive with `with`.                               |
| `subtitle` | no        | Qualifier under the heading, e.g. "Day 1"                                            |
| `video`    | no        | Full URL. A YouTube playlist labels itself "Playlist".                               |
| `setlists` | no        | `{ band, url }` pairs. Each `band` must be in `lineup`. Renders as per-band buttons. |
| `photos`   | no        | Objects with `src` / `alt` / `caption`. All three required.                          |
| `standout` | no        | Adds a flame, in the log and on the show's own page                                  |

Notes:

- **Repeats mark themselves.** A band carries a "2nd time" badge on its show page
  once you have seen it before, and a venue says "3rd time here". Both are
  counted from the log itself, so there is nothing to write down.
- `capacity` is how many people the place holds for this kind of event: the
  standing figure for a room, the daily gate for a festival ground. Take it from
  the venue or from Dan. An absent capacity renders nothing, so leave it out
  rather than estimating.
- A festival's `title` never counts toward "bands seen" - only its `lineup` does.
- Partial dates render to their precision: `2026` gets no day label under the 2026
  heading, `2026-06` renders as "Jun", a full date renders as "Jun 20".
- Bad frontmatter fails the build with the filename, rather than shipping a broken row.
- Files starting with `_` (like this one) are ignored.

## Photos

Run them through the optimizer first. It resizes to a 1600px long edge,
re-encodes, bakes in the EXIF rotation, and strips the metadata - phone photos
carry GPS coordinates, and this is a list of places you were at a known time:

```bash
node scripts/optimize-photos.mjs shows/<show-slug> ~/Pictures/that-night
```

The first argument is a folder under `public/img/`, so the same script handles
every image on the site. Output lands in `public/img/shows/<show-slug>/`. Reference the paths in
`photos:`. Every photo needs both an `alt` and a `caption` - the build rejects
one that is missing either.

## Slug and sharing

The filename is the slug and the URL: `/shows/<slug>`. Use
`<headliner-or-festival>-<city>-<year>`, with `-day-1` / `-day-2` for a
multi-day festival logged as separate nights.

Each entry gets its own page, a **Share** button that renders a poster of the
night, and its own link preview - the build writes a real
`dist/shows/<slug>/index.html` per show with its own title, description, and
image. Renaming a file changes its URL, so anything already shared stops
resolving.

## The `add-show` skill

`.claude/skills/add-show/` runs this whole routine: research the tour name,
venue, and openers, optimize the photos, write their alt text and captions, and
produce the file.
