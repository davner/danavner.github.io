import { useEffect, useRef } from "react";

import { useTheme } from "@/lib/theme";

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleRate: number;
  phase: number;
  drift: number;
}

const STAR_DENSITY = 1 / 7000; // stars per CSS pixel of viewport area
const MAX_STARS = 420;

/** Film grain, generated once as an SVG data URI rather than shipping a PNG. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function createStars(width: number, height: number): Star[] {
  const count = Math.min(MAX_STARS, Math.round(width * height * STAR_DENSITY));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.05 + 0.3,
    baseAlpha: Math.random() * 0.55 + 0.12,
    twinkleRate: Math.random() * 1.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    drift: Math.random() * 4 + 1.5,
  }));
}

/**
 * Fixed backdrop: starfield, an ember bloom at the top of the page, and a grain
 * layer over everything so flat colour never reads as flat.
 */
export function Backdrop() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // A starfield on newsprint is just dirt, so light mode gets the wash alone.
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
          : 0.6 + 0.4 * Math.sin(star.phase + elapsedSeconds * star.twinkleRate);
        const y = reduceMotion ? star.y : (star.y + elapsedSeconds * star.drift) % (height + 4);

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
        className="absolute inset-x-0 top-0 h-[80vh]"
        style={{
          background: "radial-gradient(70rem 45rem at 50% -18%, var(--glow), transparent 72%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRAIN, opacity: "var(--grain-opacity)" }}
      />
    </div>
  );
}
