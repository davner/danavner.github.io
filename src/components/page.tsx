import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-14">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {lede ? (
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
          {lede}
        </p>
      ) : null}
      {children}
    </header>
  );
}

export function Section({
  title,
  id,
  className,
  children,
}: {
  title?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("mt-20 first:mt-0", className)}>
      {title ? (
        <div className="mb-8 flex items-center gap-4">
          <h2 className="eyebrow whitespace-nowrap">{title}</h2>
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20", className)}>{children}</div>
  );
}
