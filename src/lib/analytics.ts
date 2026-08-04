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
 * The total site visitor count as a number, or null when it cannot be read
 * (offline, blocked, public counts disabled, or the account does not exist yet).
 * The endpoint returns the number as a formatted string like "1,234".
 */
export async function fetchVisitorCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(`${ENDPOINT}/counter/TOTAL.json`, { signal });
    if (!response.ok) return null;

    const data = (await response.json()) as { count?: string };
    if (!data.count) return null;

    const count = Number(data.count.replace(/[^0-9]/g, ""));
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}
