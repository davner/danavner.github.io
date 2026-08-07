import { useEffect, useState } from "react";

import { fetchVisitorCount } from "@/lib/analytics";

/** Padded width, so the counter reads as a fixed odometer rather than a bare number. */
const MIN_DIGITS = 6;
/** How long the digits spin up from zero to the real count, in ms. */
const SPIN_MS = 1200;

/**
 * An old-school hit counter for the landing page. It reads the real visitor
 * total from GoatCounter on every load and spins the digits up to it once. The
 * digit cells reuse the site's hairline idiom - `gap-px` over a `bg-border`
 * backing - so they match the stat boards elsewhere.
 *
 * When the read fails the odometer goes to dashes and the reason is printed in
 * red underneath, rather than being swallowed into a silent "offline" face. The
 * count is live, so a failure here is worth seeing.
 */
export function VisitorTicker() {
  const [display, setDisplay] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let raf = 0;

    fetchVisitorCount(controller.signal)
      .then((count) => {
        setError(null);

        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
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
      })
      .catch((cause: unknown) => {
        // An abort is this component unmounting, not a failure to report.
        if (controller.signal.aborted) return;
        const reason = cause instanceof Error ? cause.message : String(cause);
        console.error("Visitor count: read failed.", cause);
        setError(reason);
      });

    return () => {
      controller.abort();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const digits = error
    ? Array.from({ length: MIN_DIGITS }, () => "-")
    : String(display).padStart(MIN_DIGITS, "0").split("");

  const label = error
    ? `Visitor count unavailable: ${error}`
    : `${display.toLocaleString()} visitors and counting`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <span className="readout-dim">Visitors</span>
        <span
          className="inline-flex gap-px border border-border bg-border"
          aria-hidden
        >
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

      {/* Aria-hidden because the `role="status"` label above already says this;
          without it a screen reader hears the failure twice. */}
      {error ? (
        <p
          data-testid="visitor-error"
          /* A literal red, not `text-destructive`: this palette resolves
             destructive to the same ember as the digits above it, so the error
             would read as decoration.

             red-700 rather than red-600 for light mode. At this size axe wants
             4.5:1 and red-600 on the bone background measures 4.4, which the
             a11y suite fails. red-700 clears it at ~6:1. */
          className="max-w-prose text-center font-mono text-xs text-red-700 dark:text-red-400"
          aria-hidden
        >
          Visitor count failed: {error}
        </p>
      ) : null}
    </div>
  );
}
