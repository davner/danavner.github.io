import NumberFlow, { type Format } from "@number-flow/react";

/** NumberFlow's format shape: Intl options with the scientific notations cut. */
export type StatFormat = Format;

/*
 * The stamp curve, read once from the live token rather than kept as a TS
 * copy of the linear() list - two spellings of one curve drift, which is the
 * sin theme.ts's hex pair needed a cross-reference comment for. Empty string
 * means the token is missing, and stock ease-out stands in.
 */
const STAMP =
  typeof document === "undefined"
    ? "ease-out"
    : getComputedStyle(document.documentElement).getPropertyValue("--ease-stamp").trim() ||
      "ease-out";

const SPIN = { duration: 180, easing: STAMP };
const FADE = { duration: 100, easing: "ease-out" };

/**
 * The one place NumberFlow is configured, so every odometer on the site rolls
 * with the same hand: 180ms on the stamp curve, digits fading inside 100ms.
 *
 * It animates on value change and never on mount, which is what keeps the
 * no-arrival rule structural - page load, route entry, and a tile appearing
 * under a filter all paint static. `respectMotionPreference` stays at the
 * library's default (true): the roll rides WAAPI, which the CSS
 * reduced-motion kill cannot reach, so the library's own guard is what makes
 * digits jump under the preference.
 *
 * `locales` is pinned to en-US because the strings it replaces were - vinyl's
 * `String(...)` and fortnite's `count()` both rendered en-US shapes, and a
 * reader's browser locale must not reformat a stat the tests and the tiles
 * were sized against.
 */
export function StatNumber({
  value,
  format,
  suffix,
  className,
}: {
  value: number;
  format?: StatFormat;
  suffix?: string;
  className?: string;
}) {
  return (
    <NumberFlow
      value={value}
      locales="en-US"
      format={format}
      suffix={suffix}
      className={className}
      spinTiming={SPIN}
      transformTiming={SPIN}
      opacityTiming={FADE}
    />
  );
}
