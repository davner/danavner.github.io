import { Rating } from "@/components/rating";
import { coverSrcSet } from "@/lib/covers";
import type { Album } from "@/lib/dan-fm";
import { cn } from "@/lib/utils";

/**
 * The marks an album is drawn with, wherever it is drawn.
 *
 * Two surfaces render the same record - the station's front page shows the
 * newest album in full, and every album has its own permalink - and what lives
 * here is what those two genuinely share. The layout around them is not shared:
 * the front page is a card in a grid and the permalink is a page, and folding
 * both into one component would be a prop per difference.
 */

/**
 * A star instead of the show log's horns. `Rating` paints whatever mark it is
 * handed and takes its colour from the line it sits on, so an album score and a
 * show's rating stay one component drawing one ember.
 */
const STAR = "★";

/**
 * The sleeve.
 *
 * Only ever rendered for an album that has one - what a page without art puts
 * in its place is the page's own decision, and the two make it differently: the
 * front page draws a placeholder because the square is a grid track that would
 * otherwise collapse and leave the card lopsided, while an album's own page
 * simply has no picture that day.
 *
 * `sizes` is the caller's because only the caller knows how wide it lays the
 * sleeve out, and a wrong one is invisible: the browser picks a candidate
 * before there is a layout to measure, so it ships blur or bytes rather than an
 * error.
 */
export function AlbumCover({ cover, sizes }: { cover: string; sizes: string }) {
  return (
    <img
      src={cover}
      srcSet={coverSrcSet(cover) ?? undefined}
      sizes={sizes}
      /* The artist and the album are set in full beside it, so naming the
         sleeve as well would have a screen reader read the record twice. */
      alt=""
      width={500}
      height={500}
      decoding="async"
      className="aspect-square w-full border border-border object-cover"
    />
  );
}

/**
 * The score, and the second one where living with the record changed it.
 *
 * A fragment rather than a row of its own: both surfaces set it on a line of
 * chips they lay out themselves, and a wrapper here would be a second flex
 * container inside the first.
 */
export function AlbumScore({ album }: { album: Album }) {
  return (
    <>
      <Rating value={album.score} mark={STAR} />

      {album.later === null ? (
        <span className="readout-dim">{album.score}</span>
      ) : (
        /* The stars draw the first score, so the second one is written out
           beside them rather than folded into the graphic - and the word is
           spoken where the arrow is only drawn. */
        <span className="readout text-ember">
          {album.score} <span aria-hidden>→</span>
          <span className="sr-only">later</span> {album.later}
        </span>
      )}
    </>
  );
}

/**
 * The two tracks a row can name. Either half may be blank - an album can be
 * worth hearing with no favourite standing out, and one with nothing to skip is
 * the whole point of a good one - so each row appears only when it has a name.
 */
export function AlbumTracks({ album, className }: { album: Album; className?: string }) {
  const rows = [
    { label: "Standout", name: album.standout.name, accent: true },
    { label: "Skip", name: album.skip.name, accent: false },
  ].filter((row) => row.name);

  if (rows.length === 0) return null;

  return (
    <dl className={cn("max-w-2xl", className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 border-t border-border py-2.5"
        >
          <dt className={row.accent ? "readout text-ember" : "readout-dim"}>{row.label}</dt>
          <dd className="text-sm text-pretty">{row.name}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The long piece about the record, set as prose rather than as a readout.
 *
 * `prose-dan` at `max-w-2xl` is how `/now` and `/blog` set body copy, so the
 * measure and the leading a review is read at are the site's rather than this
 * page's. Both are set here rather than passed in, so `className` can move the
 * block without either surface quietly reading its review at another measure.
 *
 * Split rather than parsed. The cell behind it is text somebody typed into a
 * spreadsheet, where a newline is a deliberate break and there is no soft wrap
 * to undo - so every line that has anything on it is a paragraph, and a stray
 * `#` or `*` stays the character it was typed as instead of becoming markup.
 *
 * Split per line rather than on a blank line between them. A sheet exported
 * with CRLF endings holds no `\n\n` anywhere, so a paragraph rule written that
 * way returns the whole review as one block and nothing reports it.
 */
export function AlbumReview({ review, className }: { review: string; className?: string }) {
  const paragraphs = review
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div className={cn("prose-dan max-w-2xl", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
