# Show log

One markdown file per show. The filename becomes the slug. Everything at the top of
`/shows` — total, bands seen, venues, most-seen act, average rating, the year groups
— is derived from these files, so adding a show is dropping a file in here and
nothing else.

The same reference lives in the root `README.md`; this copy is here so it is next
to the files it describes. Files starting with `_` (like this one) are ignored.

## A normal show

`lineup` is the whole bill, **top billing first**. Openers count — toward the display,
and toward "bands seen".

```md
---
lineup:
  - Knocked Loose         # tops the bill, shown large
  - Show Me the Body      # everyone below is listed as "w/ …"
  - Speed
date: 2026-06-20
venue: Hollywood Palladium
city: Los Angeles, CA
rating: 4.5               # out of 5 horns, partials welcome
with:
  - Jasmine P.
video: https://youtu.be/xxxxx
standout: true
---

Free-form markdown about the night. Optional.
```

A one-band night can skip the list and just say `title: Turnstile`.

## Rating

`rating` is out of 5 🤘🏽 and takes any number in between — `4.5`, `3.2`, `4.75`.
The row fills proportionally, so a `3.2` really does show a fifth of the fourth
horn. Leave it off entirely and no rating renders; unrated is not the same as
zero, and unrated shows are excluded from the average at the top of the page.

## Who you went with

`with` is a list of names. Went alone? Use `solo: true` instead and the entry
gets a **SOLO RUN · 1P** badge. Setting both is an error — the build will say so.

## A festival

Festivals get a `title`, because the event is not a band. `lineup` is optional — use
it for whoever you actually caught.

```md
---
title: Vans Warped Tour
type: festival
date: 2026                 # partial dates are fine
endDate: 2026-06-21        # optional, for multi-day
city: Long Beach, CA
lineup:
  - Whoever you saw
---
```

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| `lineup` | shows | Every band, top billing first. No duplicates. |
| `title` | festivals | The event name. On a show, an alternative to a one-item `lineup`. |
| `type` | no | `show` (default) or `festival` |
| `date` | yes | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` — use what you remember |
| `endDate` | no | Multi-day festivals. Renders as "Nov 15–16". |
| `city` | yes | |
| `venue` | no | Omit for festivals with no fixed venue |
| `rating` | no | 0–5 horns, decimals allowed. Omit for unrated. |
| `with` | no | List of names you went with |
| `solo` | no | `true` for a solo run. Mutually exclusive with `with`. |
| `subtitle` | no | Qualifier under the heading, e.g. "Day 1" |
| `video` | no | Full URL. Renders a Watch link. |
| `standout` | no | Adds a flame and pins it to the ticker |

Notes:

- A festival's `title` never counts toward "bands seen" — only its `lineup` does.
- Partial dates render to their precision: `2026` gets no day label under the 2026
  heading, `2026-06` renders as "Jun", a full date renders as "Jun 20".
- Bad frontmatter fails the build with the filename, rather than shipping a broken row.
- Files starting with `_` (like this one) are ignored.
