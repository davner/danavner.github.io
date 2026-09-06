import { tierFor } from "@/lib/rating-heat";
import { MAX_RATING } from "@/lib/shows";
import { cn } from "@/lib/utils";

const HORNS = "🤘🏽";

/**
 * `count` marks, with the space after the last one left out of the text.
 *
 * `letter-spacing` lands after every glyph, the last one included, so a plain
 * `mark.repeat(count)` ends with one space of nothing inside its own text run.
 * A `Range` measures text runs, and `responsive.spec`'s stat sweep reads a row
 * with one - so it counts that empty space as ink, and reads the average tile
 * on `/shows` as overflowing at the width where the stat board is tightest,
 * while every glyph sits well inside it. The last mark sets no tracking and
 * `Rating` reserves the space as padding instead, so the row still spans
 * `MAX_RATING` equal cells - a mark plus its tracking - and nothing repaints.
 *
 * Dropping the space rather than moving it is the near alternative, and it
 * does repaint: the row narrows by one space, which pulls whatever follows it
 * left and shrinks the base the fill's percentage divides, so a 4.5 draws well
 * under half of its last mark. The row cannot give way to the tile instead -
 * it is `nowrap` because the fill's clip needs one unbroken line, so it would
 * cut a glyph rather than narrow - and widening the tile would move three
 * pages' stat boards to settle one row.
 */
function Marks({ mark, count }: { mark: string; count: number }) {
  if (count < 1) return null;
  return (
    <>
      {mark.repeat(count - 1)}
      <span className="tracking-normal">{mark}</span>
    </>
  );
}

/**
 * Rating out of five marks, horns by default.
 *
 * Two stacked copies of the same string - a desaturated one underneath and a
 * full-colour one clipped to `value / MAX` - which gives real partial fill for
 * free and keeps the real glyph rather than substituting a flat icon for it.
 * The row is decorative; the label carries the value for assistive tech.
 *
 * The label is the only place it is carried. A `title` here would become the
 * accessible description as well, and a screen reader then reads the number
 * twice - "Rated 4 out of 5, image, 4 out of 5" - because a description sits
 * alongside a name rather than replacing it.
 */
export function Rating({
  value,
  mark = HORNS,
  heat = false,
  className,
}: {
  value: number;
  /**
   * The glyph repeated `MAX_RATING` times, drawn in both rows: the dim track and
   * the copy clipped to `value / MAX_RATING`. Paint only - both rows are already
   * `aria-hidden` and the name stays "Rated {n} out of {MAX_RATING}".
   *
   * It never draws a second score. `/dan-fm` draws the score an album stands
   * at and writes a rescore's history as its own `4.5 -> 3.5` readout beside
   * the row, so the graphic and the name describe the same single number; a
   * mark painting two would leave a one-number name incomplete.
   *
   * A string rather than a code point, because the default is an emoji plus a
   * skin-tone modifier and no single number expresses that pair.
   */
  mark?: string;
  /**
   * The dan.fm ladder (the Star Heat specimen's S6): the fill's ink climbs
   * with the drawn score, keyed by `data-tier` for `index.css`'s attribute
   * rules. Explicit rather than derived from the mark, so a second
   * star-marked surface can never inherit the dress unasked - `AlbumScore`
   * is the only setter, and horns and /shows never set it.
   */
  heat?: boolean;
  className?: string;
}) {
  const clamped = Math.min(Math.max(value, 0), MAX_RATING);
  // Rounded once and used for both the label and the bar, so the fill always
  // shows exactly what the accessible label claims. An average like 4.6667
  // reads as 4.67 and is drawn as 4.67, not as two different numbers. Two
  // places rather than one because `/dan-fm` scores in quarter steps and prints
  // the number beside this row: at one place the label would name 4.3 next to a
  // visible 4.25.
  const shown = Number(clamped.toFixed(2));
  const percent = (shown / MAX_RATING) * 100;
  // Trailing zeros look like false precision on a hand-kept log: 4, not 4.0.
  const label = `${shown} out of ${MAX_RATING}`;
  // The tier keys on the number the row draws - `shown`, clamped and rounded
  // - never on a raw value the caller passed, so the dress can never disagree
  // with the label.
  const tier = heat ? tierFor(shown) : null;

  return (
    <span
      role="img"
      aria-label={`Rated ${label}`}
      data-tier={tier ?? undefined}
      // `isolate` so the glow layer's negative z-index stays inside this
      // span's own stacking context instead of dropping behind the row's
      // background.
      //
      // The padding is the last mark's tracking, held here rather than in the
      // row's text - see `Marks`. It keeps the box `MAX_RATING` whole cells
      // wide, which is the base every percentage below divides: the fill's
      // `value / MAX_RATING` lands on a cell boundary only because the fifth
      // cell's tracking is inside it.
      className={cn(
        "isolate relative inline-block pr-[0.15em] text-sm leading-none tracking-[0.15em] select-none",
        className,
      )}
    >
      <span aria-hidden className="whitespace-nowrap opacity-25 grayscale">
        <Marks mark={mark} count={MAX_RATING} />
      </span>
      <span
        aria-hidden
        // The hook the needle sweep in `index.css` animates from zero; the
        // inline width stays the single source of the value.
        data-slot="rating-fill"
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
        style={{ width: `${percent}%` }}
      >
        {/* One DOM shape under heat at every tier - per-star spans so the
            five's dress can address a single star - and `Marks` otherwise,
            byte-identical to the horns' rendering. The last star sheds its
            tracking for the reason `Marks` does. */}
        {tier ? (
          Array.from({ length: MAX_RATING }, (_, index) => (
            <span
              key={index}
              data-slot="rating-star"
              className={index === MAX_RATING - 1 ? "tracking-normal" : undefined}
            >
              {mark}
            </span>
          ))
        ) : (
          <Marks mark={mark} count={MAX_RATING} />
        )}
      </span>
      {/* The sheen carrier rides after the fill so the fill stays the second
          child, which the clip test reads by position. Masked off-canvas at
          rest; only the five's crossing ever moves it. */}
      {tier === "blue" ? (
        <span aria-hidden data-slot="rating-sheen">
          <Marks mark={mark} count={MAX_RATING} />
        </span>
      ) : null}
      {/* The glow lives on its own unclipped layer - transparent glyphs whose
          text-shadow is the whole paint - because a glow inside the fill's
          width clip cuts off in a straight line, and a straight-edged bloom
          reads as a box rather than light. Whole stars only: a fractional
          star's missing halo is imperceptible, and these tiers start at 4.5. */}
      {tier === "gold" || tier === "blue" ? (
        <span aria-hidden data-slot="rating-glow">
          <Marks mark={mark} count={Math.floor(shown)} />
        </span>
      ) : null}
    </span>
  );
}
