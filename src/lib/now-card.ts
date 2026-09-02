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
} from "@/lib/card-canvas";
import type { NowEntry } from "@/lib/now";
import { nowDate, nowParagraphs } from "@/lib/now-summary";
import { SITE_URL } from "@/lib/site";

/**
 * The photo band. A banner over the prose rather than a third of the sheet:
 * every line the picture gives up is a line of the entry the reader gets to
 * read here instead of on the page. Clears `drawTopPhoto`'s `height >= 420`
 * precondition.
 */
const PHOTO_HEIGHT = 700;

/**
 * Where the excerpt may be set. The top is tied to the photo because the date
 * headline sits between the two: the readout and the heading put its baseline
 * at `PHOTO_HEIGHT + 202`, so the band opens clear of the headline's descenders
 * at whatever height the picture is set to.
 */
const BAND_TOP = PHOTO_HEIGHT + 220;
const BAND_BOTTOM = 1696;
const LINE = 56;
const PARAGRAPH_GAP = 28;
const BODY_FONT = '400 40px "Inter Variable", system-ui, sans-serif';

const MAX_WIDTH = WIDTH - PAD * 2;

/**
 * A now entry as a poster.
 *
 * Only ever called for an entry that has photos. Without one the top third of
 * the card is empty and the biggest thing on it is a date, which is a
 * screenshot of a calendar rather than something worth sending - so the sheet
 * offers the link alone instead.
 *
 * Rejects when the chosen photo cannot be decoded, and that is a deliberate
 * divergence from `renderShowCard`. `loadImage` resolves null on error so a
 * show loses its picture and keeps its card, which is right there: a show still
 * has a name, a lineup, a rating, a venue and a date to fill the canvas. A now
 * entry has a date. So this degrades to the link rather than to a worse card,
 * which is exactly what moving the link actions out of the `card` branch made
 * safe.
 *
 * The failure is rare - the build already checked the file exists, so a null
 * here means the browser could not fetch or decode something that is in the
 * deploy - but rare is not never.
 */
export async function renderNowCard(entry: NowEntry, photoIndex = 0): Promise<Card> {
  const { canvas, context, palette } = await createCard();

  // An out-of-range index falls back to the first, matching `renderShowCard`.
  const chosen = entry.photos[photoIndex] ?? entry.photos[0];
  const photo = chosen ? await loadImage(chosen.src) : null;
  if (!photo) throw new Error("could not load the photo for the card");

  drawTopPhoto(context, photo, PHOTO_HEIGHT, palette);
  drawBloom(context, PHOTO_HEIGHT + 40, palette);

  let y = PHOTO_HEIGHT + 40;
  drawReadout(context, "Right now", y, palette.ember);
  y += 74;

  // The date is the entry's whole identity, so it is set as the headline. One
  // line, always - it shrinks to fit rather than wrapping, because a date
  // broken across two lines reads as two dates.
  const heading = nowDate(entry).toUpperCase();
  let size = 96;
  for (; size > 64; size -= 8) {
    context.font = `400 ${size}px Anton, system-ui, sans-serif`;
    if (context.measureText(heading).width <= MAX_WIDTH) break;
  }
  // Set once more so the floor case is drawn at the size the loop settled on
  // rather than at the one it last measured.
  context.font = `400 ${size}px Anton, system-ui, sans-serif`;
  context.fillStyle = palette.ink;
  context.fillText(heading, PAD, y + size * 0.92);

  context.font = BODY_FONT;
  const { paragraphs, truncated } = excerpt(context, nowParagraphs(entry.body), {
    capacity: BAND_BOTTOM - BAND_TOP,
    line: LINE,
    gap: PARAGRAPH_GAP,
    maxWidth: MAX_WIDTH,
  });

  context.fillStyle = palette.ink;
  y = BAND_TOP;
  paragraphs.forEach((lines, index) => {
    if (index > 0) y += PARAGRAPH_GAP;
    for (const line of lines) {
      y += LINE;
      context.fillText(line, PAD, y);
    }
  });

  // Lower than the show card's `HEIGHT - 300`: there is no venue, city and date
  // block under it to fill the gap, only the two footer lines.
  drawHairline(context, 1720, palette);

  /*
   * The card never quietly claims to be the whole entry. An ellipsis says
   * something was dropped; this line is what says where the rest is, which an
   * ellipsis on its own does not.
   */
  drawReadout(context, truncated ? "Read the rest at" : "Read it at", 1786, palette.dim, 28);
  drawReadout(
    context,
    `${SITE_URL.replace(/^https?:\/\//, "")}/now/${entry.updated}`,
    HEIGHT - 74,
    palette.ember,
  );

  return { blob: await toBlob(canvas), truncated };
}
