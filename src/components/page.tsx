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
 * Page title block. `title` is set in the display face at poster scale, so it
 * wants one or two short words - long phrases go in `lede`.
 */
export function PageHeader({
  title,
  lede,
  children,
  aside,
  asideAlign = "end",
}: {
  title: ReactNode;
  lede?: ReactNode;
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
      <h1 className="display text-[clamp(3.25rem,13vw,9rem)]">{title}</h1>

      {/* `mt-6` is the standing gap under a page title, whatever follows it -
          a lede here, a fact line on the detail pages, the kicker on the
          landing page. */}
      {lede ? (
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
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
    <section id={id} className={cn("mt-24 first:mt-0", className)}>
      {title ? (
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-3">
          <h2 className="display text-2xl sm:text-3xl">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
