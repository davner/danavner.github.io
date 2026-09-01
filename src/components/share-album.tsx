import { Share } from "@/components/share";
import { renderAlbumCard } from "@/lib/album-card";
import type { Album } from "@/lib/dan-fm";
import { albumTitle, albumUrl } from "@/lib/dan-fm-summary";
import { SITE_URL } from "@/lib/site";

/**
 * The share sheet, with an album as its subject.
 *
 * The mirror of `share-show.tsx` and `share-now.tsx`. Everything the panel does
 * lives in `components/share.tsx`, so what an album adds is the values that
 * sheet reads.
 *
 * No cover candidates, and a poster all the same. `photos` feeds the picker,
 * which is a choice an album does not have - it has one sleeve or none - and
 * the renderer draws a card either way, unlike a now entry whose poster is the
 * photo.
 */
export function ShareAlbum({ album, className }: { album: Album; className?: string }) {
  return (
    <Share
      className={className}
      subject={{
        heading: albumTitle(album),
        url: `${SITE_URL}${albumUrl(album)}`,
        filename: album.slug,
        photos: [],
        renderCard: () => renderAlbumCard(album),
      }}
    />
  );
}
