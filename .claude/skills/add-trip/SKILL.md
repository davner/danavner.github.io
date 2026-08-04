---
name: add-trip
description: Adds an entry to the trip log at src/content/trips/. Use whenever the user says they went somewhere - a vacation, a family visit, a work trip, a tour - and wants it logged, or asks to add photos or details to a trip that is already there.
---

# Adding a trip

The user gives you the parts they remember. You do the photo work and the file.
Ask at most one round of questions, and only for things you cannot look up: who
came, what stuck, and the meal.

There are no ratings here. A trip is not the kind of thing that gets a score,
and adding one would be a change to the model, not a field you fill in.

## 1. Take down what they said

Required before writing anything:

- **Where.** Every place they name, in the order they went. At minimum one.
- **When.** A year, a month, or a full date - all three are valid.

Everything else is optional and should stay out of the file if it is not known.
An absent field renders nothing; a guessed field is a lie in a personal log.

Do not invent a highlight, a meal, or a verdict. If the user did not say it, it
does not go in. That applies especially to `oneThing` and `bestMeal`, which are
written in their voice and read as theirs.

## 2. Research only what is safe to look up

Far less to research than a show. Worth confirming:

1. **Country for each stop.** `stops` is always `City, Country` and the build
   rejects a stop with no comma. "Madrid" is Spain; do not guess between a
   Springfield in Illinois and one in Missouri - ask.
2. **Spelling and the usual English name** of a place - `Lisbon`, not `Lisboa`,
   unless the user wrote it the other way.

Do not research what they did. The highlights are theirs.

## 3. Photos

Every image goes through the optimizer before it enters the repo. It resizes,
re-encodes, and strips EXIF - phone photos carry GPS:

```bash
node scripts/optimize-photos.mjs trips/<slug> ~/Downloads/IMG_*.jpeg
```

Then **look at each result** and write it both `alt` text and a caption. Always
both, every photo, no exceptions - the build rejects a photo missing either.

- `alt` describes what is in the frame for someone who cannot see it.
- The caption is what the user would say pointing at it.

Where you cannot tell what a photo shows, say so and ask rather than writing a
vague caption to fill the field.

## 4. Write the file

One file per trip at `src/content/trips/<slug>.md`. The slug is the filename and
becomes the URL, so `<place>-<year>`, kebab-case.

`src/content/trips/_README.md` is the field reference - read it rather than
working from memory. The shape:

```md
---
title: Spain and Portugal
date: 2026-06-12
endDate: 2026-06-20
type: vacation
stops:
  - Madrid, Spain
  - Barcelona, Spain
  - Lisbon, Portugal
with:
  - Alexis A.
highlights:
  - Got rained on in the Alhambra gardens and stayed anyway
  - The overnight train, which was a mistake and also the best part
oneThing: Go in June, before the heat makes the afternoons useless.
bestMeal: Tinned mussels at a bar in Lisbon with no name on the door.
wouldGoBack: true
photos:
  - src: /img/trips/spain-2026/alhambra.jpg
    alt: The Alhambra's Court of the Lions in flat grey light, rain on the stone
    caption: Worth the soaking
---

Optional markdown, for a trip with a story worth telling.
```

Field notes that matter:

- **`stops` is the route, in order.** It renders as `Madrid → Barcelona →
  Lisbon`, so the order is content, not sorting. No duplicates.
- **`endDate` must not precede `date`,** and nights are only counted when both
  ends carry a full day. A trip written as a bare month has no length; leave it
  that way rather than inventing one.
- **`wouldGoBack` has three states.** `true`, `false`, or absent. Absent means
  undecided and renders nothing. Do not default it to `true` because the trip
  sounded nice.
- **`solo: true` and `with:` are mutually exclusive** and the build enforces it.
- **`highlights` are bullets, not prose.** A few short lines. If the user gave
  you a paragraph, that is the body, not a highlight.

### The notes

The body renders as Markdown, and it is the user's story, so keep their voice,
their details, and their verdicts. You are the editor, not the author: fix the
typos, tighten the flow, and let it read well - but stay close to what they
wrote. Do not rewrite it into your own words, invent a moment they never
mentioned, or sand off an opinion.

Mark up names the same way the show log does:

- Bands, artists, and the names of works in **bold**.
- Song, album, and tour titles in *italics*.

Places, people, and restaurants stay plain. Most trips need no markup at all.

## 5. Verify

```bash
npm run build   # frontmatter and photo paths are validated here
npm test        # build first; the suite runs against dist/
```

The build fails on a malformed entry or a photo path that does not exist, which
is the point - a broken trip never reaches the live site.

Then stage only the new markdown file and its photos, show `git status --short`,
and stop. Committing needs an explicit instruction.
