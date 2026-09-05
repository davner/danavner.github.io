import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16", className)}>
      {children}
    </div>
  );
}

/**
 * How big the display face is set, by how much title there is to set. Both
 * live here rather than being spelled out at the call site, so a page cannot
 * quietly invent a third size.
 */
const TITLE_SIZE = {
  /** One or two short words, set as large as the page will carry. */
  default: "text-poster",
  /**
   * A whole phrase. Same face, sized so a long line still clears a 320px
   * screen without breaking mid-word.
   */
  long: "text-poster-long",
} as const;

/**
 * Page title block. `title` is set in the display face at poster scale, so it
 * wants one or two short words - long phrases go in `lede`, or set
 * `size="long"` when the title itself is the phrase.
 */
export function PageHeader({
  title,
  catalogue,
  catalogueAside,
  lede,
  children,
  aside,
  asideAlign = "end",
  size = "default",
}: {
  title: ReactNode;
  /**
   * The page's catalogue line, like "DA-005 · SHOWS", spelled by
   * `catalogueLine` in `lib/routes.ts`. Section pages carry one; content
   * pages - a show, a post, an album - are items in the catalogue rather than
   * pages of it and pass nothing, and the home page is the cover.
   */
  catalogue?: string;
  /**
   * Real content sharing the catalogue's row, right-aligned - dan.fm's
   * on-air badge. Its own slot rather than a child of the catalogue line,
   * because that line is aria-hidden decoration and this is not: the badge
   * keeps its sr-only prefix and its place in the accessibility tree.
   */
  catalogueAside?: ReactNode;
  lede?: ReactNode;
  /** Picks the display size. See `TITLE_SIZE`. */
  size?: keyof typeof TITLE_SIZE;
  children?: ReactNode;
  /**
   * Optional media shown beside the title on large screens and stacked below it
   * on small ones, the way the home hero pairs its photo with the wordmark.
   */
  aside?: ReactNode;
  /**
   * How the aside lines up with the title column. `end` sits it at the bottom
   * (good when the media is shorter than the text); `start` tops it out level
   * with the title (good when the media is the taller column).
   */
  asideAlign?: "start" | "end";
}) {
  const intro = (
    <>
      {/* The catalogue line is hidden from AT on purpose: it restates the h1
          plus a decorative serial, and exposing it would put mono noise before
          every page title in a screen reader. The aside shares its row without
          sharing that hiding. */}
      {catalogue || catalogueAside ? (
        <div className="mb-4 flex items-center justify-between gap-4">
          {catalogue ? (
            <p aria-hidden className="readout-dim">
              {catalogue}
            </p>
          ) : null}
          {catalogueAside}
        </div>
      ) : null}

      <h1 className={cn("display", TITLE_SIZE[size])}>{title}</h1>

      {/* `mt-6` is the standing gap under a page title, whatever follows it -
          a lede here, a fact line on the detail pages, the kicker on the
          landing page. */}
      {lede ? (
        <p className="mt-6 max-w-2xl text-lede leading-relaxed text-muted-foreground text-pretty">
          {lede}
        </p>
      ) : null}

      {children}
    </>
  );

  return (
    <header className="mb-16">
      {aside ? (
        <div
          className={cn(
            "grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12",
            asideAlign === "start" ? "lg:items-start" : "lg:items-end",
          )}
        >
          <div>{intro}</div>
          <div className={asideAlign === "end" ? "lg:pb-1" : undefined}>{aside}</div>
        </div>
      ) : (
        intro
      )}
    </header>
  );
}

export function Section({
  title,
  id,
  className,
  action,
  children,
}: {
  title?: string;
  id?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    // The major section break steps down on a phone: 6rem of air between
    // sections reads as leisure at desk widths and as dead screen at 390px.
    <section id={id} className={cn("mt-16 first:mt-0 sm:mt-24", className)}>
      {title ? (
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-3">
          <h2 className="display text-heading">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
