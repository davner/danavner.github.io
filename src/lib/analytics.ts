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
 * Until then the ticker degrades to a dashed "offline" readout, and pageviews
 * simply are not recorded. Change the code here and the whole feature follows.
 */
export const GOATCOUNTER_CODE = "danavner";

const ENDPOINT = `https://${GOATCOUNTER_CODE}.goatcounter.com`;

/** The hosts the counter talks to, so the "nothing phones home" test can allow exactly these. */
export const ANALYTICS_HOSTS = ["gc.zgo.at", `${GOATCOUNTER_CODE}.goatcounter.com`];

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
  if (typeof document === "undefined" || document.getElementById("goatcounter")) return;

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
const LIVE_URL = `${ENDPOINT}/counter/TOTAL.json?start=2020-01-01`;

/**
 * The stored total, baked same-origin by the nightly job (see
 * `scripts/update-visitor-count.mjs`). It is the fallback for the large share of
 * visitors whose browser blocks the cross-site GoatCounter read - Safari and
 * Firefox content blockers drop requests to analytics domains - so the counter
 * shows a recent number instead of going dark. `BASE_URL` keeps the path right
 * under any Vite base.
 */
const STORED_URL = `${import.meta.env?.BASE_URL ?? "/"}visitor-count.json`;

/**
 * A usable total is a positive integer. Zero and empty fold to null on purpose:
 * the stored number, or the offline face, reads better than an all-zeros
 * odometer on a site that plainly has traffic. Accepts GoatCounter's formatted
 * string ("1,234") or the stored file's bare number.
 */
function asPositive(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(/[^0-9]/g, "")) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Read the live GoatCounter total. Throws on a network or HTTP failure. */
async function fetchLiveCount(signal?: AbortSignal): Promise<number | null> {
  const response = await fetch(LIVE_URL, { signal });
  if (!response.ok) throw new Error(`GoatCounter responded ${response.status}`);
  const { count } = (await response.json()) as { count?: string };
  return asPositive(count);
}

/** Read the stored same-origin total. Null on any failure - it is the floor. */
async function fetchStoredCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(STORED_URL, { signal });
    if (!response.ok) return null;
    const { count } = (await response.json()) as { count?: number | null };
    return asPositive(count);
  } catch {
    return null;
  }
}

/**
 * The visitor total for the ticker. Reads GoatCounter live so the number is
 * current, and falls back to the stored same-origin value when that read fails
 * or comes back empty - which is exactly what happens for a visitor whose
 * content blocker drops the cross-site request. The failure is logged so it is
 * visible in the console rather than silently swallowed. Returns null only when
 * both sources come up empty, and the ticker shows its offline face.
 */
export async function fetchVisitorCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const live = await fetchLiveCount(signal);
    if (live != null) return live;
    console.warn("Visitor count: live read returned no usable total; using the stored value.");
  } catch (error) {
    if (signal?.aborted) return null;
    console.error("Visitor count: live read failed; using the stored value.", error);
  }
  return fetchStoredCount(signal);
}
