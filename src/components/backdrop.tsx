import { useEffect, useRef } from "react";

import { useTheme } from "@/lib/theme";

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  /** Radians per frame-second, offset per star so they twinkle out of phase. */
  twinkleRate: number;
  phase: number;
  drift: number;
}

const STAR_DENSITY = 1 / 9000; // stars per CSS pixel of viewport area
const MAX_STARS = 320;

function createStars(width: number, height: number): Star[] {
  const count = Math.min(MAX_STARS, Math.round(width * height * STAR_DENSITY));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.1 + 0.35,
    baseAlpha: Math.random() * 0.5 + 0.15,
    twinkleRate: Math.random() * 1.4 + 0.3,
    phase: Math.random() * Math.PI * 2,
    drift: Math.random() * 4 + 1.5,
  }));
}

/**
 * Fixed starfield behind the whole site. Dark mode only — in light mode the
 * page falls back to the gradient wash alone, which is what a daytime sky
 * should look like.
 */
export function Backdrop() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== "dark") return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const starColor = getComputedStyle(document.documentElement).getPropertyValue("--star").trim();

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    function resize() {
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = createStars(width, height);
    }

    function draw(elapsedSeconds: number) {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.fillStyle = starColor || "#ffffff";

      for (const star of stars) {
        const twinkle = reduceMotion
          ? 1
          : 0.65 + 0.35 * Math.sin(star.phase + elapsedSeconds * star.twinkleRate);
        // Slow downward drift that wraps, so the field never empties out.
        const y = reduceMotion
          ? star.y
          : (star.y + elapsedSeconds * star.drift) % (height + 4);

        context.globalAlpha = star.baseAlpha * twinkle;
        context.beginPath();
        context.arc(star.x, y, star.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    }

    const start = performance.now();

    function tick(now: number) {
      draw((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    }

    resize();

    if (reduceMotion) {
      draw(0);
    } else {
      frame = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(0);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [theme]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div
        className="absolute inset-x-0 top-0 h-[70vh]"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -12%, var(--glow), transparent 70%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
