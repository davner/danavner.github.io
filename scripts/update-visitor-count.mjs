/**
 * Refreshes the committed visitor total in `public/visitor-count.json`.
 *
 * The counter is served from that file, same-origin, rather than fetched from
 * GoatCounter in the browser: GoatCounter lives on a third-party host, and
 * Safari/Firefox content blockers drop cross-site requests to analytics domains
 * - GoatCounter included, by its own admission - so a live client fetch shows a
 * dead counter for anyone running a blocker. This script is the one place that
 * talks to GoatCounter, run nightly from CI where no blocker exists.
 *
 * The committed file doubles as the durable last-known-good value. So a failed
 * or empty read writes NOTHING: the previous number stays committed and keeps
 * showing. The file only changes on a real, positive total, which means the
 * nightly job commits only when the number actually moved - no git noise.
 *
 * `?start=2020-01-01` (before the site existed) asks for the full running total
 * and, being part of the computed result, keys a fresh CDN entry - dodging a
 * copy of `/counter/TOTAL.json` that once wedged serving a stale `0`. The
 * GoatCounter code is read from the app's own module so it has one home.
 */
import { readFile, writeFile } from "node:fs/promises";

const analytics = await readFile(new URL("../src/lib/analytics.ts", import.meta.url), "utf8");
const code = analytics.match(/GOATCOUNTER_CODE\s*=\s*"([^"]+)"/)?.[1];

async function readTotal() {
  if (!code) return null;
  try {
    const url = `https://${code}.goatcounter.com/counter/TOTAL.json?start=2020-01-01`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const { count } = await response.json();
    const total = Number(String(count ?? "").replace(/[^0-9]/g, ""));
    return Number.isFinite(total) && total > 0 ? total : null;
  } catch {
    return null;
  }
}

const count = await readTotal();
if (count == null) {
  console.log("visitor-count: read failed or empty, keeping the committed value");
  process.exit(0);
}

const file = new URL("../public/visitor-count.json", import.meta.url);
await writeFile(file, `${JSON.stringify({ count })}\n`);
console.log(`visitor-count: total is ${count}`);
