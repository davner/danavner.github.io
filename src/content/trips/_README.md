# Trip log

One markdown file per trip. The filename becomes the slug. Everything at the top
of `/trips` is derived from these files: total, countries, cities, nights away,
and the year groups. Adding a trip is dropping a file in here and nothing else.

Files starting with `_` (like this one) are ignored.

There are no ratings here. A trip is not the kind of thing that gets a score.

## A trip

```md
---
title: Spain and Portugal
date: 2026-06-12          # YYYY, YYYY-MM, or YYYY-MM-DD
endDate: 2026-06-20       # optional; both ends dated gives "8 nights"
type: vacation            # vacation | family | work | tour
stops:                    # in the order you went, always "City, Country"
  - Madrid, Spain
  - Barcelona, Spain
  - Lisbon, Portugal
with:
  - Alexis A.
highlights:
  - Got rained on in the Alhambra gardens and stayed anyway
  - The overnight train, which was a mistake and also the best part
oneThing: Go in June, before the heat makes the afternoons useless.
bestMeal: The tinned mussels at a bar in Lisbon with no name on the door.
wouldGoBack: true
photos:
  - src: /img/trips/spain-2026/alhambra.jpg
    alt: The Alhambra's Court of the Lions in flat grey light, rain on the stone
    caption: Worth the soaking
---

Optional markdown. Write it when the trip has a story; leave it out when the
photos and the highlights already say it.
```

## The fields

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Where the trip was, however you think of it. |
| `date` | yes | Any precision. A trip you only remember the month of still counts. |
| `endDate` | no | Must not precede `date`. Nights are only counted when both ends carry a day. |
| `type` | no | Defaults to `vacation`. |
| `stops` | yes | At least one, each `City, Country`, no duplicates. Order is the route. |
| `with` | no | Contradicts `solo: true`; set one or the other. |
| `solo` | no | Records going alone, as opposed to merely not saying. |
| `highlights` | no | A few bullets. Not prose - the body is for prose. |
| `oneThing` | no | What you would tell someone about this trip. |
| `bestMeal` | no | The travel equivalent of a show's `bestSong`. |
| `wouldGoBack` | no | `true`, `false`, or leave it out for undecided. Undecided renders nothing. |
| `photos` | no | Every photo needs `src`, `alt`, and `caption`. All three, every time. |

## Photos

Same rules as the show log. Run every image through the optimizer before it goes
in the repo - it resizes, re-encodes, and strips EXIF, and phone photos carry
GPS:

```sh
node scripts/optimize-photos.mjs trips/spain-2026 ~/Downloads/IMG_*.jpeg
```

Then look at each result and write it real `alt` text and a real caption. `alt`
describes what is in the frame for someone who cannot see it; the caption is
what you would say pointing at it. A missing photo path fails the build rather
than shipping a broken image.
