import type { ReactNode } from "react";

import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * The "nothing here" panel, in the house style.
 *
 * One component, so the dashed box cannot drift page to page - three pages
 * render it, and the next one would otherwise pick its own padding.
 *
 * Square corners rather than the component's default `rounded-lg`, because
 * nothing else on this site is rounded.
 */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Empty className={cn("rounded-none border border-dashed border-border p-16", className)}>
      <EmptyHeader>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
