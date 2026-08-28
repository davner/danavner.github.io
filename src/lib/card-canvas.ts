/**
 * The canvas kit every share poster is drawn with: the sheet size, the site's
 * palette, and the marks that are the same whatever the subject is.
 *
 * Drawing happens on a canvas rather than server-side because there is no
 * server - the whole site is static - and the browser already has the fonts and
 * the photos loaded.
 *
 * What lives here is what two cards genuinely share. A show's rating block and
 * a now entry's excerpt do not, and neither belongs here just because it is a
 * drawing routine.
 */

/** Instagram story canvas. Also fine as a photo in a text message. */
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const INK = "#f4f1ea";
export const DIM = "#8b8b93";
export const EMBER = "#e6431a";
export const VOID = "#08090d";

/** Every card left-aligns to this. */
export const PAD = 96;

/** What a renderer hands back. */
export interface Card {
  blob: Blob;
  /** True when the subject did not fit and the card says where the rest is. */
  truncated?: boolean;
}

/**
 * A sheet ready to draw on: the fonts loaded, the canvas sized, the background
 * filled.
 *
 * The `document.fonts.ready` wait is what makes a card look like the site
 * rather than a generic poster - the display and mono faces have to be there
 * before anything is measured, let alone painted - and it is the easiest thing
 * in the routine to leave out of a second renderer.
 */
export async function createCard(): Promise<{
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}> {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d")!;

  context.fillStyle = VOID;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  return { canvas, context };
}

/**
 * Wraps text to `maxWidth`, returning the lines. Assumes the font is set.
 *
 * `firstWidth` narrows the first line only, which is how the band list leaves
 * room for the `w/` drawn beside it.
 */
export function wrap(
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

export function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    // A missing or cross-origin photo should cost the card its picture, not
    // the whole share. A renderer with nothing worth sending once the photo is
    // gone is free to check for null and reject instead; this decides only that
    // the failure is reported rather than thrown.
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Draws `image` to cover the box, cropping the overflow like `object-fit: cover`. */
export function drawCover(
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
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();
}

/**
 * The photo across the top of the card, fading into it so the whole thing reads
 * as one piece rather than a picture with a caption stapled under it.
 *
 * Precondition: `height >= 420`. The fade is anchored to the bottom of the
 * photo, so its origin is `height - 420`; below that the origin goes negative
 * and the fade starts off-canvas, leaving a hard edge where the photo stops.
 */
export function drawTopPhoto(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  height: number,
) {
  drawCover(context, image, 0, 0, WIDTH, height);

  const fade = context.createLinearGradient(0, height - 420, 0, height);
  fade.addColorStop(0, "rgba(8,9,13,0)");
  fade.addColorStop(1, VOID);
  context.fillStyle = fade;
  context.fillRect(0, height - 420, WIDTH, 420);
}

/**
 * The ember bloom behind the type, the same one the site paints at the top of
 * every page. `centerY` is normally just under the photo.
 *
 * Filled across the whole canvas rather than a slice of it: a partial rect
 * leaves a visible edge wherever the gradient has not yet faded out.
 *
 * A card with no photo needs no special case - it passes `centerY = 40`,
 * because its photo height is 0 and the bloom sits at the top where the picture
 * would have ended.
 */
export function drawBloom(context: CanvasRenderingContext2D, centerY: number) {
  const glow = context.createRadialGradient(WIDTH / 2, centerY, 0, WIDTH / 2, centerY, 900);
  glow.addColorStop(0, "rgba(230,67,26,0.35)");
  glow.addColorStop(1, "rgba(230,67,26,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

/**
 * One line set in the site's readout style: mono, uppercase, widely tracked.
 *
 * `x` is fixed at `PAD` because every readout on every card so far left-aligns
 * there. Give it an `x` when a card needs to centre one.
 */
export function drawReadout(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  color: string,
  size = 30,
) {
  context.font = `500 ${size}px "JetBrains Mono Variable", ui-monospace, monospace`;
  context.fillStyle = color;
  context.letterSpacing = "6px";
  context.fillText(text.toUpperCase(), PAD, y);
  context.letterSpacing = "0px";
}

/**
 * The hairline over a card's footer.
 *
 * `y` stays a parameter rather than becoming a constant: the show card has a
 * venue, city and date under it and sets the rule at `HEIGHT - 300`, while the
 * now card has none of that to fill the gap and puts it lower.
 */
export function drawHairline(context: CanvasRenderingContext2D, y: number) {
  context.strokeStyle = "rgba(244,241,234,0.18)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(PAD, y);
  context.lineTo(WIDTH - PAD, y);
  context.stroke();
}

/** The canvas as a PNG. Rejects rather than handing back a null blob. */
export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("could not render the card"))),
      "image/png",
    );
  });
}
