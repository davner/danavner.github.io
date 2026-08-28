import { Share } from "@/components/share";
import { renderShowCard, showUrl } from "@/lib/show-card";
import { showHeading } from "@/lib/show-summary";
import type { Show } from "@/lib/shows";

/**
 * The share sheet, with a show as its subject.
 *
 * Everything the panel does lives in `components/share.tsx`; all a show adds is
 * the six values that sheet reads. Keeping the mapping here rather than at the
 * call site means the page asks for "share this show" and never has to know how
 * a show becomes a poster.
 */
export function ShareShow({ show, className }: { show: Show; className?: string }) {
  return (
    <Share
      className={className}
      subject={{
        heading: showHeading(show),
        url: showUrl(show),
        filename: show.slug,
        photos: show.photos,
        renderCard: (index) => renderShowCard(show, index),
      }}
    />
  );
}
