import Markdown from "react-markdown";

import { ProseAnchor } from "@/components/prose-anchor";
import { Rating } from "@/components/rating";
import { coverSrcSet } from "@/lib/covers";
import { standingScore, type Album } from "@/lib/dan-fm";
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
 * The score as it stands, and the first read where living with it moved it.
 *
 * A fragment rather than a row of its own: both surfaces set it on a line of
 * chips they lay out themselves, and a wrapper here would be a second flex
 * container inside the first.
 */
export function AlbumScore({ album }: { album: Album }) {
  return (
    <>
      <Rating value={standingScore(album)} mark={STAR} heat />

      {album.later === null ? (
        <span className="readout-dim">{album.score}</span>
      ) : (
        /* The stars draw where the album stands, so what is written out beside
           them is the history: first read, arrow, the score the stars show. A
           screen reader gets "rescored from {score}" and no more - the standing
           value is already the rating's own label, and speaking it here too
           would read the verdict twice. */
        <span className="readout text-ember">
          <span className="sr-only">rescored from</span> {album.score}{" "}
          <span aria-hidden>→ {album.later}</span>
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
 * Parsed as restricted CommonMark, no GFM - unlike those two surfaces, so a
 * tilde or a pipe stays the character the author typed. A blank line starts a
 * new paragraph and a lone newline stays inside its own; the constructs the
 * cell may carry are enforced upstream at both gates from one spelling
 * (`src/lib/dan-fm-markdown.ts`), so whatever reaches this renderer is
 * exactly what the validators allow.
 */
export function AlbumReview({ review, className }: { review: string; className?: string }) {
  if (!review.trim()) return null;

  return (
    <div className={cn("prose-dan max-w-2xl", className)}>
      <Markdown components={{ a: ProseAnchor }}>{review}</Markdown>
    </div>
  );
}

/**
 * The sentence worth sending, styled the way both routes set it by hand
 * before it carried markdown. One paragraph by contract - the validators
 * refuse a second - so the styled `p` is the whole surface, and `className`
 * places it. Inline marks ride the browser's own em/strong/code rendering:
 * the take sits outside `prose-dan` on purpose, at the lede step.
 */
export function AlbumTake({ take, className }: { take: string; className?: string }) {
  if (!take.trim()) return null;

  return (
    <Markdown
      components={{
        a: ProseAnchor,
        p: ({ node: _node, ...props }) => (
          <p
            className={cn("max-w-2xl text-lede leading-relaxed text-pretty", className)}
            {...props}
          />
        ),
      }}
    >
      {take}
    </Markdown>
  );
}
