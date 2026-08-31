/**
 * The once-only guard behind `RouteBoundary`'s reload.
 *
 * Its own module so the boundary file exports nothing but a component, which is
 * what `react-refresh/only-export-components` asks for.
 */
const KEY = "route-chunk-reloaded-at";

/**
 * How long a reload counts as "just tried".
 *
 * A plain "have we reloaded yet" flag does not work: it has to be cleared at
 * some point or the next genuine stale chunk never gets its reload, and the only
 * obvious place to clear it - the app mounting - happens *before* the chunk
 * fails again. So every reload clears the flag that was supposed to stop the
 * next one, and the page bounces forever.
 *
 * A timestamp has no such gap. A second failure moments after a reload is the
 * same failure and gets the error page; one an hour later is a fresh deploy and
 * gets its own reload. Fifteen seconds is comfortably longer than a reload plus
 * a chunk fetch, and far shorter than the gap between two deploys.
 */
const RETRY_WINDOW_MS = 15_000;

/**
 * What a missing chunk looks like across browsers. Chrome and Firefox say
 * "dynamically imported module", Safari talks about the module script, and a
 * `404.html` served in place of JavaScript trips the MIME check instead - the
 * same cause wearing three different messages.
 */
export function looksLikeStaleChunk(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|module script|ChunkLoadError|MIME type|Failed to fetch/i.test(
    message,
  );
}

/**
 * Whether to spend a reload on this failure, recording it if so.
 *
 * Reads and writes in one call on purpose. Two calls would be two chances to
 * check without recording, which is the shape that loops.
 */
export function shouldReloadForStaleChunk(): boolean {
  let last: number;
  try {
    last = Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    // Safari in private mode throws on storage. Without somewhere to record the
    // attempt there is no way to stop a loop, so do not start one.
    return false;
  }

  if (Date.now() - last < RETRY_WINDOW_MS) return false;

  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  return true;
}
