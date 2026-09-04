import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/** CSS pixels per fire cell. Bigger reads chunkier and costs less to simulate. */
const PIXEL = 4;
const ROWS = 16;
const FPS = 24;
/** Hottest palette index. The bottom row is pinned here. */
const MAX_HEAT = 31;
/** How long a press keeps feeding the flames. */
const STOKE_MS = 1000;
/** Gaussian falloff width of the press's kick, in columns. */
const STOKE_SPREAD = 6;

/**
 * Colour stops for the heat ramp, `[heat 0-1, r, g, b, a]`.
 *
 * The cool end fades out on alpha while staying the same warm hue, rather than
 * darkening toward black. A dark tip is invisible on the dark theme and reads as
 * grey soot on the light one; a transparent ember tip is right on both.
 */
const STOPS: [number, number, number, number, number][] = [
  [0, 214, 48, 12, 0],
  [0.12, 214, 48, 12, 70],
  [0.3, 220, 55, 14, 175],
  [0.55, 232, 72, 20, 245],
  [0.78, 255, 140, 35, 255],
  [0.92, 255, 205, 90, 255],
  [1, 255, 244, 214, 255],
];

/** Flattened RGBA lookup, one entry per heat index. */
const PALETTE = (() => {
  const table = new Uint8ClampedArray((MAX_HEAT + 1) * 4);

  for (let index = 0; index <= MAX_HEAT; index++) {
    const heat = index / MAX_HEAT;
    let upper = STOPS.findIndex(([position]) => position >= heat);
    if (upper <= 0) upper = 1;

    const [lowPos, ...low] = STOPS[upper - 1];
    const [highPos, ...high] = STOPS[upper];
    const t = highPos === lowPos ? 0 : (heat - lowPos) / (highPos - lowPos);

    for (let channel = 0; channel < 4; channel++) {
      table[index * 4 + channel] = low[channel] + (high[channel] - low[channel]) * t;
    }
  }

  return table;
})();

/**
 * Per-column fuel, drifting frame to frame. Pinning the whole bottom row to one
 * temperature gives an even wall of fire; letting each column run hotter or
 * cooler than its neighbours is what turns it into separate licks.
 *
 * A press hands in a boost: extra heat around the pressed column, strongest at
 * the press and falling off by distance and by how much of its second has
 * burned away - a parameter kick riding the frames already being drawn, so the
 * fire leaps there and settles back on its own.
 */
function stoke(fuel: Float32Array, cols: number, boost?: { column: number; until: number }) {
  const now = performance.now();
  const kick = boost && boost.until > now ? (boost.until - now) / STOKE_MS : 0;

  for (let x = 0; x < cols; x++) {
    let next = fuel[x] + (Math.random() - 0.5) * 4;
    if (kick > 0 && boost) {
      const distance = x - boost.column;
      next +=
        kick *
        MAX_HEAT *
        0.6 *
        Math.exp(-(distance * distance) / (2 * STOKE_SPREAD * STOKE_SPREAD));
    }
    fuel[x] = next < 0 ? 0 : next > MAX_HEAT ? MAX_HEAT : next;
  }

  // Smooth sideways so the hot and cold patches are wider than one pixel and
  // travel along the band instead of flickering in place.
  let previous = fuel[0];
  for (let x = 1; x < cols - 1; x++) {
    const current = fuel[x];
    fuel[x] = (previous + current * 2 + fuel[x + 1]) / 4;
    previous = current;
  }
}

/**
 * The Doom fire routine: every cell takes the heat of the cell below it, minus
 * a random amount, shifted a random column sideways. Run over a grid whose
 * bottom row is the fuel, that alone produces flames.
 */
function spread(cells: Uint8Array, cols: number) {
  for (let x = 0; x < cols; x++) {
    for (let y = 1; y < ROWS; y++) {
      const source = y * cols + x;
      // 0-5, so the average loss per row burns the palette out a few rows
      // below the top and the flames land at a mix of tall and short.
      const decay = (Math.random() * 6) | 0;
      const drift = ((Math.random() * 3) | 0) - 1;
      const targetX = x + drift;
      if (targetX < 0 || targetX >= cols) continue;

      const heat = cells[source] - decay;
      cells[(y - 1) * cols + targetX] = heat > 0 ? heat : 0;
    }
  }
}

function paint(image: ImageData, cells: Uint8Array) {
  for (let i = 0; i < cells.length; i++) {
    const entry = cells[i] * 4;
    image.data[i * 4] = PALETTE[entry];
    image.data[i * 4 + 1] = PALETTE[entry + 1];
    image.data[i * 4 + 2] = PALETTE[entry + 2];
    image.data[i * 4 + 3] = PALETTE[entry + 3];
  }
}

/**
 * A band of pixel fire, simulated at one cell per `PIXEL` and scaled up with
 * nearest-neighbour so the pixels stay square and chunky.
 *
 * It stops when it is scrolled out of view, and with `prefers-reduced-motion`
 * it settles into a single still frame instead of animating. A press stokes
 * it - under reduced motion by re-settling the standing frame once, so the
 * flames rearrange without ever moving.
 */
export function PixelFire({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let cols = 0;
    let cells = new Uint8Array(0);
    let fuel = new Float32Array(0);
    let image: ImageData | null = null;
    let frame = 0;
    let last = 0;
    let visible = true;
    let boost: { column: number; until: number } | undefined;

    function resize() {
      const next = Math.max(1, Math.ceil(canvas!.clientWidth / PIXEL));
      if (next === cols) return;

      cols = next;
      canvas!.width = cols;
      canvas!.height = ROWS;
      cells = new Uint8Array(cols * ROWS);
      fuel = new Float32Array(cols).fill(MAX_HEAT);
      image = context!.createImageData(cols, ROWS);
      settle();
    }

    function step() {
      stoke(fuel, cols, boost);
      for (let x = 0; x < cols; x++) cells[(ROWS - 1) * cols + x] = fuel[x];
      spread(cells, cols);
      paint(image!, cells);
      context!.putImageData(image!, 0, 0);
    }

    /** Runs the simulation up to a steady state, for the still frame. */
    function settle() {
      for (let i = 0; i < ROWS * 4; i++) {
        stoke(fuel, cols, boost);
        for (let x = 0; x < cols; x++) cells[(ROWS - 1) * cols + x] = fuel[x];
        spread(cells, cols);
      }
      paint(image!, cells);
      context!.putImageData(image!, 0, 0);
    }

    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (now - last < 1000 / FPS) return;
      last = now;
      step();
    }

    function play() {
      if (frame || reduceMotion.matches || !visible) return;
      frame = requestAnimationFrame(loop);
    }

    function pause() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    }

    // A footer spends most of its life below the fold; there is no reason to
    // simulate fire nobody is looking at.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else pause();
    });
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    function onMotionChange() {
      if (reduceMotion.matches) {
        pause();
        settle();
      } else {
        play();
      }
    }
    reduceMotion.addEventListener("change", onMotionChange);

    function onPointerDown(event: PointerEvent) {
      const column = Math.min(cols - 1, Math.max(0, Math.floor(event.offsetX / PIXEL)));
      boost = { column, until: performance.now() + STOKE_MS };
      // With the loop parked, one settled frame shows the fire rearranged
      // around the press - motion-free, not dead.
      if (reduceMotion.matches) settle();
    }
    canvas.addEventListener("pointerdown", onPointerDown);

    resize();
    play();

    return () => {
      pause();
      observer.disconnect();
      resizeObserver.disconnect();
      reduceMotion.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      /*
       * Takes a press yet stays silent to assistive technology: no role, no
       * name, no tab stop. The stoke conveys nothing and changes nothing, so
       * a labeled control would cost every page's footer an announced tab
       * stop for zero information. DESIGN.md's Motion section records that
       * judgment; the cursor is the only invitation - by hand, because the
       * cursor sweep's selector list cannot reach a canvas.
       */
      aria-hidden
      className={cn("block w-full cursor-pointer print:hidden", className)}
      style={{ height: `${ROWS * PIXEL}px`, imageRendering: "pixelated" }}
    />
  );
}
