import type { Locator } from "@playwright/test";

/**
 * Reading a stat figure that may be a NumberFlow odometer.
 *
 * NumberFlow keeps its digits in shadow DOM - the host's `innerText` is
 * empty, and Playwright's text engine pierces the shadow and sees the whole
 * masked digit strip. What the library publishes instead is its accessible
 * contract: `ElementInternals` with role "img" and the formatted value as the
 * label. ElementInternals is invisible to page script and to Playwright's
 * locator engine alike, so the one place that contract is readable is the
 * browser's own accessibility tree, reached here over CDP - fine in this
 * suite, whose both projects run Chromium.
 *
 * The failure mode is a wrong-value red test, not a throw: an element the
 * tree gives no name reads as "".
 */

let probes = 0;

/** The accessible name the browser computes for one element. */
async function accessibleName(target: Locator): Promise<string> {
  const page = target.page();
  const token = `ax-${Date.now()}-${probes++}`;
  await target.evaluate((el, value) => el.setAttribute("data-ax-probe", value), token);
  const session = await page.context().newCDPSession(page);
  try {
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: `[data-ax-probe="${token}"]`,
    });
    const { nodes } = await session.send("Accessibility.getPartialAXTree", {
      nodeId,
      fetchRelatives: false,
    });
    return String(nodes[0]?.name?.value ?? "");
  } finally {
    await session.detach();
    await target.evaluate((el) => el.removeAttribute("data-ax-probe"));
  }
}

/** The figure a stat `dd` shows, whether plain text or an odometer. */
export async function statText(dd: Locator): Promise<string> {
  const flow = dd.locator("number-flow-react");
  if ((await flow.count()) === 0) return ((await dd.textContent()) ?? "").trim();
  return accessibleName(flow.first());
}

/** `statText` over every matched dd, in DOM order. */
export async function statTexts(dds: Locator): Promise<string[]> {
  const texts: string[] = [];
  for (const dd of await dds.all()) texts.push(await statText(dd));
  return texts;
}

/**
 * An element's visible sentence with each NumberFlow's value spliced back in
 * where the element sits - for a line like the archive head, where the words
 * around the number are light DOM and the number is not.
 */
export async function flowText(host: Locator): Promise<string> {
  const names: string[] = [];
  for (const flow of await host.locator("number-flow-react").all()) {
    names.push(await accessibleName(flow));
  }
  return host.evaluate((el, values) => {
    let next = 0;
    const read = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
      if ((node as HTMLElement).tagName === "NUMBER-FLOW-REACT") return values[next++] ?? "";
      return [...node.childNodes].map(read).join("");
    };
    return read(el).trim();
  }, names);
}
