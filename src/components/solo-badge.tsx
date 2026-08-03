import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Going alone is a different kind of night, so it gets its own marker rather
 * than an empty space where the names would be. Arcade one-player styling,
 * because that is what a solo run is.
 */
export function SoloBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "solo-badge readout inline-flex items-center gap-2 border border-ion/50 px-2.5 py-1 text-ion",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      Solo run
      <span aria-hidden className="border-l border-ion/30 pl-2 opacity-70">
        1P
      </span>
    </span>
  );
}
