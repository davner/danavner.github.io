# Now entries

One markdown file per entry, named `<YYYY-MM-DD>.md` for its `updated` date.
The newest entry is what `/now` shows; every older one is the timeline under
it. Files starting with `_` (like this one) are ignored.

## Writing a new entry

Add a new file - by hand, or with the form at `/admin/`. The moment its
`updated` date is the newest in the folder, it is the current entry and
everything else moves down into the timeline. Nothing files anything for you,
because nothing needs filing: the folder is the whole record.

```md
---
updated: 2026-08-27
---

What is going on right now, in markdown.
```

## Photos

Optional, and they work exactly the way a show's photos do.

```md
---
updated: 2026-08-27
photos:
  - src: /img/now/2026-08-27/deck.jpg
    alt: A Magic deck fanned out on a kitchen table
    caption: The Miku deck, 2-0 so far
---
```

Files live in `public/img/now/<YYYY-MM-DD>/`, named for the entry's date the
same way a show's live under its slug. Every image goes through the optimizer
before it enters the repo:

```bash
node scripts/optimize-photos.mjs now/2026-08-27 ~/Desktop/deck.jpg
```

It resizes, re-encodes, and strips EXIF - phone photos carry GPS. Uploading
through `/admin/` instead needs no command: the CMS resizes to a 1600px long
edge and re-encodes to WebP in the browser, which drops the EXIF on the way.

`alt` and `caption` are both required and the build fails without either, as it
does for a `src` pointing at a file that is not there. `alt` is what a screen
reader announces; `caption` is what is printed over the bottom of the photo.

The current entry shows its photos as a strip under the prose. **Archived
entries show a count instead**, linking to that entry's own page - the archive
pane is a fixed height, and a carousel per entry would push the archive itself
off a phone screen.

Two things switch on once an entry has photos, and they are worth knowing
because nothing else in the repo says so:

| Photos on an entry | What it turns on |
| --- | --- |
| One or more | The share sheet builds a poster instead of offering the link alone |
| Two or more | The share panel's cover picker, choosing which photo tops the poster |

Eight tests in `tests/share.spec.ts` and `tests/site.spec.ts` skip themselves
with a reason until a now entry has photos, and lift on their own the moment one
does. Two more wait on a second entry being archived, which is the third entry
filed. Run `npm test` and read the skip reasons to see which are still waiting.
The first time an entry gains photos, check at `/admin/` that an upload really
lands in `public/img/now/<YYYY-MM-DD>/` - nothing automated can check that.

## Fixing something you already published

Edit that entry's file and leave its `updated` date alone. A correction is not
a second entry saying the same thing, so do not create a new file for a typo.

## Why the dates cannot collide

`vite-plugin-content.ts` fails the build when any two entries share an
`updated` date, naming both files. The date is the entry's identity - the
filename, the sort key, and the label on the page - so two entries on one day
would be the same day printed twice.

## Every entry has an address

`/now` shows whatever is current. Every entry also has a permanent home at
`/now/<YYYY-MM-DD>`, so a link you send today still shows the entry you meant
after it has been replaced.

While an entry is current, `/now/<its date>` redirects to `/now` - one entry is
never live at two addresses. The moment a newer entry lands, the permalink
starts rendering on its own. A date nothing was written on redirects to `/now`
too.

## If you need to remove one

Delete the file. It disappears from the page, and the text still exists in git
history if you want it back. The one cost: any link already shared to
`/now/<that date>` stops resolving and sends the reader to `/now` instead,
which is a different entry. That is a deliberate act recorded in git, not
something that happens on its own - but it is worth knowing before you delete
an entry you have sent to someone.
