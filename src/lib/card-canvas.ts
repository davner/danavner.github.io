/**
 * The canvas kit every share poster is drawn with: the sheet size, the site's
 * palette, and the marks that are the same whatever the subject is.
 *
 * Drawing happens on a canvas rather than server-side because there is no
 * server - the whole site is static - and the browser already has the fonts and
 * the photos loaded.
 *
 * What lives here is what more than one card genuinely shares. A show's rating
 * block and an album's score row do not, and neither belongs here just because
 * it is a drawing routine.
 */

/** Instagram story canvas. Also fine as a photo in a text message. */
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Every card left-aligns to this. */
export const PAD = 96;

/**
 * Every colour a card paints, resolved to a literal a canvas will accept.
 *
 * The card is a dark artefact whatever theme the reader is in - it is a poster,
 * and the poster is black - so the palette is read from the dark tokens rather
 * than from the page.
 */
export interface Palette {
  ink: string;
  dim: string;
  ember: string;
  void: string;
  /** Ember at 35%, the centre of the bloom. */
  emberGlow: string;
  /** Ember at 0%, where the bloom fades out. */
  emberFade: string;
  /** The void at 0%, where the photo starts fading into the card. */
  voidFade: string;
  /** Ink at 18%, the rule over a card's footer. */
  hairline: string;
  /** The star ladder's spot inks - dark-stock values; the card has no light stock. */
  gold: string;
  blue: string;
  /** Gold at 55%, the halo behind a gold row's stars. */
  goldGlow: string;
  /** Blue-white at 60%, the five's inner halo. */
  blueGlow: string;
  /** Blue-white at 28%, the five's wide halo pass. */
  blueGlowWide: string;
}

/**
 * The palette, read off the site's own dark tokens.
 *
 * Every alpha variant is derived here rather than by a caller, because a canvas
 * colour string has no element to resolve `var()` against: `color-mix(in oklab,
 * var(--ember) 35%, transparent)` is dropped on assignment and leaves the
 * previous fill in place. Substituting the resolved token into the `color-mix`
 * is what makes the derivation work, and it stays right if a token is respelled
 * as hex or rgb.
 *
 * The probe has to be in the document: a detached element resolves every custom
 * property to the empty string, and a palette of empty strings paints a card in
 * whatever colour the canvas happened to be holding. `display: none` still
 * resolves them, so it is attached, read, and removed. An empty read throws
 * rather than returning, because the share sheet's failure path is honest and a
 * card in the wrong colours is not.
 */
export function palette(): Palette {
  const element = document.createElement("div");
  element.className = "dark";
  element.style.display = "none";
  document.body.append(element);

  try {
    const style = getComputedStyle(element);
    const read = (token: string) => {
      const value = style.getPropertyValue(token).trim();
      if (!value) throw new Error(`the card cannot read ${token} from the palette`);
      return value;
    };
    const alpha = (colour: string, percent: number) =>
      `color-mix(in oklab, ${colour} ${percent}%, transparent)`;

    const ink = read("--foreground");
    const ember = read("--ember");
    const gold = read("--heat-gold");
    const blue = read("--heat-blue");
    /* Deliberately blacker than `--background`'s press-black: the card is its
       own sheet, not a screenshot of a page, so this is a value rather than a
       copy of a token that would drift with the site's. */
    const black = "#08090d";

    return {
      ink,
      dim: read("--muted-foreground"),
      ember,
      void: black,
      emberGlow: alpha(ember, 35),
      emberFade: alpha(ember, 0),
      voidFade: alpha(black, 0),
      hairline: alpha(ink, 18),
      gold,
      blue,
      goldGlow: alpha(gold, 55),
      blueGlow: alpha(blue, 60),
      blueGlowWide: alpha(blue, 28),
    };
  } finally {
    element.remove();
  }
}

/**
 * Throws unless `colour` is one a canvas will actually paint.
 *
 * `fillStyle` ignores a string it cannot parse and keeps whatever it had, so a
 * bad colour paints the previous one and nothing anywhere reports it. Two
 * sentinels are what catch that: an ignored assignment leaves each sentinel in
 * place, so the two reads disagree. A single read cannot tell an ignored
 * assignment from a successful one, and `CSS.supports("color", ...)` answers
 * true for the strings that fail here.
 *
 * Leaves `fillStyle` on whatever it last set, so it belongs before a fill is
 * set up rather than in the middle of one.
 */
export function assertPaintable(context: CanvasRenderingContext2D, colour: string) {
  context.fillStyle = "#010203";
  context.fillStyle = colour;
  const first = context.fillStyle;
  context.fillStyle = "#040506";
  context.fillStyle = colour;
  if (context.fillStyle !== first) throw new Error(`${colour} is not a colour a canvas will paint`);
}

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
  palette: Palette;
}> {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d")!;

  // Once, over the whole palette, rather than at each fill: a renderer that
  // paints an unparseable colour draws a card in the wrong colour and says
  // nothing, and the share sheet's failure path is the honest end of that.
  const colours = palette();
  for (const colour of Object.values(colours)) assertPaintable(context, colour);

  context.fillStyle = colours.void;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  return { canvas, context, palette: colours };
}

/**
 * The longest run of `word` that fits `maxWidth`, and never fewer than one
 * character: a limit too narrow for a single glyph still has to end the line
 * somewhere, or the caller asks again for a piece of the same string forever.
 *
 * Stepped in code points rather than UTF-16 units, so a surrogate pair is not
 * halved into two replacement characters.
 */
function cut(context: CanvasRenderingContext2D, word: string, maxWidth: number): string {
  let head = "";
  for (const character of word) {
    if (head && context.measureText(head + character).width > maxWidth) break;
    head += character;
  }
  return head;
}

/**
 * Wraps text to `maxWidth`, returning the lines. Assumes the font is set.
 *
 * `firstWidth` narrows the first line only, which is how the band list leaves
 * room for the `w/` drawn beside it.
 *
 * Whitespace is the only seam a line breaks on, so a token carrying none - a
 * pasted URL, an id, a hashtag - is broken mid-token where it stops fitting.
 * A canvas clips nothing: left whole, such a token is drawn straight off the
 * sheet and the card is ruined without anything reporting it. This is
 * `overflow-wrap: anywhere`, for the same reason a browser offers it.
 */
export function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  firstWidth = maxWidth,
): string[] {
  const lines: string[] = [];
  let line = "";
  const limit = () => (lines.length === 0 ? firstWidth : maxWidth);

  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;

    while (rest) {
      const candidate = line ? `${line} ${rest}` : rest;
      if (context.measureText(candidate).width <= limit()) {
        line = candidate;
        break;
      }

      // A line with something on it gives way first, so a token is only ever
      // broken where the whole line is the token and it still does not fit.
      if (line) {
        lines.push(line);
        line = "";
        continue;
      }

      const head = cut(context, rest, limit());
      lines.push(head);
      rest = rest.slice(head.length);
    }
  }

  if (line) lines.push(line);
  return lines;
}

/**
 * `line` with the mark that says the card stopped mid-thought.
 *
 * The trailing full stop goes with the ellipsis, or a line that already ended a
 * sentence reads as "shot...." - four dots, which looks like a typo rather than
 * like a cut. A `?` or `!` is kept, since the ellipsis stands in for neither.
 */
export function markCut(line: string): string {
  return `${line.replace(/\.\s*$/, "")}…`;
}

/** `paragraphs` with its last line marked, so a cut block reads as cut. */
function marked(paragraphs: string[][]): string[][] {
  const last = paragraphs.at(-1);
  if (!last || last.length === 0) return paragraphs;
  return [...paragraphs.slice(0, -1), [...last.slice(0, -1), markCut(last[last.length - 1])]];
}

/**
 * The least a cut paragraph is worth setting.
 *
 * One line hanging under a whole paragraph reads as an orphan rather than as
 * the next thought, and a sentence cut given that little room keeps whatever
 * short phrase happens to end in a stop - a band name carrying an exclamation
 * mark, an abbreviation - which is a worse mark on the sheet than the air it
 * would have filled.
 */
const MIN_CUT_LINES = 2;

/** The room a block of prose has, and the metrics it is set in. */
export interface ExcerptMetrics {
  /** How tall the block may be. Under zero means the same as zero. */
  capacity: number;
  /** Baseline to baseline within a paragraph. */
  line: number;
  /** The extra air between one paragraph and the next. */
  gap: number;
  /** How wide a line may run. */
  maxWidth: number;
}

/**
 * The front of `lines` that fits `limit` lines, ending on a sentence.
 *
 * Cut back to the last sentence-ending punctuation among the lines that fit, or
 * failing that to the last whole word. A severed sentence is the failure mode
 * that makes an excerpt read as a mistake rather than as an excerpt, and the
 * sentence is worth the line or two the cut gives up to land on one.
 *
 * Re-wrapped rather than returned as the sliced lines, because the cut lands
 * mid-line and the words after it would otherwise stay on the sheet.
 */
function sentences(
  context: CanvasRenderingContext2D,
  lines: string[],
  limit: number,
  maxWidth: number,
): string[] {
  if (limit <= 0) return [];

  const fitting = lines.slice(0, limit).join(" ");
  const sentence = /^[\s\S]*[.!?](?=\s|$)/.exec(fitting)?.[0];
  return wrap(context, sentence ?? fitting.replace(/\s+\S*$/, ""), maxWidth);
}

/**
 * As much of `paragraphs` as the block holds, and whether anything was left out.
 *
 * Whole paragraphs first, while the next one still fits, because a paragraph
 * taken entire is the excerpt that reads best. Whatever room is left after that
 * goes to the front of the paragraph that would not fit, cut to a sentence: a
 * band that stops at the last whole paragraph leaves a hole the height of the
 * paragraph it refused, which on a card measured in six or seven lines is most
 * of the block.
 *
 * The two cases the caller might think of as separate are the same one. A first
 * paragraph too tall for the block is the tail fill with no whole paragraphs
 * under it, and a block measured out of a sheet with nothing left over is the
 * tail fill with no room: it draws nothing and still reports the cut, because
 * the prose exists and the reader has not been shown a word of it.
 *
 * The ellipsis goes on here rather than at the caller, so what the sheet says
 * and what `truncated` says cannot drift apart.
 *
 * Assumes `context.font` is the face the block will be drawn in, since `wrap`
 * measures.
 */
export function excerpt(
  context: CanvasRenderingContext2D,
  paragraphs: string[],
  { capacity, line, gap, maxWidth }: ExcerptMetrics,
): { paragraphs: string[][]; truncated: boolean } {
  const room = Math.max(capacity, 0);
  const wrapped = paragraphs.map((text) => wrap(context, text, maxWidth));

  const taken: string[][] = [];
  let used = 0;

  for (const lines of wrapped) {
    const cost = (taken.length > 0 ? gap : 0) + lines.length * line;
    if (used + cost > room) break;
    taken.push(lines);
    used += cost;
  }

  if (taken.length === wrapped.length) return { paragraphs: taken, truncated: false };

  const spare = room - used - (taken.length > 0 ? gap : 0);
  const tail = sentences(context, wrapped[taken.length], Math.floor(spare / line), maxWidth);
  const block = tail.length >= MIN_CUT_LINES ? [...taken, tail] : taken;

  return { paragraphs: marked(block), truncated: true };
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
  palette: Palette,
) {
  drawCover(context, image, 0, 0, WIDTH, height);

  const fade = context.createLinearGradient(0, height - 420, 0, height);
  fade.addColorStop(0, palette.voidFade);
  fade.addColorStop(1, palette.void);
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
export function drawBloom(context: CanvasRenderingContext2D, centerY: number, palette: Palette) {
  const glow = context.createRadialGradient(WIDTH / 2, centerY, 0, WIDTH / 2, centerY, 900);
  glow.addColorStop(0, palette.emberGlow);
  glow.addColorStop(1, palette.emberFade);
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
export function drawHairline(context: CanvasRenderingContext2D, y: number, palette: Palette) {
  context.strokeStyle = palette.hairline;
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
