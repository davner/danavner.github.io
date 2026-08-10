/**
 * GoatCounter is the one exception to the "nothing phones home" rule: a
 * privacy-friendly, cookie-free pageview counter. Everything hangs off this one
 * site code, which is the subdomain of the goatcounter.com account
 * (`CODE.goatcounter.com`). Change the code here and the whole thing follows.
 *
 * This records visits and nothing more. Reading the total back and showing it on
 * the landing page used to live here too, and was removed: ad blockers and DNS
 * blocklists match on domain rather than on what a service does, so the read was
 * dead for anyone running one, and a counter that shows a number to some
 * visitors and an error to others is worse than no counter. The stats are still
 * collected - they are just read in the GoatCounter dashboard rather than
 * printed on the site.
 *
 * The recording beat is blocked for those same visitors, so the dashboard sees
 * less traffic than actually arrives. GoatCounter's own author puts the
 * shortfall at roughly a third. That is a known and accepted gap, not a bug.
 */
export const GOATCOUNTER_CODE = "danavner";

const ENDPOINT = `https://${GOATCOUNTER_CODE}.goatcounter.com`;

/** The hosts analytics talks to, so the "nothing phones home" test can allow exactly these. */
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
