import { useEffect, useState } from "react";

/**
 * How long the message sits still before it is handed to the live region.
 *
 * A search box fires on every keystroke, and a polite live region queues what
 * it is given rather than replacing it, so announcing each intermediate count
 * would read eight results out loud while the reader is still typing the word.
 * Waiting for the typing to stop means one announcement, of the answer.
 *
 * Half a second is comfortably longer than the gap between keystrokes and short
 * enough that the answer arrives while the reader is still waiting for it.
 */
const SETTLE_MS = 500;

/**
 * Says out loud what a filter just did.
 *
 * WCAG 4.1.3 asks that a change of status a sighted reader can see - a list
 * that just went from 83 records to 28 - reaches someone who cannot see it,
 * without moving their focus. A visible count elsewhere on the page does not
 * satisfy it: a screen reader user typing in the search box is told nothing at
 * all, and the only way to find out is to leave the field and read the list.
 *
 * Deliberately not `/vinyl`-specific: the caller supplies the sentence and its
 * own nouns, so this owns only the announcing. Every page that filters a
 * collection mounts it - `/vinyl`, `/blog`, `/comics` and `/fortnite` - and a
 * fifth one should reach for this rather than a second component.
 *
 * Two things it has to get right, and both are about *when* rather than what:
 *
 * - The region is rendered unconditionally, with its text changing. A live
 *   region that appears at the same moment as its content is usually missed,
 *   because assistive technology only announces changes to a region it was
 *   already watching. So this must not be wrapped in a condition by the caller.
 * - Its first value is never announced. It is the initial state of the region
 *   rather than a change to it, which is what stops every page load reading its
 *   own result count out.
 */
export function FilterStatus({ message }: { message: string }) {
  const [announced, setAnnounced] = useState(message);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(message), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    // `role="status"` is the semantic; `aria-live` restates it because some
    // screen readers have historically honoured one and not the other.
    <p role="status" aria-live="polite" className="sr-only">
      {announced}
    </p>
  );
}
