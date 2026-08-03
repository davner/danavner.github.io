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
      <span aria-hidden className="text-ember/50">
        /
      </span>
      {partner}
      <span aria-hidden className="border-l border-ember/30 pl-2 opacity-70">
        2P
      </span>
    </Badge>
  );
}
