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
import { showLocationOf, fullShowDate, support } from "@/lib/show-summary";
import { MAX_RATING, type Show } from "@/lib/shows";
import { SITE_URL } from "@/lib/site";

/** Matches the rating row on the site. */
const HORNS = "\u{1F918}\u{1F3FD}";

/**
 * Renders a show as a shareable poster: the site's own look, sized for an
 * Instagram story, with the URL on it so a screenshot still leads somewhere.
 *
 * The sheet, the palette and the marks that are not a show's own come from
 * `lib/card-canvas.ts`; what is left here is the layout only a show has - the
 * name, the tour, the openers, the rating, and the venue/city/date footer.
 *
 * Never `truncated`: everything a show card prints is a field that fits or a
 * list already capped at three lines, so it has nothing to leave out.
 */
export async function renderShowCard(show: Show, photoIndex = 0): Promise<Card> {
  const { canvas, context, palette } = await createCard();

  // Whichever photo was picked in the share panel. An out-of-range index falls
  // back to the first rather than rendering a photoless card, which would look
  // like the picture failed to load.
  const chosen = show.photos[photoIndex] ?? show.photos[0];
  const photo = chosen ? await loadImage(chosen.src) : null;

  const photoHeight = photo ? 900 : 0;
  if (photo) drawTopPhoto(context, photo, photoHeight, palette);

  drawBloom(context, photoHeight + 40, palette);

  // With no photo the top of the card is just the ember bloom, so the block
  // starts lower and sits between the glow and the footer rule instead of
  // stranding itself at the top with 700px of empty space underneath.
  let y = photo ? photoHeight + 40 : 620;

  drawReadout(context, "Show log", y, palette.ember);
  y += 74;

  // Just the name. `showHeading` folds the subtitle in, which is right for a
  // link-preview title but would print the tour twice here now that it is set
  // as its own line underneath.
  const heading = show.title.toUpperCase();
  let size = 132;
  let lines: string[] = [];
  for (; size >= 64; size -= 8) {
    context.font = `400 ${size}px Anton, system-ui, sans-serif`;
    lines = wrap(context, heading, WIDTH - PAD * 2);
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
    for (const line of wrap(context, show.subtitle.toUpperCase(), WIDTH - PAD * 2).slice(0, 2)) {
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
    const maxWidth = WIDTH - PAD * 2;
    const body = wrap(context, openers.join(", "), maxWidth, maxWidth - prefixWidth).slice(0, 3);

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

  // Venue, city, and date pinned to the bottom with a hairline over them.
  const footerTop = HEIGHT - 300;
  drawHairline(context, footerTop, palette);

  y = footerTop + 66;
  context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
  context.fillStyle = palette.ink;
  const where = showLocationOf(show);
  if (where) {
    context.fillText(where, PAD, y);
    y += 52;
  }
  context.fillStyle = palette.dim;
  context.fillText(fullShowDate(show), PAD, y);

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
