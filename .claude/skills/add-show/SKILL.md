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
2. **Tour name** - goes in `subtitle`, e.g. `The Romantic Tour`.
3. **Openers** - the user often only remembers the headliner. Support acts
   round out `lineup` and count toward "bands seen".
4. **City** precision - `Long Beach, CA` rather than `LA`.

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
node scripts/optimize-photos.mjs <show-slug> ~/path/to/photos
```

It accepts files or directories and writes to `public/img/shows/<show-slug>/`.
Rename the outputs to something descriptive before referencing them.

## 4. Caption them

Open each optimized photo with `Read` and look at it. For each one write:

- **`alt`** - what is in the frame, for someone who cannot see it. Under about
  125 characters. Describe the picture, not the occasion: "Stage washed in red
  light, drummer mid-fill" beats "an amazing night".
- **`caption`** - the short line printed under the photo. A few words, the
  user's voice, dry rather than sentimental.

Only describe what is actually visible. Do not name a person unless the user
named them. Do not infer the band, the song, or the venue from the picture - use
what the user and your research established.

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
city: Los Angeles, CA
rating: 4.5
with:
  - Jasmine P.
video: https://youtu.be/xxxxx
standout: true
photos:
  - src: /img/shows/knocked-loose-la-2026/pit.jpg
    alt: Crowd surge under red light, arms up across the front barricade
    caption: Front barricade, second song
bestSong: Suffocate
---

Free-form markdown about the night. Optional, and the user's words, not yours.
```

A festival needs `type: festival` and a `title`; a normal show takes its heading
from `lineup[0]`. `solo: true` and `with:` are mutually exclusive and the build
enforces it.

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
