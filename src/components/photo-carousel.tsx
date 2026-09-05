import { useEffect, useRef, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { Photo } from "@/lib/photo";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

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
  const frame = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!api) return;

    const sync = () => setActive(api.selectedScrollSnap());

    /*
     * The shutter blink: the frame dips and returns when a slide commits -
     * button, arrow key, or drag snap alike. Its own listener rather than a
     * branch in `sync`, which is also registered for "reInit" and runs at
     * mount; the frame must blink only when the reader advances it. WAAPI
     * rather than a CSS class, and that is the point under reduced motion:
     * with the travel jumping (`duration: 0` below), this reader-triggered,
     * sub-100ms, opacity-only cue is the one signal left that the frame
     * advanced - the bound DESIGN.md's Allowlist Contract Rule names.
     */
    const blink = () => {
      frame.current?.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], {
        duration: 90,
        easing: "ease-out",
      });
    };

    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    api.on("select", blink);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
      api.off("select", blink);
    };
  }, [api]);

  if (photos.length === 0) return null;

  const single = photos.length === 1;

  return (
    /*
     * Capped so a photo does not dwarf the entry it belongs to.
     *
     * The halftone rests on multi-photo strips only, and that is the decision
     * rather than a limitation: a single-photo carousel renders no controls,
     * so it holds nothing focusable and a keyboard reader would have no way to
     * the true photo. A treatment whose resolution mechanism does not exist on
     * a surface does not apply there - the lone photo shows true at rest. The
     * host class carries the focus half, because focus lands on the buttons
     * in this figure rather than on the screened item itself.
     */
    <figure className={cn("mt-5 max-w-2xl", !single && "halftone-host")}>
      <Carousel
        setApi={setApi}
        /*
         * The strip's travel is a script animation, so the CSS reduced-motion
         * block cannot reach it. `duration: 0` makes embla jump to the slide
         * instead of gliding to it.
         *
         * The key is absent rather than `undefined` when the preference is off.
         * Embla merges options by key presence, so `duration: undefined` would
         * replace its default rather than leave it, and every strip would jump
         * for everyone. Presence is also how it notices the options changed, so
         * it re-initialises when the preference does.
         */
        opts={{ align: "start", loop: false, ...(reduce && { duration: 0 }) }}
        aria-label={`Photos from ${label}`}
      >
        {/* The frame wraps only the photos. Putting it on the Carousel root
            would drag the controls onto the border colour too. */}
        <div ref={frame} className="border border-border">
          <CarouselContent>
            {photos.map((photo, index) => (
              <CarouselItem
                key={photo.src}
                className={cn("relative bg-background", !single && "halftone")}
              >
                <img
                  src={photo.src}
                  alt={photo.alt || `${label} - photo ${index + 1} of ${photos.length}`}
                  loading="lazy"
                  decoding="async"
                  className="aspect-4/3 w-full object-cover sm:aspect-video"
                />
                {photo.caption ? (
                  /* Stock black and white rather than the palette: this caption
                     sits on a photograph, so it has to hold in either theme, and
                     every ink in the system flips with the stock it is printed
                     on. Lifted above the halftone screen, whose dots would
                     otherwise land on the words.

                     The gradient holds solid until the top padding begins, so
                     the backing scales with the caption's own box: every line
                     of a wrapped caption sits on the same 85% black a single
                     line gets (4.5:1 clears even over a white photo), and only
                     the pt-10 runway above the text fades out. */
                  <figcaption className="readout absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 from-[calc(100%-2.5rem)] to-transparent px-4 pt-10 pb-3 text-white">
                    {photo.caption}
                  </figcaption>
                ) : null}
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>

        {single ? null : (
          // Paper shows one slide and cannot turn it, so the controls stay off it.
          <div className="mt-2 flex items-center gap-3 print:hidden">
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
