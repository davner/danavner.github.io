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

## Fixing something you already published

Edit that entry's file and leave its `updated` date alone. A correction is not
a second entry saying the same thing, so do not create a new file for a typo.

## Why the dates cannot collide

`vite-plugin-content.ts` fails the build when any two entries share an
`updated` date, naming both files. The date is the entry's identity - the
filename, the sort key, and the label on the page - so two entries on one day
would be the same day printed twice.

## If you need to remove one

Delete the file. It disappears from the page, and the text still exists in git
history if you want it back.
