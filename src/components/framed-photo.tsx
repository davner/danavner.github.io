import { useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A photo in the site's frame, with its caption printed over the bottom of the
 * image.
 *
 * Every photo on the site uses this, so a caption always sits on the picture it
 * belongs to rather than floating under it in a different style.
 */
export function FramedPhoto({
  src,
  srcSet,
  sizes,
  alt,
  caption,
  className,
  imageClassName,
  width,
  height,
  eager,
}: {
  src: string;
  /** Widths to choose between, when more than one size of the photo exists. */
  srcSet?: string;
  /** How wide the photo renders, so the browser can pick from `srcSet`. */
  sizes?: string;
  alt: string;
  caption: string;
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
  /**
   * Above the fold: skip lazy loading, and ask the browser to fetch it ahead of
   * everything else. On the home page this photo is the largest contentful
   * paint, and it is rendered by React rather than sitting in the HTML - so
   * without the hint nothing starts fetching it until the bundle has run.
   */
  eager?: boolean;
}) {
  const figureRef = useRef<HTMLElement>(null);

  return (
    /*
     * The press answer loads on first press: a static import would put
     * react-spring into the eager bundle this figure anchors (the home hero
     * is the LCP), so the chunk splits and the first boop may start a frame
     * late, which an easter egg can afford.
     *
     * The figure stays non-focusable and silent to assistive technology -
     * the pixel fire's conformance judgment, inherited whole: the press
     * conveys nothing and changes no state, keyboard has nothing to operate,
     * and the cursor is the only invitation. DESIGN.md's Motion section
     * records it.
     */
    <figure
      ref={figureRef}
      className={cn("relative cursor-pointer overflow-hidden border border-border", className)}
      onPointerDown={() => {
        const figure = figureRef.current;
        if (!figure) return;
        void import("@/lib/boop").then((module) =>
          module.boop(figure, window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        );
      }}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("w-full object-cover", imageClassName)}
      />
      {/* Stock black and white rather than the palette: this caption sits on a
          photograph, so it has to hold in either theme, and every ink in the
          system flips with the stock it is printed on. */}
      <figcaption className="readout absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-3 text-white">
        {caption}
      </figcaption>
      {/* The boop's registration marks - real elements, because the
          cut-corners pseudos are unreachable from script. At rest they are
          invisible and inside the frame; the press stamps them 2px inward,
          since the frame's overflow-hidden would clip an outward pop. */}
      <span
        aria-hidden
        data-slot="boop-tick"
        className="pointer-events-none absolute top-1.5 left-1.5 h-2 w-2 border-t-2 border-l-2 border-ember opacity-0"
      />
      <span
        aria-hidden
        data-slot="boop-tick"
        className="pointer-events-none absolute right-1.5 bottom-1.5 h-2 w-2 border-r-2 border-b-2 border-ember opacity-0"
      />
      <span
        aria-hidden
        data-slot="boop-flash"
        className="pointer-events-none absolute inset-0 bg-white opacity-0"
      />
    </figure>
  );
}
