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
  eyebrow,
  title,
  lede,
  meta,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Small mono readouts shown along the top rule. */
  meta?: string[];
  children?: ReactNode;
}) {
  return (
    <header className="mb-16">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3">
        <p className="readout text-ember">{eyebrow}</p>
        {meta?.length ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {meta.map((item) => (
              <li key={item} className="readout-dim">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <h1 className="display mt-6 text-[clamp(3.25rem,13vw,9rem)]">{title}</h1>

      {lede ? (
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
          {lede}
        </p>
      ) : null}

      {children}
    </header>
  );
}

export function Section({
  title,
  index,
  id,
  className,
  action,
  children,
}: {
  title?: string;
  /** Tracklist-style number shown before the title. */
  index?: string;
  id?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("mt-24 first:mt-0", className)}>
      {title ? (
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-3">
          <h2 className="flex items-baseline gap-3">
            {index ? <span className="font-mono text-xs text-ember">{index}</span> : null}
            <span className="display text-2xl sm:text-3xl">{title}</span>
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
