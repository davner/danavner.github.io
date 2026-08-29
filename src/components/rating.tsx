import { MAX_RATING } from "@/lib/shows";
import { cn } from "@/lib/utils";

const HORNS = "🤘🏽";

/**
 * Rating out of five horns.
 *
 * Two stacked copies of the same string - a desaturated one underneath and a
 * full-colour one clipped to `value / MAX` - which gives real partial fill for
 * free and keeps the actual emoji rather than substituting a flat icon for it.
 * The row is decorative; the label carries the value for assistive tech.
 */
export function Rating({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(Math.max(value, 0), MAX_RATING);
  // Rounded once and used for both the label and the bar, so the fill always
  // shows exactly what the accessible label claims. An average like 4.6667
  // reads as 4.7 and is drawn as 4.7, not as two different numbers.
  const shown = Number(clamped.toFixed(1));
  const percent = (shown / MAX_RATING) * 100;
  // Trailing zeros look like false precision on a hand-kept log: 4, not 4.0.
  const label = `${shown} out of ${MAX_RATING}`;
  const row = HORNS.repeat(MAX_RATING);

  return (
    <span
      role="img"
      aria-label={`Rated ${label}`}
      title={label}
      className={cn(
        "relative inline-block text-sm leading-none tracking-[0.15em] select-none",
        className,
      )}
    >
      <span aria-hidden className="whitespace-nowrap opacity-25 grayscale">
        {row}
      </span>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
        style={{ width: `${percent}%` }}
      >
        {row}
      </span>
    </span>
  );
}
