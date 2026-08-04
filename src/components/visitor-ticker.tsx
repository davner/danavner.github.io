import { useEffect, useState } from "react";

import { fetchVisitorCount } from "@/lib/analytics";

/** Padded width, so the counter reads as a fixed odometer rather than a bare number. */
const MIN_DIGITS = 6;
/** How long the digits spin up from zero to the real count, in ms. */
const SPIN_MS = 1200;

type Status = "loading" | "ok" | "failed";

/**
 * An old-school hit counter for the landing page. It reads the real visitor
 * total from GoatCounter, spins the digits up to it once, and falls back to a
 * dashed "offline" face when the count cannot be read. The digit cells reuse the
 * site's hairline idiom - `gap-px` over a `bg-border` backing - so they match the
 * stat boards elsewhere.
 */
export function VisitorTicker() {
  const [display, setDisplay] = useState(0);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const controller = new AbortController();
    let raf = 0;

    fetchVisitorCount(controller.signal).then((count) => {
      if (count == null) {
        setStatus("failed");
        return;
      }
      setStatus("ok");

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setDisplay(count);
        return;
      }

      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SPIN_MS);
        // Ease-out cubic, so it rushes then settles onto the final number.
        setDisplay(Math.round(count * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      controller.abort();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const failed = status === "failed";
  const digits = failed
    ? Array.from({ length: MIN_DIGITS }, () => "-")
    : String(display).padStart(MIN_DIGITS, "0").split("");

  const label = failed
    ? "Visitor count is offline"
    : `${display.toLocaleString()} visitors and counting`;

  return (
    <div className="flex items-center justify-center gap-3">
      <span className="readout-dim">Visitors</span>
      <span className="inline-flex gap-px border border-border bg-border" aria-hidden>
        {digits.map((digit, index) => (
          <span
            key={index}
            className="min-w-[1.4ch] bg-background px-1.5 py-1.5 text-center font-mono text-lg font-semibold tabular-nums text-ember sm:text-xl"
          >
            {digit}
          </span>
        ))}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
