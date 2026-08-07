/**
 * GoatCounter is the one exception to the "nothing phones home" rule: a
 * privacy-friendly, cookie-free pageview counter, used only to show the visitor
 * ticker on the landing page. Everything hangs off this one site code, which is
 * the subdomain of the goatcounter.com account (`CODE.goatcounter.com`).
 *
 * Two things have to be true on the GoatCounter side for the ticker to show a
 * number:
 *   1. An account exists at `https://CODE.goatcounter.com`.
 *   2. "Allow adding visitor counts on your website" is enabled in its settings,
 *      which is what makes the public counter JSON readable.
 *
 * Until then the ticker shows dashes and prints the read failure under itself,
 * and pageviews simply are not recorded. Change the code here and the whole
 * feature follows.
 */
export const GOATCOUNTER_CODE = "danavner";

const ENDPOINT = `https://${GOATCOUNTER_CODE}.goatcounter.com`;

/** The hosts the counter talks to, so the "nothing phones home" test can allow exactly these. */
export const ANALYTICS_HOSTS = [
  "gc.zgo.at",
  `${GOATCOUNTER_CODE}.goatcounter.com`,
];

declare global {
  interface Window {
    goatcounter?: {
      count?: (vars?: Record<string, unknown>) => void;
      no_onload?: boolean;
    };
  }
}

/**
 * Injects the GoatCounter pageview script once per full page load. It records
 * the visit; it does not read anything back. Guarded by id so a hot reload or a
 * second call does not stack duplicate scripts.
 *
 * count.js normally counts on the window `load` event, but this runs from the
 * app entry, after that event has already fired, so the built-in auto-count
 * never triggers. We turn it off with `no_onload` and count once explicitly when
 * the script is ready - GoatCounter's documented pattern for single-page apps.
 * count.js still skips localhost on its own, so dev never records.
 */
export function initVisitorCount() {
  if (typeof document === "undefined" || document.getElementById("goatcounter"))
    return;

  window.goatcounter = { no_onload: true };

  const script = document.createElement("script");
  script.id = "goatcounter";
  script.async = true;
  script.src = "//gc.zgo.at/count.js";
  script.dataset.goatcounter = `${ENDPOINT}/count`;
  script.addEventListener("load", () => window.goatcounter?.count?.());
  document.head.appendChild(script);
}

/**
 * The live total, read straight from GoatCounter so the number is current.
 * `?start=2020-01-01` (before the site existed) asks for the full running total
 * and, being part of the computed result, keys a fresh CDN entry - dodging a
 * copy of TOTAL.json that once wedged serving a stale `0`.
 */
const COUNTER_URL = `${ENDPOINT}/counter/TOTAL.json?start=2020-01-01`;

/**
 * A usable total is a positive integer. Zero and empty are errors rather than
 * numbers: an all-zeros odometer on a site that plainly has traffic means the
 * read went wrong, and saying so beats displaying it. Accepts GoatCounter's
 * formatted string ("1,234") as well as a bare number.
 */
function asPositive(value: unknown): number | null {
  const n =
    typeof value === "string"
      ? Number(value.replace(/[^0-9]/g, ""))
      : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The visitor total for the ticker, read live from GoatCounter on every page
 * load. Throws on any failure so the ticker can surface the reason on the page
 * instead of quietly showing nothing.
 *
 * The request is deliberately bare: no headers, no `credentials`. GoatCounter's
 * `/counter/*.json` endpoint is built for browsers and answers with
 * `Access-Control-Allow-Origin: *`, which is all a simple cross-origin GET
 * needs. Adding an `Accept` or `Content-Type` header would push this out of
 * CORS' safelist and force a preflight `OPTIONS` the endpoint does not answer,
 * so the fetch would fail on headers meant to help it.
 *
 * Worth knowing: Safari and Firefox content blockers drop requests to analytics
 * domains outright, GoatCounter included. Those visitors get the error message
 * rather than a number, which is the honest result of reading this live.
 */
export async function fetchVisitorCount(signal?: AbortSignal): Promise<number> {
  const response = await fetch(COUNTER_URL, { signal });
  if (!response.ok) throw new Error(`GoatCounter responded ${response.status}`);

  const { count } = (await response.json()) as { count?: string };
  const total = asPositive(count);
  if (total == null)
    throw new Error(`GoatCounter returned no usable total (got ${count})`);

  return total;
}
