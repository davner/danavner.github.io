import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { Photo } from "@/lib/photo";

/**
 * Photo strip for a show, built on the shadcn/ui Carousel.
 *
 * The buttons sit under the strip rather than overlapping it - at this size
 * they would cover a third of the photo - so the default absolute positioning
 * is overridden rather than the component being reimplemented.
 */
export function PhotoCarousel({ photos, label }: { photos: Photo[]; label: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!api) return;

    const sync = () => setActive(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  if (photos.length === 0) return null;

  const single = photos.length === 1;

  return (
    // Capped so a photo does not dwarf the entry it belongs to.
    <figure className="mt-5 max-w-2xl">
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: false }}
        aria-label={`Photos from ${label}`}
      >
        {/* The frame wraps only the photos. Putting it on the Carousel root
            would drag the controls onto the border colour too. */}
        <div className="border border-border">
          <CarouselContent>
            {photos.map((photo, index) => (
              <CarouselItem key={photo.src} className="relative bg-background">
                <img
                  src={photo.src}
                  alt={photo.alt || `${label} - photo ${index + 1} of ${photos.length}`}
                  loading="lazy"
                  decoding="async"
                  className="aspect-4/3 w-full object-cover sm:aspect-video"
                />
                {photo.caption ? (
                  <figcaption className="readout absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-3 text-white">
                    {photo.caption}
                  </figcaption>
                ) : null}
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>

        {single ? null : (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex gap-px">
              <CarouselPrevious className="static size-7 translate-y-0 border-border text-muted-foreground hover:border-ember hover:text-ember" />
              <CarouselNext className="static size-7 translate-y-0 border-border text-muted-foreground hover:border-ember hover:text-ember" />
            </div>

            {/* The same count twice: a zero-padded pair set in the tabular face
                for the eye, and a sentence for the live region. The pair reads
                aloud as "oh one slash oh five", so it is the eye's copy only and
                the sentence is what the region actually announces. */}
            <p className="readout-dim tabular-nums" aria-live="polite">
              <span aria-hidden>
                <span className="text-ember">{String(active + 1).padStart(2, "0")}</span>
                {" / "}
                {String(photos.length).padStart(2, "0")}
              </span>
              <span className="sr-only">
                Photo {active + 1} of {photos.length}
              </span>
            </p>
          </div>
        )}
      </Carousel>
    </figure>
  );
}
