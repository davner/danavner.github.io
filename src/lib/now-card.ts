import {
  type Card,
  DIM,
  EMBER,
  HEIGHT,
  INK,
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
import type { NowEntry } from "@/lib/now";
import { nowDate, nowParagraphs } from "@/lib/now-summary";
import { SITE_URL } from "@/lib/site";

/** The photo band. 900 clears `drawTopPhoto`'s `height >= 420` precondition. */
const PHOTO_HEIGHT = 900;

/** Where the excerpt may be set, and how it is set there. */
const BAND_TOP = 1120;
const BAND_BOTTOM = 1696;
const LINE = 56;
const PARAGRAPH_GAP = 28;
const BODY_FONT = '400 40px "Inter Variable", system-ui, sans-serif';

const MAX_WIDTH = WIDTH - PAD * 2;

/**
 * As much of the entry as the band holds, and whether anything was left out.
 *
 * Whole paragraphs first, while the next one still fits. Cutting at a paragraph
 * boundary never leaves a severed sentence, which is the failure mode that
 * makes an excerpt read as a mistake rather than as an excerpt.
 *
 * When even the first paragraph overflows there is no boundary to cut at, so it
 * is wrapped, the lines that fit are taken, and the text is cut back to the last
 * sentence-ending punctuation among them - or, failing that, to the last whole
 * word. Both of those set `truncated`, and the caller is what turns that into
 * the footer line saying where the rest is.
 *
 * Assumes `context.font` is already `BODY_FONT`, because `wrap` measures.
 */
function excerpt(
  context: CanvasRenderingContext2D,
  paragraphs: string[],
): { paragraphs: string[][]; truncated: boolean } {
  const capacity = BAND_BOTTOM - BAND_TOP;
  const wrapped = paragraphs.map((text) => wrap(context, text, MAX_WIDTH));

  const taken: string[][] = [];
  let used = 0;

  for (const lines of wrapped) {
    const cost = (taken.length > 0 ? PARAGRAPH_GAP : 0) + lines.length * LINE;
    if (used + cost > capacity) break;
    taken.push(lines);
    used += cost;
  }

  if (taken.length > 0) {
    return { paragraphs: taken, truncated: taken.length < wrapped.length };
  }

  // Nothing to fall back on: either the entry is empty, or its opening
  // paragraph alone is taller than the band.
  if (wrapped.length === 0) return { paragraphs: [], truncated: false };

  const fitting = wrapped[0].slice(0, Math.floor(capacity / LINE)).join(" ");
  const sentence = /^[\s\S]*[.!?](?=\s|$)/.exec(fitting)?.[0];
  const cut = sentence ?? fitting.replace(/\s+\S*$/, "");

  return { paragraphs: [wrap(context, cut, MAX_WIDTH)], truncated: true };
}

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
  const { canvas, context } = await createCard();

  // An out-of-range index falls back to the first, matching `renderShowCard`.
  const chosen = entry.photos[photoIndex] ?? entry.photos[0];
  const photo = chosen ? await loadImage(chosen.src) : null;
  if (!photo) throw new Error("could not load the photo for the card");

  drawTopPhoto(context, photo, PHOTO_HEIGHT);
  drawBloom(context, PHOTO_HEIGHT + 40);

  let y = PHOTO_HEIGHT + 40;
  drawReadout(context, "Right now", y, EMBER);
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
  context.fillStyle = INK;
  context.fillText(heading, PAD, y + size * 0.92);

  context.font = BODY_FONT;
  const { paragraphs, truncated } = excerpt(context, nowParagraphs(entry.body));

  context.fillStyle = INK;
  y = BAND_TOP;
  paragraphs.forEach((lines, index) => {
    if (index > 0) y += PARAGRAPH_GAP;
    lines.forEach((line, lineIndex) => {
      y += LINE;
      const last = index === paragraphs.length - 1 && lineIndex === lines.length - 1;
      // The trailing full stop goes with it, or a line that already ended a
      // sentence reads as "winning...." - four dots, which looks like a typo
      // rather than like an excerpt. A `?` or `!` is kept, since the ellipsis
      // does not stand in for either.
      const text = truncated && last ? `${line.replace(/\.\s*$/, "")}…` : line;
      context.fillText(text, PAD, y);
    });
  });

  // Lower than the show card's `HEIGHT - 300`: there is no venue, city and date
  // block under it to fill the gap, only the two footer lines.
  drawHairline(context, 1720);

  /*
   * The card never quietly claims to be the whole entry. An ellipsis says
   * something was dropped; this line is what says where the rest is, which an
   * ellipsis on its own does not.
   */
  drawReadout(context, truncated ? "Read the rest at" : "Read it at", 1786, DIM, 28);
  drawReadout(
    context,
    `${SITE_URL.replace(/^https?:\/\//, "")}/now/${entry.updated}`,
    HEIGHT - 74,
    EMBER,
  );

  return { blob: await toBlob(canvas), truncated };
}
