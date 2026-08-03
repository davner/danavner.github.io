import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Photo } from "@/lib/shows";
import { cn } from "@/lib/utils";

/**
 * Photo strip.
 *
 * Native scroll-snap rather than a carousel library: touch, trackpad, and
 * keyboard scrolling all work for free, it degrades to a plain scrollable row
 * without JavaScript, and it adds nothing to the bundle. The buttons and the
 * counter are conveniences on top of a container that already works.
 */
export function PhotoCarousel({ photos, label }: { photos: Photo[]; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  /**
   * Where the last button press was aiming. The observer only reports a slide
   * once it has settled, so deriving the next target from `active` would make
   * two quick clicks land one slide along instead of two.
   */
  const targetRef = useRef(0);

  // Track which slide is centred so the counter and button states follow the
  // scroll position, however it was moved.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(index)) continue;
          // Resyncs the target when the slide was reached by scrolling or swipe.
          targetRef.current = index;
          setActive(index);
        }
      },
      { root: track, threshold: 0.6 },
    );

    for (const slide of track.children) observer.observe(slide);
    return () => observer.disconnect();
  }, [photos.length]);

  const step = useCallback(
    (delta: number) => {
      const index = Math.min(Math.max(targetRef.current + delta, 0), photos.length - 1);
      targetRef.current = index;

      const slide = trackRef.current?.children[index] as HTMLElement | undefined;
      slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    },
    [photos.length],
  );

  if (photos.length === 0) return null;

  const single = photos.length === 1;

  return (
    // Capped so a photo does not dwarf the entry it belongs to.
    <figure className="mt-5 max-w-2xl">
      <ul
        ref={trackRef}
        className={cn(
          "flex gap-px overflow-x-auto border border-border bg-border",
          "snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto",
          // The scrollbar would cut across the poster; scrolling still works.
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {photos.map((photo, index) => (
          <li
            key={photo.src}
            data-index={index}
            className="relative w-full shrink-0 snap-start bg-background"
          >
            <img
              src={photo.src}
              alt={photo.alt || `${label} — photo ${index + 1} of ${photos.length}`}
              loading="lazy"
              decoding="async"
              className="aspect-4/3 w-full object-cover sm:aspect-video"
            />
            {photo.caption ? (
              <figcaption className="readout absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-3 text-white">
                {photo.caption}
              </figcaption>
            ) : null}
          </li>
        ))}
      </ul>

      {single ? null : (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex gap-px">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={active === 0}
              aria-label="Previous photo"
              className="flex size-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-ember hover:text-ember disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={active === photos.length - 1}
              aria-label="Next photo"
              className="flex size-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-ember hover:text-ember disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <p className="readout-dim tabular-nums" aria-live="polite">
            <span className="text-ember">{String(active + 1).padStart(2, "0")}</span>
            {" / "}
            {String(photos.length).padStart(2, "0")}
          </p>
        </div>
      )}
    </figure>
  );
}
