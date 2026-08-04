---
name: add-show
description: Adds an entry to the show log at src/content/shows/. Use whenever the user says they went to a concert, gig, show, or festival and wants it logged, or asks to add photos or details to a show that is already there.
---

# Adding a show

The user gives you the parts they remember. You do the research, the photo work,
and the file. Ask at most one round of questions, and only for things you cannot
look up: the rating, who they went with, and their own notes about the night.

## 1. Take down what they said

Required before writing anything:

- **Who played.** Every band they name, top billing first.
- **When.** A year, a month, or a full date - all three are valid.
- **Where.** At minimum the city.

Everything else is optional and should stay out of the file if it is not known.
An absent field renders nothing; a guessed field is a lie in a personal log.

## 2. Research the gaps

Use `WebSearch` to fill in what the user did not say. Worth looking up, in
order of how often it helps:

1. **Venue** - from the artist, city, and date.
2. **Capacity** - the standing figure for a room, from the venue's own site or
   Wikipedia. A festival ground rarely publishes one, so ask the user for the
   daily attendance instead. Leave it out when neither is available; a room size
   is the sort of number people check.
3. **Tour name** - goes in `subtitle`, e.g. `The Romantic Tour`.
4. **Openers** - the user often only remembers the headliner. Support acts
   round out `lineup` and count toward "bands seen".
5. **City** precision - `Long Beach, CA` rather than `LA`.
5. **Setlists** - for **every band on the bill**, search setlist.fm for that
   band at that venue on that date. Each page you can confirm becomes a per-band
   button on the show page, listed in `setlists` (see step 5). The headliner's
   own page is also strong confirmation the night happened (and it usually names
   the openers and the songs, so start there). The URL slug omits the date, so
   open each page and read the date off it before trusting it - a setlist for
   the same band on another night is the wrong show, and a venue with two nights
   of the same tour is the classic trap. A band with no setlist on file just
   gets no button; never invent or guess a URL.

Rules, and they matter more than the completeness of the entry:

- Accept a result only when it matches **the artist and the date and the city**.
  A tour page that lists the right artist on the wrong night is the wrong show.
- Setlist.fm, the venue's own calendar, and the artist's tour archive are
  reliable. Aggregator pages that list "upcoming events" for a date in the past
  usually are not.
- If two sources disagree, or you can only find one weak source, **leave the
  field out** and tell the user what you could not confirm. Do not guess a tour
  name from the album cycle.
- Never invent an opener. A missing opener is invisible; a wrong one is a claim
  the user will have to correct in person.

Report what you found and where it came from before writing the file.

## 3. Photos

Phone photos are too big to commit and carry GPS coordinates in EXIF. Run them
through the optimizer, which resizes to a 1600px long edge, re-encodes, strips
all metadata, and bakes in the rotation:

```bash
node scripts/optimize-photos.mjs shows/<show-slug> ~/path/to/photos
```

The first argument is a folder under `public/img/`, so this writes to
`public/img/shows/<show-slug>/`. It accepts files or directories, and
`--name=<basename>` renames a single photo on the way through. Rename the
outputs to something descriptive before referencing them.

This applies to any image entering the repo, not just show photos.

## 4. Caption them

Open each optimized photo with `Read` and look at it. **Every photo needs both
an `alt` and a `caption`, always** - the build rejects a photo that is missing
either, so there is no such thing as a quick bare path.

- **`alt`** - what is in the frame, for someone who cannot see it. Under about
  125 characters. Describe the picture, not the occasion: "Stage washed in red
  light, drummer mid-fill" beats "an amazing night".
- **`caption`** - the short line printed under the photo. A few words, the
  user's voice, dry rather than sentimental.

Only describe what is actually visible. Do not name a person unless the user
named them. Do not infer the band, the song, or the venue from the picture - use
what the user and your research established.

This holds for photos anywhere on the site, not just the show log. A photo
without a caption is a photo nobody can place.

## 5. Write the file

One file per show at `src/content/shows/<slug>.md`. The slug is the filename and
becomes the URL, so `<headliner-or-festival>-<city>-<year>`, kebab-case, with
`-day-1` / `-day-2` appended for a multi-day festival logged as separate nights.

`src/content/shows/_README.md` is the field reference - read it rather than
working from memory. The shape:

```md
---
lineup:
  - Knocked Loose
  - Show Me the Body
subtitle: Suffocation Tour     # the tour name, if you confirmed one
date: 2026-06-20
venue: Hollywood Palladium
capacity: 3700                   # only if the venue publishes one
city: Los Angeles, CA
rating: 4.5
with:
  - Jasmine P.
video: https://youtu.be/xxxxx
standout: true
setlists:                        # one per band you could confirm, bill order
  - band: Knocked Loose
    url: https://www.setlist.fm/setlist/knocked-loose/2026/...
  - band: Show Me the Body
    url: https://www.setlist.fm/setlist/show-me-the-body/2026/...
photos:                          # alt and caption are both required
  - src: /img/shows/knocked-loose-la-2026/pit.jpg
    alt: Crowd surge under red light, arms up across the front barricade
    caption: Front barricade, second song
bestSong: Suffocate
---

**Knocked Loose** brought the room down and *Suffocate* was the one that stuck.
The night in the user's voice - lightly edited, not rewritten.
```

A festival needs `type: festival` and a `title`; a normal show takes its heading
from `lineup[0]`. `solo: true` and `with:` are mutually exclusive and the build
enforces it.

### The notes

The body renders as Markdown, and it is the user's story, so keep their voice,
their details, and their verdicts. You are the editor, not the author: fix the
typos, tighten the flow, and give it a little edge so it reads well - but stay
close to what they wrote. Trim and sharpen; do not rewrite it into your own
words, invent a moment they never mentioned, or sand off an opinion. Dry stays
dry, love stays love.

Mark up every band and song that lands in the prose, and do it the same way
every time:

- Bands and artists in **bold**.
- Song titles in *italics*. Album, EP, and tour names take italics too.

Format every mention, not just the first, and nothing else - people, venues,
and cities stay plain. `lineup` and `bestSong` live in frontmatter and take no
markup; this convention is only for the names that appear in the free-form
text. The point is consistency: a reader should be able to tell a band from a
song at a glance, and the same name should never be styled two ways.

### Setlists

The setlist.fm links from step 2 do not go in the notes. They live in
`setlists`, a list of `{ band, url }` pairs - one per band whose page you
confirmed - and render as small per-band buttons under the show heading:

```yaml
setlists:
  - band: Bilmuri          # must match a name in `lineup`, exactly
    url: https://www.setlist.fm/setlist/bilmuri/2026/...
  - band: The Home Team
    url: https://www.setlist.fm/setlist/the-home-team/2026/...
```

The build rejects a `band` that is not on the bill, so the buttons never
promise a set from a band the entry does not claim to have seen. Order does not
matter - they render top-billing-first to match `lineup`. Leave a band out when
you could not find its setlist; a missing one is simply no button. Festivals use
the same field, best-effort: add setlists for the bands you can confirm and skip
the rest.

## 6. Verify

```bash
npm run build   # frontmatter and photo paths are validated here
npm test        # build first; the suite runs against dist/
```

The build fails on a malformed entry or a photo path that does not exist, which
is the point - a broken show never reaches the live site. The build also writes
`dist/shows/<slug>/index.html` so the new entry gets its own link preview.

Then stage only the new markdown file and its photos, show `git status --short`,
and stop. Committing needs an explicit instruction.
