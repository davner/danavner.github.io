import { Share } from "@/components/share";
import { type NowEntry, nowUrl } from "@/lib/now";
import { renderNowCard } from "@/lib/now-card";
import { nowShareText, nowTitle } from "@/lib/now-summary";

/**
 * The share sheet, with a now entry as its subject.
 *
 * The mirror of `share-show.tsx`, and the same values - with one conditional
 * and one more. An entry with photos gets a poster; an entry without gets the
 * link on its own, because the poster's top third is the photo and what is left
 * without it is a date set large on an empty canvas. And the prose rides
 * along: a now entry is the writing, so the share carries what was written
 * with the link - shows and albums are pages worth arriving at and pass no
 * text.
 */
export function ShareNow({ entry, className }: { entry: NowEntry; className?: string }) {
  const hasPhotos = entry.photos.length > 0;

  return (
    <Share
      className={className}
      subject={{
        heading: nowTitle(entry),
        url: nowUrl(entry),
        text: nowShareText(entry),
        filename: entry.updated,
        photos: entry.photos,
        renderCard: hasPhotos ? (index) => renderNowCard(entry, index) : undefined,
      }}
    />
  );
}
