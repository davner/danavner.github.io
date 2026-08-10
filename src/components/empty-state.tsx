import type { ReactNode } from "react";

import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * The "nothing here" panel, in the house style.
 *
 * Three pages had spelled the same dashed box out for themselves, which is
 * exactly the drift the seams and the nav lists have already been through: the
 * padding was `p-16` in all three only by coincidence, and the next one would
 * have picked its own.
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
