import type { Locator } from "@playwright/test";

/**
 * The figure a stat `dd` shows, whether it is plain text or a NumberFlow
 * odometer.
 *
 * NumberFlow renders its digits inside a shadow root, so the dd's `innerText`
 * is empty; the machine-readable value is the formatted string the element
 * also hands to `ElementInternals.ariaLabel`. `_data` is the library's
 * private field, pinned deliberately at the installed 0.6.2: if an upgrade
 * renames it, every stat read here fails loudly rather than silently reading
 * an empty string.
 */
export function statText(dd: Locator): Promise<string> {
  return dd.evaluate((el) => {
    const flow = el.querySelector("number-flow-react") as
      (HTMLElement & { _data?: { valueAsString?: string } }) | null;
    if (flow) return flow._data?.valueAsString ?? "";
    return (el.textContent ?? "").trim();
  });
}

/** `statText` over every matched dd, in DOM order. */
export function statTexts(dds: Locator): Promise<string[]> {
  return dds.evaluateAll((els) =>
    els.map((el) => {
      const flow = el.querySelector("number-flow-react") as
        (HTMLElement & { _data?: { valueAsString?: string } }) | null;
      if (flow) return flow._data?.valueAsString ?? "";
      return (el.textContent ?? "").trim();
    }),
  );
}

/**
 * An element's visible sentence with each NumberFlow's value spliced back in.
 *
 * Playwright's text engine pierces open shadow roots, so `toHaveText` against
 * a line holding an odometer sees the whole masked digit strip
 * ("0123456789 of 3 albums"); plain `textContent` sees the light DOM, where
 * the number is missing entirely. This walks the light DOM and substitutes
 * each flow's formatted value where the element sits.
 */
export function flowText(host: Locator): Promise<string> {
  return host.evaluate((el) => {
    const read = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
      const child = node as HTMLElement & { _data?: { valueAsString?: string } };
      if (child.tagName === "NUMBER-FLOW-REACT") return child._data?.valueAsString ?? "";
      return [...node.childNodes].map(read).join("");
    };
    return read(el).trim();
  });
}
