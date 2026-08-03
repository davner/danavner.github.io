import { showHeading, showLocationOf, fullShowDate, support } from "@/lib/show-summary";
import { MAX_RATING, type Show } from "@/lib/shows";
import { SITE_URL } from "@/lib/site";

/** Instagram story canvas. Also fine as a photo in a text message. */
const WIDTH = 1080;
const HEIGHT = 1920;

const INK = "#f4f1ea";
const DIM = "#8b8b93";
const EMBER = "#e6431a";
const VOID = "#08090d";

const PAD = 96;

/** Matches the rating row on the site. */
const HORNS = "\u{1F918}\u{1F3FD}";

/**
 * Wraps text to `maxWidth`, returning the lines. Assumes the font is set.
 *
 * `firstWidth` narrows the first line only, which is how the band list leaves
 * room for the `w/` drawn beside it.
 */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  firstWidth = maxWidth,
): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    const limit = lines.length === 0 ? firstWidth : maxWidth;
    if (line && context.measureText(candidate).width > limit) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    // A missing or cross-origin photo should cost the card its picture, not
    // the whole share.
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Draws `image` to cover the box, cropping the overflow like `object-fit: cover`. */
function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

/**
 * Renders a show as a shareable poster: the site's own look, sized for an
 * Instagram story, with the URL on it so a screenshot still leads somewhere.
 *
 * Drawing happens on a canvas rather than server-side because there is no
 * server - the whole site is static - and the browser already has the fonts and
 * the photos loaded.
 */
export async function renderShowCard(show: Show): Promise<Blob> {
  // The display and mono faces are what make it look like the site rather than
  // a generic card, so wait for them before measuring anything.
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d")!;

  context.fillStyle = VOID;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const photo = show.photos[0] ? await loadImage(show.photos[0].src) : null;

  // Photo across the top third, fading into the card so it reads as one piece
  // rather than a picture with a caption stapled under it.
  const photoHeight = photo ? 900 : 0;
  if (photo) {
    drawCover(context, photo, 0, 0, WIDTH, photoHeight);

    const fade = context.createLinearGradient(0, photoHeight - 420, 0, photoHeight);
    fade.addColorStop(0, "rgba(8,9,13,0)");
    fade.addColorStop(1, VOID);
    context.fillStyle = fade;
    context.fillRect(0, photoHeight - 420, WIDTH, 420);
  }

  // Ember bloom behind the type, the same one the site paints at the top of
  // every page.
  // Filled across the whole canvas rather than a slice of it: a partial rect
  // leaves a visible edge wherever the gradient has not yet faded out.
  const glow = context.createRadialGradient(
    WIDTH / 2,
    photoHeight + 40,
    0,
    WIDTH / 2,
    photoHeight + 40,
    900,
  );
  glow.addColorStop(0, "rgba(230,67,26,0.35)");
  glow.addColorStop(1, "rgba(230,67,26,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // With no photo the top of the card is just the ember bloom, so the block
  // starts lower and sits between the glow and the footer rule instead of
  // stranding itself at the top with 700px of empty space underneath.
  let y = photo ? photoHeight + 40 : 620;

  const readout = (text: string, color: string, size = 30) => {
    context.font = `500 ${size}px "JetBrains Mono Variable", ui-monospace, monospace`;
    context.fillStyle = color;
    context.letterSpacing = "6px";
    context.fillText(text.toUpperCase(), PAD, y);
    context.letterSpacing = "0px";
  };

  readout("Show log", EMBER);
  y += 74;

  // Headline in the display face, shrinking a step at a time until it fits in
  // three lines. A long festival name should not blow the layout apart.
  const heading = showHeading(show).toUpperCase();
  let size = 132;
  let lines: string[] = [];
  for (; size >= 64; size -= 8) {
    context.font = `400 ${size}px Anton, system-ui, sans-serif`;
    lines = wrap(context, heading, WIDTH - PAD * 2);
    if (lines.length <= 3) break;
  }

  context.fillStyle = INK;
  for (const line of lines) {
    y += size * 0.92;
    context.fillText(line, PAD, y);
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
    context.fillStyle = EMBER;
    context.fillText(prefix.trimEnd(), PAD, y);

    body.forEach((line, index) => {
      context.fillStyle = DIM;
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
    context.fillStyle = INK;
    // Measured under the emoji font, not the mono one set below, or the value
    // lands on top of the horns.
    const hornsWidth = context.measureText(horns).width;
    context.fillText(horns, PAD, y + 44);

    context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
    context.fillStyle = EMBER;
    context.fillText(
      `${Number(show.rating.toFixed(1))} / ${MAX_RATING}`,
      PAD + hornsWidth + 32,
      y + 40,
    );
    y += 108;
  }

  // Venue, city, and date pinned to the bottom with a hairline over them.
  const footerTop = HEIGHT - 300;
  context.strokeStyle = "rgba(244,241,234,0.18)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(PAD, footerTop);
  context.lineTo(WIDTH - PAD, footerTop);
  context.stroke();

  y = footerTop + 66;
  context.font = '500 34px "JetBrains Mono Variable", ui-monospace, monospace';
  context.fillStyle = INK;
  const where = showLocationOf(show);
  if (where) {
    context.fillText(where, PAD, y);
    y += 52;
  }
  context.fillStyle = DIM;
  context.fillText(fullShowDate(show), PAD, y);

  y = HEIGHT - 74;
  readout(`${SITE_URL.replace(/^https?:\/\//, "")}/shows`, EMBER, 30);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("could not render the card"))),
      "image/png",
    );
  });
}

export function showUrl(show: Pick<Show, "slug">): string {
  return `${SITE_URL}/shows/${show.slug}`;
}
