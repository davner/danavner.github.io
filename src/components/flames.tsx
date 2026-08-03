import { cn } from "@/lib/utils";

/** One repeating tile of the flame band, in SVG user units. */
const TILE_WIDTH = 240;
const TILE_HEIGHT = 40;
/** Thickness of the hairline the licks rise off, drawn along the bottom edge. */
const BASE = 3;
const GROUND = TILE_HEIGHT - BASE;

/**
 * One tile of the flame job: a run of bare hairline, then a lick. Widths must
 * sum to `TILE_WIDTH` so the tile repeats without a seam, and nothing here is
 * evenly spaced - a flame job on a grid reads as bunting.
 */
const LICKS = [
  { gap: 30, width: 34, height: 33 },
  { gap: 16, width: 26, height: 19 },
  { gap: 24, width: 30, height: 27 },
  { gap: 40, width: 40, height: 13 },
];

/**
 * Hot-rod flames, the kind painted down the side of a Vans slip-on: licks that
 * rise off the line in a long lazy lean, taper to a point, and snap back down.
 */
function tilePath() {
  let x = 0;
  let path = `M0 ${GROUND}`;

  for (const { gap, width, height } of LICKS) {
    x += gap;
    path += ` L${x} ${GROUND}`;

    const tipX = x + width * 0.85;
    const tipY = GROUND - height;

    // Leading edge: leans off the line, then hooks up to the point.
    path += ` C${x + width * 0.35} ${GROUND - height * 0.22} ${tipX - width * 0.08} ${GROUND - height * 0.62} ${tipX} ${tipY}`;
    // Trailing edge: drops back over the last sliver of width, keeping it thin.
    path += ` C${tipX + width * 0.12} ${GROUND - height * 0.55} ${x + width * 0.92} ${GROUND - height * 0.14} ${x + width} ${GROUND}`;

    x += width;
  }

  // Down the right edge, back along the bottom, closed up the left edge.
  return `${path} L${TILE_WIDTH} ${TILE_HEIGHT} L0 ${TILE_HEIGHT} Z`;
}

const FLAME_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH}" height="${TILE_HEIGHT}" viewBox="0 0 ${TILE_WIDTH} ${TILE_HEIGHT}"><path d="${tilePath()}" fill="black"/></svg>`,
)}")`;

/**
 * Drawn as a mask rather than a coloured image so the flames pick up `--ember`
 * and stay right in both themes.
 */
export function Flames({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("h-10 bg-ember opacity-80", className)}
      style={{
        maskImage: FLAME_TILE,
        WebkitMaskImage: FLAME_TILE,
        maskRepeat: "repeat-x",
        WebkitMaskRepeat: "repeat-x",
        maskSize: `${TILE_WIDTH}px ${TILE_HEIGHT}px`,
        WebkitMaskSize: `${TILE_WIDTH}px ${TILE_HEIGHT}px`,
        maskPosition: "bottom left",
        WebkitMaskPosition: "bottom left",
      }}
    />
  );
}
