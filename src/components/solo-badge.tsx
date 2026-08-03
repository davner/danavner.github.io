import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Going alone is a different kind of night, so it gets its own marker rather
 * than an empty space where the names would be. Arcade one-player styling,
 * because that is what a solo run is.
 */
export function SoloBadge({ className }: { className?: string }) {
  return (
    <Badge variant="ion" className={cn("solo-badge gap-2 px-2.5 py-1", className)}>
      <Sparkles aria-hidden />
      Solo run
      <span aria-hidden className="border-l border-ion/30 pl-2 opacity-70">
        1P
      </span>
    </Badge>
  );
}
