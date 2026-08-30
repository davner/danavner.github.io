import { Heart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The counterpart to the solo badge. Same arcade framing, opposite feeling:
 * one player becomes two, and the accent goes from cold to warm.
 */
export function DuoBadge({ partner, className }: { partner: string; className?: string }) {
  return (
    <Badge variant="ember" className={cn("duo-badge gap-2 px-2.5 py-1", className)}>
      <Heart className="duo-heart fill-current" aria-hidden />
      My duo
      {/* Inherits the badge's ember. Ember at half alpha measured 2.61:1 light
          and 2.11:1 dark; a separator is still text and 1.4.3 still applies.
          (Spelled out rather than written as a class: Tailwind scans comments
          along with code, and naming one puts its CSS in the bundle.) */}
      <span aria-hidden>/</span>
      {partner}
      {/* See `solo-badge.tsx`: the hairline separates, the opacity did not
          survive contrast at this size. */}
      <span aria-hidden className="border-l border-ember/30 pl-2">
        2P
      </span>
    </Badge>
  );
}
