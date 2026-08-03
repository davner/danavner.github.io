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
  alt,
  caption,
  className,
  imageClassName,
  width,
  height,
  eager,
}: {
  src: string;
  alt: string;
  caption: string;
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
  /** The hero photo is above the fold and should not wait for lazy loading. */
  eager?: boolean;
}) {
  return (
    <figure className={cn("relative overflow-hidden border border-border", className)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("w-full object-cover", imageClassName)}
      />
      <figcaption className="readout absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-3 text-white">
        {caption}
      </figcaption>
    </figure>
  );
}
