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
      {/* Inherits the badge's ember. A separator is still text, so 1.4.3 still
          asks 4.5:1 of it, and ember at half alpha clears that in neither
          theme. (Spelled out rather than written as a class: Tailwind scans
          comments along with code, and naming one puts its CSS in the bundle.) */}
      <span aria-hidden>/</span>
      {partner}
      {/* See `solo-badge.tsx`: the hairline separates, because an opacity here
          does not clear what 1.4.3 asks. */}
      <span aria-hidden className="border-l border-ember/30 pl-2">
        2P
      </span>
    </Badge>
  );
}
