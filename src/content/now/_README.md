# Now archive

Every now entry that `src/content/now.md` has replaced, one file per entry,
named for the date it carried. They are written by
`.github/workflows/now-archive.yml`, not by hand.

Files starting with `_` (like this one) are ignored.

## Do not edit `now.md` and a file in here in the same breath

There is only one file you write: `src/content/now.md`. What happens to the old
text is decided by whether you changed its `updated` date.

| You did this                         | What happens on push          |
| ------------------------------------ | ----------------------------- |
| Changed the text **and** the date     | The old text is filed in here |
| Changed the text, **kept** the date   | Nothing - it was a correction |

So a new now is: rewrite the body, set `updated` to today, push. The entry it
replaced lands in this folder on its own a moment later, and `/now` grows a
timeline under the current entry.

Fixing a sentence you got wrong an hour ago is: edit the body, leave the date
alone, push. Nothing is filed, because a typo fix is not a second entry saying
the same thing as the first.

## Why the dates cannot collide

`vite-plugin-content.ts` fails the build if a file in here is dated the same day
as the current entry in `now.md`. That would mean the same day appears twice on
the page, which is either the archive job having run twice or a hand-written
file landing on top of it. Either way it is worth stopping the build over rather
than shipping.

## If you need to remove one

Delete the file. Nothing else references it, and the build will not miss it. The
text still exists in the history of `now.md` if you want it back.
