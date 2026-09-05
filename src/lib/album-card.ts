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
  markCut,
  toBlob,
  wrap,
} from "@/lib/card-canvas";
import type { Album } from "@/lib/dan-fm";
import { plainText } from "@/lib/dan-fm-markdown";
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

/**
 * The sizes the title is fitted between, and the step between them. A heading
 * that will not hold two lines at the smallest of them is set there anyway and
 * takes the room a third line needs from the body below it.
 */
const HEADING_MAX = 120;
const HEADING_MIN = 56;
const HEADING_STEP = 8;

/** Where the take may be set, and how it is set there. */
const LINE = 56;
const BODY_FONT = '400 40px "Inter Variable", system-ui, sans-serif';

/**
 * The excerpt of the long review under the take: smaller and set in the dim
 * ink, so the take stays the sentence the card is read for and this reads as
 * the paragraph it was lifted from rather than as a second verdict.
 */
const MAX_REVIEW_LINES = 2;
const REVIEW_LINE = 46;
const REVIEW_FONT = '400 34px "Inter Variable", system-ui, sans-serif';

/** The air between the take's last line and the excerpt's first. */
const REVIEW_GAP = 36;

/** The rule over the footer, and the last line the body may reach. */
const FOOTER_TOP = HEIGHT - 300;
const BODY_BOTTOM = FOOTER_TOP - 64;

const MAX_WIDTH = WIDTH - PAD * 2;

/**
 * `lines` cut to `capacity`, the last one marked where anything was left out.
 *
 * Neither block has paragraphs to cut between the way a now entry has: a take
 * is one written sentence or three, and the excerpt is up to two lines off the
 * front of the review whatever it is made of. So the lines that fit are taken
 * and the last one carries the mark that says so.
 *
 * A capacity under zero is a block measured out of a sheet with nothing left,
 * and it means the same as zero. Clamped here rather than at either caller,
 * because an empty block against a negative capacity otherwise reports
 * `truncated` having cut nothing, and that flag is a claim about the subject.
 */
function fit(lines: string[], capacity: number): { lines: string[]; truncated: boolean } {
  const room = Math.max(capacity, 0);
  if (lines.length <= room) return { lines, truncated: false };

  const kept = lines.slice(0, room);
  if (kept.length === 0) return { lines: [], truncated: true };

  kept[kept.length - 1] = markCut(kept[kept.length - 1]);
  return { lines: kept, truncated: true };
}

/**
 * The block under the score: the verdict, and as much of the opening of the
 * long review as is left under it.
 *
 * Both are set out of one budget that ends at `BODY_BOTTOM`, and the order they
 * are measured in is the whole of the layout. The take is measured against the
 * whole budget and keeps every line it wants; the excerpt is then cut from what
 * the take left, and the take is fitted into everything the excerpt did not
 * reserve - which is at least the lines it claimed, since the excerpt can only
 * reserve room the take had no use for. So the verdict has first claim on a
 * sheet this tight: it is never shortened to make room for two dim lines, and a
 * verdict that fills the sheet leaves nothing for an excerpt to sit in.
 *
 * Measuring the excerpt against a floor on the take instead hands it room the
 * take is using: every take longer than the floor loses lines it would have
 * been drawn with, which is the opposite of first claim.
 *
 * `truncated` is the take's alone. A cut review is what an excerpt is, not a
 * card that failed to say something, and the share sheet turns that flag into a
 * claim about the whole subject. `reviewCut` reports the excerpt's own cut
 * beside it, for the footer line that says where the rest of the review is - a
 * review the excerpt carried whole leaves nothing to point anyone at.
 *
 * The review's paragraph breaks collapse into the flow, because `wrap` splits
 * on whitespace: two lines has no room to show a break as anything but a hole,
 * and the excerpt is drawn from the opening either way. Sets `context.font`,
 * and leaves it on `REVIEW_FONT`, since lines are measured in the face they are
 * drawn in.
 */
function fitBody(
  context: CanvasRenderingContext2D,
  take: string,
  review: string,
  top: number,
): { take: string[]; truncated: boolean; review: string[]; reviewCut: boolean } {
  const budget = BODY_BOTTOM - top;

  context.font = BODY_FONT;
  const wrapped = wrap(context, take, MAX_WIDTH);
  // What the take draws with nothing under it, which is what it wants rather
  // than what it would settle for.
  const claimed = Math.min(wrapped.length, Math.floor(budget / LINE));
  // The gap spaces the excerpt off a take line, so it costs nothing where there
  // is no take to space it from.
  const gap = claimed > 0 ? REVIEW_GAP : 0;
  const spare = budget - claimed * LINE - gap;

  context.font = REVIEW_FONT;
  const excerpt = fit(
    wrap(context, review, MAX_WIDTH),
    Math.min(Math.floor(spare / REVIEW_LINE), MAX_REVIEW_LINES),
  );

  const reserved = excerpt.lines.length > 0 ? gap + excerpt.lines.length * REVIEW_LINE : 0;
  const { lines, truncated } = fit(wrapped, Math.floor((budget - reserved) / LINE));

  return { take: lines, truncated, review: excerpt.lines, reviewCut: excerpt.truncated };
}

/**
 * One album as a poster.
 *
 * The sheet, the palette and the marks that are not an album's own come from
 * `lib/card-canvas.ts`; what is left here is the layout only an album has - the
 * record, who made it, what it scored, the verdict, and the front of the long
 * review under it.
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
 * The line over it still holds once the album is off air, because the station
 * carries a filterable archive of every album on its own permalink, so a review
 * is reachable from that address and not only on the day it played.
 * Whichever address a reader should land on travels with the link action beside
 * this one in the share panel: the album's on the permalink, the station's on
 * the station.
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
  let size = HEADING_MAX;
  let lines: string[];
  /*
   * The step down is taken inside the body, so `size` still names the
   * measurement `lines` came from once the loop ends. Decrementing in the
   * header lets a title that never fits leave `size` one step under the face
   * it was measured at, and the drawing below then advances by less than the
   * glyphs are tall and sets the lines on top of each other.
   */
  for (;;) {
    context.font = `400 ${size}px Anton, system-ui, sans-serif`;
    lines = wrap(context, heading, MAX_WIDTH);
    if (lines.length <= 2 || size <= HEADING_MIN) break;
    size -= HEADING_STEP;
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
   * a track, and the same row over it clipped to the fraction scored. Most of
   * the log's scores land between whole stars, so a row rounded to whole stars
   * would print four for a 3.5 and leave the number beside it arguing with the
   * picture.
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

  // The verdict, which is the sentence worth sending, and the front of the long
  // review under it. Two lines of it at most: a thousand words set at story
  // scale is a screenshot of an essay, and the page it is excerpted from is
  // where the rest is.
  // The fields carry restricted markdown; the card draws the words alone,
  // through the same stripper the validators spell the contract with.
  const { take, truncated, review, reviewCut } = fitBody(
    context,
    plainText(album.take),
    plainText(album.review),
    y,
  );

  context.font = BODY_FONT;
  context.fillStyle = palette.ink;
  for (const line of take) {
    y += LINE;
    context.fillText(line, PAD, y);
  }

  if (review.length > 0) {
    context.font = REVIEW_FONT;
    context.fillStyle = palette.dim;
    if (take.length > 0) y += REVIEW_GAP;
    for (const line of review) {
      y += REVIEW_LINE;
      context.fillText(line, PAD, y);
    }
  }

  drawHairline(context, FOOTER_TOP, palette);

  y = FOOTER_TOP + 66;
  context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
  context.fillStyle = palette.ink;
  context.fillText(longDate(album.date), PAD, y);
  context.fillStyle = palette.dim;
  context.fillText(`Day ${album.ordinal}`, PAD, y + 52);

  /*
   * The review is at most two dim lines of a piece that runs to a page, and on
   * a sheet the take has filled it is none at all, so without this line a
   * reader has no way of knowing there is more of it. Drawn only where the card
   * left some of the review behind: an album with no review, and one whose
   * review the excerpt carried entire, have nothing further to send anyone to,
   * and a poster advertising a review that is not there is a promise the site
   * cannot keep.
   */
  if (reviewCut) drawReadout(context, "Full review at", FOOTER_TOP + 166, palette.dim, 28);

  drawReadout(
    context,
    `${SITE_URL.replace(/^https?:\/\//, "")}/dan-fm`,
    HEIGHT - 74,
    palette.ember,
  );

  return { blob: await toBlob(canvas), truncated };
}
