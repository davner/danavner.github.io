/**
 * Makes the page behind a modal overlay unreachable, not just unannounced.
 *
 * While a Radix modal is open - the mobile nav sheet, the `/vinyl` sort listbox
 * - the `aria-hidden` package Radix uses puts `aria-hidden="true"` on everything
 * outside the overlay and takes it off again on close. It does not also mark
 * those subtrees `inert`, and the two attributes do different jobs.
 * `aria-hidden` removes a subtree from the accessibility tree and nothing more:
 * every control in it stays tabbable, stays a valid `focus()` target, and stays
 * findable by find-in-page. A screen reader whose virtual cursor lands in there
 * is reading content the browser is simultaneously telling that same reader does
 * not exist. axe calls it `aria-hidden-focus`; it is a Level A failure of WCAG
 * 4.1.2.
 *
 * Radix's focus guards do keep Tab inside the overlay, which narrows the
 * exposure without closing it: a Tab trap has no bearing on a virtual cursor, on
 * find-in-page, or on a programmatic `focus()`.
 *
 * ## Why this follows an attribute instead of naming an element
 *
 * The obvious version of this watches the app root, because that is what gets
 * hidden - until it is not. `aria-hidden` deliberately leaves any subtree
 * containing a live region reachable, so that a status message can still be
 * announced from behind a modal. A live region anywhere under the root makes
 * the library hide the root's children one at a time instead of the root -
 * `/vinyl`'s filtered-count region does exactly that - and a mirror pointed at
 * the root then has nothing to do.
 *
 * So the mirror follows the library's own marker, `data-aria-hidden`, wherever
 * it lands and at whatever depth. Nothing has to be told about a new overlay,
 * and no assumption about the shape of the page can go stale under it.
 *
 * ## What is not made inert
 *
 * Only what the library did not hide. In particular Radix's focus guards carry
 * the marker like everything else, and are made inert like everything else -
 * verified not to cost Tab containment in either overlay, because Radix's focus
 * scope holds the boundary itself and the guards are its backstop.
 *
 * There is no cost to the sighted mouse user: Radix already sets
 * `pointer-events: none` over the same span of time, and `inert` only supplies
 * the parts `aria-hidden` was missing.
 */
const MARKER = "data-aria-hidden";

/**
 * Starts the mirror. Returns a teardown that stops watching and lifts every
 * `inert` it applied, which is for tests rather than for the app: the app owns
 * the page for as long as the page exists.
 */
export function inertBehindOverlay(): () => void {
  const sync = (element: Element) => {
    if (element.getAttribute(MARKER) === "true") element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) sync(record.target as Element);
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: [MARKER],
    subtree: true,
  });

  // Anything already marked when this starts, which is nothing on a cold load
  // and everything if a modal somehow survived a remount.
  for (const element of document.querySelectorAll(`[${MARKER}]`)) sync(element);

  return () => {
    observer.disconnect();
    for (const element of document.querySelectorAll(`[${MARKER}][inert]`)) {
      element.removeAttribute("inert");
    }
  };
}
