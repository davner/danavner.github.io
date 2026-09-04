/** Film grain, generated as an SVG data URI rather than shipping a PNG. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Fixed backdrop: an ember bloom at the top of the page and a grain layer over
 * everything, so flat colour never reads as flat.
 */
export function Backdrop() {
  return (
    // Screen light, not ink: print gets neither the bloom nor the grain.
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
    >
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
