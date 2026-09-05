/**
 * The star ladder's tiers - the stellar sequence from the approved Star Heat
 * specimen (S2-S4): red heat at 4, gold at 4.5, blue-white at 5, plain ink
 * below. Thresholds are the design's quarter-step ladder, spelled here
 * rather than derived from the scale's top: the ladder means something
 * because most records never climb it.
 */
export type HeatTier = "base" | "ember" | "gold" | "blue";

export function tierFor(value: number): HeatTier {
  if (value >= 5) return "blue";
  if (value >= 4.5) return "gold";
  if (value >= 4) return "ember";
  return "base";
}
