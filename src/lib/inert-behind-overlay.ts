/**
 * Makes the page behind a modal overlay unreachable, not just unannounced.
 *
 * While a Radix modal is open - the mobile nav sheet, the `/vinyl` sort listbox
 * - the `aria-hidden` package Radix uses puts `aria-hidden="true"` on the app
 * root and takes it off again on close. It does not also mark the subtree
 * `inert`, and the two attributes do different jobs. `aria-hidden` removes a
 * subtree from the accessibility tree and nothing more: every control in it
 * stays tabbable, stays a valid `focus()` target, and stays findable by
 * find-in-page. A screen reader whose virtual cursor lands in there is reading
 * content the browser is simultaneously telling that same reader does not
 * exist.
 *
 * Measured with the sort listbox open: `#root` carries `aria-hidden="true"`,
 * contains 85 focusable elements, and nothing in the document is `inert`. axe
 * reports it as `aria-hidden-focus` on `#root` - a Level A failure of WCAG
 * 4.1.2. The mobile nav sheet has the same shape with 41 focusable elements,
 * where axe reaches no verdict rather than failing outright. The share popover
 * is not modal, never sets `aria-hidden` on the root, and is unaffected.
 *
 * Radix's focus guards do keep Tab inside the overlay, which narrows the
 * exposure without closing it: a Tab trap has no bearing on a virtual cursor,
 * on find-in-page, or on a programmatic `focus()`.
 *
 * So `inert` is mirrored onto the root for exactly as long as `aria-hidden` is
 * on it. Watching the attribute rather than wiring each component up covers
 * every Radix modal at once, including any added later, and needs nothing from
 * the components themselves. Radix's own focus guards are `aria-hidden` too and
 * are deliberately left alone: they hold no focusable content, and inerting
 * them would disable the thing keeping Tab inside the overlay.
 *
 * There is no behavioural cost to the sighted mouse user, because Radix already
 * sets `pointer-events: none` on the root for the same span of time; `inert`
 * only adds the parts `aria-hidden` was missing.
 */
export function inertBehindOverlay(root: HTMLElement): () => void {
  const sync = () => {
    if (root.getAttribute("aria-hidden") === "true") root.setAttribute("inert", "");
    else root.removeAttribute("inert");
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, { attributeFilter: ["aria-hidden"] });
  sync();

  return () => {
    observer.disconnect();
    root.removeAttribute("inert");
  };
}
