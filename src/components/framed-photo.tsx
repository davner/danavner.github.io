import { cn } from "@/lib/utils";

/**
 * A photo in the site's frame, with its caption printed over the bottom of the
 * image.
 *
 * The show carousel established this treatment and every other photo on the
 * site now uses it, so a caption always sits on the picture it belongs to
 * rather than floating under it in a different style.
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
  return (
    <figure className={cn("relative overflow-hidden border border-border", className)}>
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
    </figure>
  );
}
