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
  excerpt,
  loadImage,
  toBlob,
  wrap,
} from "@/lib/card-canvas";
// The show page renders `show.body` through the same remark-gfm pipeline a now
// entry's prose goes through, so one reader gives both cards the words their
// pages print.
import { nowParagraphs } from "@/lib/now-summary";
import { showLocationOf, fullShowDate, support } from "@/lib/show-summary";
import { MAX_RATING, type Show } from "@/lib/shows";
import { SITE_URL } from "@/lib/site";

/** Matches the rating row on the site. */
const HORNS = "\u{1F918}\u{1F3FD}";

/**
 * The photo band, and the same 700 the now card carries. A show is the only
 * poster with a lineup and a rating standing between its heading and the footer
 * rule, so what the picture takes comes out of the write-up twice over: another
 * 200px of banner leaves a festival card no room for prose at all. Clears
 * `drawTopPhoto`'s `height >= 420` precondition.
 */
const PHOTO_HEIGHT = 700;

/**
 * Where the write-up may be set, and how it is set there.
 *
 * Set smaller than a now entry's body, because this band is whatever the
 * heading, the lineup and the rating left rather than the body of the sheet. At
 * the now card's size a festival has room for one line, which reads as a stub
 * rather than as an excerpt.
 */
const LINE = 46;
const PARAGRAPH_GAP = 28;
const BODY_FONT = '400 34px "Inter Variable", system-ui, sans-serif';

/** The rule over the footer, and the last line the write-up may reach. */
const FOOTER_TOP = HEIGHT - 300;
const BODY_BOTTOM = FOOTER_TOP - 64;

const MAX_WIDTH = WIDTH - PAD * 2;

/**
 * Renders a show as a shareable poster: the site's own look, sized for an
 * Instagram story, with the URL on it so a screenshot still leads somewhere.
 *
 * The sheet, the palette and the marks that are not a show's own come from
 * `lib/card-canvas.ts`; what is left here is the layout only a show has - the
 * name, the tour, the openers, the rating, and the venue/city/date footer.
 *
 * Never `truncated`. The flag is a claim that the card could not say the thing
 * it is read for, and a show card is read for the night: the name, the tour,
 * the bill, the rating, the room. Every one of those is a field that fits or a
 * list already capped at three lines. A write-up cut down to an excerpt is what
 * an excerpt is, so it reports itself through the footer line over the address
 * instead, the way `renderAlbumCard` reports a cut review.
 */
export async function renderShowCard(show: Show, photoIndex = 0): Promise<Card> {
  const { canvas, context, palette } = await createCard();

  // Whichever photo was picked in the share panel. An out-of-range index falls
  // back to the first rather than rendering a photoless card, which would look
  // like the picture failed to load.
  const chosen = show.photos[photoIndex] ?? show.photos[0];
  const photo = chosen ? await loadImage(chosen.src) : null;

  const photoHeight = photo ? PHOTO_HEIGHT : 0;
  if (photo) drawTopPhoto(context, photo, photoHeight, palette);

  drawBloom(context, photoHeight + 40, palette);

  // With no photo the top of the card is just the ember bloom, so the block
  // starts lower and sits between the glow and the footer rule instead of
  // stranding itself at the top with 700px of empty space underneath.
  let y = photo ? photoHeight + 40 : 620;

  drawReadout(context, "Show log", y, palette.ember);
  y += 74;

  // Just the name. `showHeading` folds the subtitle in, which is right for a
  // link-preview title but would print the tour twice here, since it is set
  // as its own line underneath.
  const heading = show.title.toUpperCase();
  let size = 132;
  let lines: string[] = [];
  for (; size >= 64; size -= 8) {
    context.font = `400 ${size}px Anton, system-ui, sans-serif`;
    lines = wrap(context, heading, MAX_WIDTH);
    if (lines.length <= 3) break;
  }

  context.fillStyle = palette.ink;
  for (const line of lines) {
    y += size * 0.92;
    context.fillText(line, PAD, y);
  }

  // The tour, or which day of a festival - the same subtitle the page prints
  // under the heading, so a shared card says which night this was rather than
  // just which band. Wrapped, because a tour name can run long.
  if (show.subtitle) {
    context.font = '500 30px "JetBrains Mono Variable", ui-monospace, monospace';
    context.letterSpacing = "6px";
    context.fillStyle = palette.dim;
    for (const line of wrap(context, show.subtitle.toUpperCase(), MAX_WIDTH).slice(0, 2)) {
      y += 46;
      context.fillText(line, PAD, y);
    }
    context.letterSpacing = "0px";
  }

  y += 64;

  const openers = support(show);
  if (openers.length > 0) {
    context.font = '400 36px "Inter Variable", system-ui, sans-serif';

    const prefix = "w/ ";
    const prefixWidth = context.measureText(prefix).width;
    const body = wrap(context, openers.join(", "), MAX_WIDTH, MAX_WIDTH - prefixWidth).slice(0, 3);

    // The site prints `w/` in ember and the bands in muted grey. The card is
    // the same mark, so it gets the same two colours.
    context.fillStyle = palette.ember;
    context.fillText(prefix.trimEnd(), PAD, y);

    body.forEach((line, index) => {
      context.fillStyle = palette.dim;
      context.fillText(line, index === 0 ? PAD + prefixWidth : PAD, y);
      y += 52;
    });
    y += 16;
  }

  if (show.rating != null) {
    // The same horns the site rates with, rounded to whole ones. The exact
    // value sits next to them, so a 4.5 is not misread as a 5.
    const horns = HORNS.repeat(Math.max(Math.round(show.rating), 1));
    context.font = "400 56px system-ui, sans-serif";
    context.fillStyle = palette.ink;
    // Measured under the emoji font, not the mono one set below, or the value
    // lands on top of the horns.
    const hornsWidth = context.measureText(horns).width;
    context.fillText(horns, PAD, y + 44);

    context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
    context.fillStyle = palette.ember;
    context.fillText(
      `${Number(show.rating.toFixed(1))} / ${MAX_RATING}`,
      PAD + hornsWidth + 32,
      y + 40,
    );
    y += 108;
  }

  /*
   * The write-up, out of whatever the blocks above left between them and the
   * footer rule. Last in the order because it is the one thing on the card with
   * no fixed size: the name, the bill and the rating are what a show is filed
   * under and each of them keeps every line it wants, so the prose takes what
   * is left rather than pushing a lineup off the sheet.
   *
   * A card whose fixed blocks reach the rule leaves nothing, and that is the
   * honest outcome - the excerpt draws no lines and the footer still says where
   * the write-up is.
   */
  context.font = BODY_FONT;
  const { paragraphs, truncated: bodyCut } = excerpt(context, nowParagraphs(show.body), {
    capacity: BODY_BOTTOM - y,
    line: LINE,
    gap: PARAGRAPH_GAP,
    maxWidth: MAX_WIDTH,
  });

  context.fillStyle = palette.ink;
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) y += PARAGRAPH_GAP;
    for (const line of paragraph) {
      y += LINE;
      context.fillText(line, PAD, y);
    }
  });

  // Venue, city, and date pinned to the bottom with a hairline over them.
  drawHairline(context, FOOTER_TOP, palette);

  y = FOOTER_TOP + 66;
  context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
  context.fillStyle = palette.ink;
  const where = showLocationOf(show);
  if (where) {
    context.fillText(where, PAD, y);
    y += 52;
  }
  context.fillStyle = palette.dim;
  context.fillText(fullShowDate(show), PAD, y);

  /*
   * The write-up is a few lines of a page, and on a card the lineup has filled
   * it is none at all, so without this line nothing on the sheet says the night
   * was written about. Drawn only where the card left some of it behind: a show
   * whose write-up fitted whole, and one with nothing written about it, have
   * nowhere further to send anyone.
   */
  if (bodyCut) drawReadout(context, "Full write-up at", FOOTER_TOP + 166, palette.dim, 28);

  drawReadout(
    context,
    `${SITE_URL.replace(/^https?:\/\//, "")}/shows`,
    HEIGHT - 74,
    palette.ember,
    30,
  );

  return { blob: await toBlob(canvas) };
}

export function showUrl(show: Pick<Show, "slug">): string {
  return `${SITE_URL}/shows/${show.slug}`;
}
