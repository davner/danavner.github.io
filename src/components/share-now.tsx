import { Share } from "@/components/share";
import { type NowEntry, nowUrl } from "@/lib/now";
import { renderNowCard } from "@/lib/now-card";
import { nowTitle } from "@/lib/now-summary";

/**
 * The share sheet, with a now entry as its subject.
 *
 * The mirror of `share-show.tsx`, and the same six values - with one of them
 * conditional. An entry with photos gets a poster; an entry without gets the
 * link on its own, because the poster's top third is the photo and what is left
 * without it is a date set large on an empty canvas.
 */
export function ShareNow({ entry, className }: { entry: NowEntry; className?: string }) {
  const hasPhotos = entry.photos.length > 0;

  return (
    <Share
      className={className}
      subject={{
        heading: nowTitle(entry),
        url: nowUrl(entry),
        filename: entry.updated,
        photos: entry.photos,
        renderCard: hasPhotos ? (index) => renderNowCard(entry, index) : undefined,
      }}
    />
  );
}
