import {
  type Card,
  HEIGHT,
  PAD,
  WIDTH,
  createCard,
  drawBloom,
  drawHairline,
  drawReadout,
  drawTopPhoto,
  loadImage,
  toBlob,
  wrap,
} from "@/lib/card-canvas";
import type { Album } from "@/lib/dan-fm";
import { MAX_SCORE } from "@/lib/dan-fm-summary";
import { longDate } from "@/lib/dates";
import { SITE_URL } from "@/lib/site";

/** Matches the score row on the page. */
const STAR = "★";

/**
 * The sleeve band. Shorter than the show card's 900 because an album has a
 * verdict to print under it rather than a lineup, and clear of `drawTopPhoto`'s
 * `height >= 420` precondition either way.
 */
const SLEEVE_HEIGHT = 760;

/** Where the take may be set, and how it is set there. */
const LINE = 56;
const BODY_FONT = '400 40px "Inter Variable", system-ui, sans-serif';

/** The rule over the footer, and the last line the take may reach. */
const FOOTER_TOP = HEIGHT - 300;
const BODY_BOTTOM = FOOTER_TOP - 64;

const MAX_WIDTH = WIDTH - PAD * 2;

/**
 * As much of the take as the card holds, and whether anything was left out.
 *
 * A take is one written sentence or three, so there are no paragraphs to cut
 * between the way a now entry has - the lines that fit are taken and the last
 * one carries an ellipsis. Assumes `context.font` is already `BODY_FONT`.
 */
function fitTake(
  context: CanvasRenderingContext2D,
  take: string,
  top: number,
): { lines: string[]; truncated: boolean } {
  const capacity = Math.max(Math.floor((BODY_BOTTOM - top) / LINE), 0);
  const lines = wrap(context, take, MAX_WIDTH);
  if (lines.length <= capacity) return { lines, truncated: false };

  const kept = lines.slice(0, capacity);
  if (kept.length === 0) return { lines: [], truncated: true };

  // The trailing full stop goes with it, or a line that already ended a
  // sentence reads as "shot...." - four dots, which looks like a typo rather
  // than like a cut. A `?` or `!` is kept, since the ellipsis stands in for
  // neither.
  kept[kept.length - 1] = `${kept[kept.length - 1].replace(/\.\s*$/, "")}…`;
  return { lines: kept, truncated: true };
}

/**
 * One album as a poster.
 *
 * The sheet, the palette and the marks that are not an album's own come from
 * `lib/card-canvas.ts`; what is left here is the layout only an album has - the
 * record, who made it, what it scored, and the one-line verdict.
 *
 * Drawn without a sleeve as readily as with one. The log carries a cover path
 * only where art was saved, and unlike a now entry there is plenty left when
 * there is none: the title is set at poster scale and the score and the take
 * fill the sheet under it. A sleeve that will not decode costs the card its
 * picture and nothing else, which is `loadImage`'s null and the same bargain
 * `renderShowCard` takes.
 *
 * The address printed at the foot is the station rather than the album. A
 * slug-length URL set in the readout face runs half again as wide as the card
 * and shrinking it to fit puts it under the size anyone can read off a story.
 * The album's own address travels with the link action beside this one in the
 * share panel.
 */
export async function renderAlbumCard(album: Album): Promise<Card> {
  const { canvas, context, palette } = await createCard();

  const sleeve = album.cover ? await loadImage(album.cover) : null;
  const sleeveHeight = sleeve ? SLEEVE_HEIGHT : 0;
  if (sleeve) drawTopPhoto(context, sleeve, sleeveHeight, palette);

  drawBloom(context, sleeveHeight + 40, palette);

  // With no sleeve the top of the card is the ember bloom alone, so the block
  // starts lower and sits between the glow and the footer rule instead of
  // stranding itself at the top with 600px of empty space underneath.
  let y = sleeve ? sleeveHeight + 40 : 620;

  drawReadout(context, "dan.fm", y, palette.ember);
  y += 74;

  // Two lines rather than the show card's three: an album that needs a third
  // has pushed the score and the take through the footer rule, and there is a
  // sleeve above it on the days there is art.
  const heading = album.album.toUpperCase();
  let size = 120;
  let lines: string[] = [];
  for (; size >= 56; size -= 8) {
    context.font = `400 ${size}px Anton, system-ui, sans-serif`;
    lines = wrap(context, heading, MAX_WIDTH);
    if (lines.length <= 2) break;
  }

  context.fillStyle = palette.ink;
  for (const line of lines) {
    y += size * 0.92;
    context.fillText(line, PAD, y);
  }

  // Who made it, and when. The page sets the same pair under the title, and a
  // year that came off a reissue says so there rather than printing a pressing
  // date as though it were the release.
  const credit = [album.artist, album.year === null ? "" : String(album.year)]
    .filter(Boolean)
    .join(" · ");
  context.font = '500 30px "JetBrains Mono Variable", ui-monospace, monospace';
  context.letterSpacing = "6px";
  context.fillStyle = palette.dim;
  // Air under a title set four times its size, before the readout's own
  // line spacing takes over for a credit long enough to wrap.
  y += 16;
  for (const line of wrap(context, credit.toUpperCase(), MAX_WIDTH).slice(0, 2)) {
    y += 46;
    context.fillText(line, PAD, y);
  }
  context.letterSpacing = "0px";

  y += 64;

  /*
   * The score, drawn the way the page draws it: a full row of stars dimmed to
   * a track, and the same row over it clipped to the fraction scored. Half the
   * log's scores are half steps, so a row rounded to whole stars would print
   * four for a 3.5 and leave the number beside it arguing with the picture.
   */
  context.font = "400 56px system-ui, sans-serif";
  const row = STAR.repeat(MAX_SCORE);
  // Measured under the face the stars are drawn in, not the mono one set below,
  // or the value lands on top of them.
  const rowWidth = context.measureText(row).width;

  context.fillStyle = palette.dim;
  context.fillText(row, PAD, y + 44);

  context.save();
  context.beginPath();
  // Tall enough to clear the glyph above and below its baseline, which is what
  // decides whether the clip trims the stars or the row of them.
  context.rect(PAD, y - 8, rowWidth * (album.score / MAX_SCORE), 80);
  context.clip();
  context.fillStyle = palette.ink;
  context.fillText(row, PAD, y + 44);
  context.restore();

  context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
  context.fillStyle = palette.ember;
  context.fillText(`${album.score} / ${MAX_SCORE}`, PAD + rowWidth + 32, y + 40);
  y += 108;

  // The verdict, which is the sentence worth sending. The long review is the
  // album's page rather than its poster: a thousand words set at story scale
  // is a screenshot of an essay.
  context.font = BODY_FONT;
  const { lines: take, truncated } = fitTake(context, album.take, y);
  context.fillStyle = palette.ink;
  for (const line of take) {
    y += LINE;
    context.fillText(line, PAD, y);
  }

  drawHairline(context, FOOTER_TOP, palette);

  y = FOOTER_TOP + 66;
  context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
  context.fillStyle = palette.ink;
  context.fillText(longDate(album.date), PAD, y);
  context.fillStyle = palette.dim;
  context.fillText(`Day ${album.ordinal}`, PAD, y + 52);

  drawReadout(
    context,
    `${SITE_URL.replace(/^https?:\/\//, "")}/dan-fm`,
    HEIGHT - 74,
    palette.ember,
  );

  return { blob: await toBlob(canvas), truncated };
}
