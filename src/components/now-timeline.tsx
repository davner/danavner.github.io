import { useCallback, useEffect, useRef, useState } from "react";
import * as RovingFocus from "@radix-ui/react-roving-focus";

import { Link } from "@/components/link";
import { NowProse } from "@/components/now-prose";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/blog";
import { heldLabel, type NowEntry } from "@/lib/now";
import { cn } from "@/lib/utils";

/** "Jul 14" - the rail is a scale, so it only needs enough to place a point on it. */
function railLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function yearOf(date: string): string {
  return date.slice(0, 4);
}

/**
 * The archive, as a rail of dates over a reading pane.
 *
 * A scroll pane on its own only gives sequential access, which makes the oldest
 * entry the most expensive one to reach - you have to travel through everything
 * newer to get to it, and that cost grows with every update. The rail is what
 * turns it into a timeline: every date is one click away at any depth, and the
 * pane still scrolls normally for anyone who would rather wander back through it.
 *
 * The two stay in step both ways. Picking a date scrolls the pane to it;
 * scrolling the pane moves the marker on the rail, so the rail always says where
 * you are rather than only where you last clicked.
 *
 * An archived entry with photos prints a count, never the photos themselves.
 * Two reasons, both about the pane rather than about taste: it is capped at
 * `max-h-[26rem]`, and an `aspect-4/3` carousel is taller than that on a phone,
 * so one entry's pictures would push the archive itself off the screen. And
 * every archived entry is mounted at once, so ten entries with photos is ten
 * embla instances measuring inside a scrolling container - a cost that grows
 * with the archive and is paid by everyone who opens the page.
 */
export function NowTimeline({
  entries,
  current,
}: {
  /** Archived entries, newest first. */
  entries: NowEntry[];
  /** What replaced the newest archived entry, for its "stood for" figure. */
  current: NowEntry;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLLIElement>());
  const rail = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState(entries[0]?.updated ?? "");
  /*
   * A click scrolls the pane, which fires the observer, which would fight the
   * click for control of the marker. This suppresses the observer until the
   * smooth scroll has settled.
   */
  const jumping = useRef(false);
  /*
   * Which entries are currently inside the pane's top band. Kept rather than
   * derived, because an `IntersectionObserver` callback carries only the
   * targets whose state *changed* - an entry that is still in the band files no
   * record at all, so the callback alone cannot see it.
   */
  const inBand = useRef(new Set<string>());

  const jumpTo = useCallback((date: string) => {
    const pane = viewport.current;
    const target = items.current.get(date);
    if (!pane || !target) return;

    setActive(date);
    jumping.current = true;

    // Measured against the pane rather than the page: `scrollIntoView` would
    // scroll the document as well, which yanks the whole page around.
    const top =
      target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pane.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });

    window.setTimeout(
      () => {
        jumping.current = false;
      },
      reduced ? 0 : 500,
    );
  }, []);

  // Whichever entry is nearest the top of the pane is the one being read.
  useEffect(() => {
    const pane = viewport.current;
    if (!pane) return;

    // The effect re-runs on `entries`, and a set filled by the previous
    // observer would outlive the observer that filled it.
    inBand.current = new Set();

    const observer = new IntersectionObserver(
      (records) => {
        // Recorded before the jump guard, not after. A record dropped here is a
        // fact the set never learns again, and a 500ms smooth scroll fires
        // plenty of them.
        for (const record of records) {
          const date = record.target.getAttribute("data-date");
          if (!date) continue;
          if (record.isIntersecting) inBand.current.add(date);
          else inBand.current.delete(date);
        }

        if (jumping.current) return;

        /*
         * The topmost entry still in the band, not the last one to enter it.
         * `entries` is newest-first and rendered in that order, so the first of
         * them in the set is the highest in the pane - no measuring needed, and
         * none wanted: `boundingClientRect` on a record is a snapshot from when
         * that record fired, so sorting on it reads stale geometry.
         *
         * Taking the topmost of `records` instead is wrong: `records` holds only
         * the entries that changed. Scrolling down through a long entry, the one
         * below it enters the band and files a record while the one above is
         * still there and files none - so the marker moves on while the entry
         * the reader is looking at is still at the top of the pane.
         */
        const top = entries.find((entry) => inBand.current.has(entry.updated));
        if (top) setActive(top.updated);
      },
      {
        root: pane,
        // Only the top slice of the pane counts as "where you are", so an entry
        // becomes active as it arrives rather than while it is still leaving.
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      },
    );

    for (const element of items.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [entries]);

  // Keep the marked date on screen when scrolling moved it, not clicking.
  useEffect(() => {
    const port = rail.current;
    // The wrapper rather than the pill: a pill that opens a year carries its
    // year label as a sibling, and scrolling the pill alone leaves that label
    // just off the left edge.
    const group = port?.querySelector<HTMLElement>(`[data-rail-group="${active}"]`);
    if (!port || !group || !active || jumping.current) return;

    const view = port.getBoundingClientRect();
    const box = group.getBoundingClientRect();
    // Nothing to do while the marker is already on screen, which is the state
    // on mount: `active` starts on the newest entry and the rail starts at its
    // own left edge. So this only moves once scrolling has carried the marker
    // off an edge, which is the whole of what it is for.
    if (box.left >= view.left && box.right <= view.right) return;

    /*
     * The rail's own viewport, scrolled sideways by hand, for the same reason
     * `jumpTo` measures against the pane rather than calling `scrollIntoView`:
     * that method scrolls every scrollable ancestor it can reach, the document
     * included. Here it dragged the whole page down the moment the component
     * mounted - `ScrollToTop` resets the scroll in its own mount effect, but
     * this route is lazy, so it mounts in a later commit and nothing puts the
     * page back afterwards. It also carried Chrome's sequential focus
     * navigation starting point down with it, which left the reader's first Tab
     * landing inside the pane, past the skip link and the entire header.
     */
    const left =
      box.left < view.left
        ? port.scrollLeft + (box.left - view.left)
        : port.scrollLeft + (box.right - view.right);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    port.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  }, [active]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/*
       * The rail scrolls sideways once there are more dates than fit, which is
       * the point at which a wrapped block of them would start pushing the pane
       * off the screen. Its own scrollbar stays visible for the same reason the
       * pane's does.
       */}
      <ScrollArea type="always" viewportRef={rail} className="border border-border">
        <RovingFocus.Root
          orientation="horizontal"
          loop
          role="toolbar"
          aria-orientation="horizontal"
          // The verb lives on the container, which is what frees each pill to
          // be named after nothing but the date it prints.
          aria-label="Jump to a date"
          className="flex w-max items-stretch gap-px p-2"
        >
          {entries.map((entry, index) => {
            const year = yearOf(entry.updated);
            // A year label where the year changes, so the rail reads as a scale
            // rather than as a row of interchangeable days.
            const marksYear = index === 0 || yearOf(entries[index - 1].updated) !== year;
            const marked = entry.updated === active;

            return (
              <div
                key={entry.updated}
                data-rail-group={entry.updated}
                className="flex items-stretch"
              >
                {marksYear ? (
                  /*
                   * `text-muted-foreground` undimmed. It is already this site's
                   * dim token, so an alpha on top of it dims twice and drops the
                   * label under the 4.5:1 WCAG 1.4.3 asks of text, which
                   * undimmed clears in both themes. The label stays subordinate
                   * to the pills anyway - they carry a border and a background
                   * it does not.
                   *
                   * Hidden from the accessibility tree because every pill now
                   * carries its own year: without it a reader hears "2026" and
                   * then "Aug 10, 2026".
                   */
                  <span
                    aria-hidden
                    className="readout-dim flex items-center px-3 text-muted-foreground"
                  >
                    {year}
                  </span>
                ) : null}
                {/*
                 * `active` is what makes Tab land on the marked pill rather
                 * than the newest one: the group puts the active item first in
                 * the candidate list it focuses on entry. Radix `Toolbar` wraps
                 * this same primitive but does not forward `active`, which is
                 * why the rail is built on the primitive directly - otherwise a
                 * reader who scrolled back to an old entry would tab into the
                 * far end of a list that grows with every update.
                 */}
                <RovingFocus.Item asChild active={marked} focusable>
                  {/* No `aria-label`. The name is computed from the content
                      below, which is the only form of it that cannot drift out
                      of step with what the pill prints (WCAG 2.5.3). */}
                  <button
                    type="button"
                    data-rail-date={entry.updated}
                    aria-current={marked ? "true" : undefined}
                    onClick={() => jumpTo(entry.updated)}
                    className={cn(
                      "readout inline-flex h-9 flex-none cursor-pointer items-center justify-center",
                      // `text-sm` rather than `readout`'s own smaller size, which
                      // would shrink the pill.
                      "px-3 py-2 text-sm whitespace-nowrap transition-colors",
                      "shadow-[0_0_0_1px_var(--color-border)]",
                      // The ring itself comes from `index.css`. This lifts the
                      // focused pill over the seams its neighbours paint, which
                      // otherwise sit on top of the stroke along both edges.
                      "focus-visible:z-10",
                      "bg-background text-muted-foreground",
                      // Only while it is not the marked one, or hover would
                      // paint ember text onto the ember pill.
                      !marked && "hover:text-ember",
                      marked && "bg-ember text-primary-foreground",
                    )}
                  >
                    {railLabel(entry.updated)}
                    {/* One interpolated string, not `, {year}`: as separate JSX
                        children the comma and space are whitespace the name
                        computation can drop, and it reads "Aug 102026". */}
                    <span className="sr-only">{`, ${year}`}</span>
                  </button>
                </RovingFocus.Item>
              </div>
            );
          })}
        </RovingFocus.Root>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/*
       * `scroll-py-2` reserves the focus ring's room at the pane's own edges.
       * Chrome only scrolls a newly focused element into view when its border
       * box is not already fully inside the scrollport - a ring bleeding past
       * that box does not count - so a link sitting flush against an edge keeps
       * its position and loses the stroke on that side. The archived date link's
       * ring reaches several pixels past its border box. `scroll-padding` is
       * what that test measures against, so 8px here is a floor on the
       * clearance every focusable in the pane gets, rather than an antidote
       * this one link carries and the next one added forgets.
       */}
      <ScrollArea
        type="always"
        viewportRef={viewport}
        className="border border-border"
        viewportClassName="max-h-[26rem] scroll-py-2 p-5 sm:max-h-[34rem] sm:p-8"
      >
        <ol className="flex flex-col gap-16 border-l border-border pl-6 sm:pl-8">
          {entries.map((entry, index) => {
            const held = heldLabel(entry, entries[index - 1] ?? current);
            const count = entry.photos.length;
            // Whatever the link prints, in the same order, so the accessible
            // name contains its own visible text - WCAG 2.5.3. Building the two
            // separately is how the count ends up on screen and not in the name.
            const shown =
              count > 0
                ? `${formatDate(entry.updated)} - ${count} ${count === 1 ? "photo" : "photos"}`
                : formatDate(entry.updated);

            return (
              <li
                key={entry.updated}
                data-slot="now-archived"
                data-date={entry.updated}
                ref={(element) => {
                  if (element) items.current.set(entry.updated, element);
                  else items.current.delete(entry.updated);
                }}
              >
                <p className="readout-dim">
                  {/*
                   * The rail pill above and this date are two affordances on the
                   * same day, told apart deliberately: the pill is a button that
                   * scrolls the pane and is named after nothing but the date it
                   * shows; this is a link that leaves the page and says so in
                   * its own name. An anchor carries `cursor: pointer` from the
                   * UA sheet, so it needs nothing added for the cursor sweep.
                   *
                   * `readout-link` carries the resting underline and the pushed
                   * focus offset; the reasoning is in `src/index.css` beside the
                   * class.
                   */}
                  <Link
                    to={`/now/${entry.updated}`}
                    aria-label={`${shown} - open this entry`}
                    className="readout-link"
                  >
                    <time dateTime={entry.updated}>{formatDate(entry.updated)}</time>
                    {/* A count, not the photos. Deliberately outside the `time`
                        element: inside, `datetime="2026-08-10"` would be
                        describing "August 10, 2026 - 3 photos". */}
                    {count > 0 ? (
                      <>
                        {" - "}
                        {count} {count === 1 ? "photo" : "photos"}
                      </>
                    ) : null}
                  </Link>
                  {held ? <> - stood for {held}</> : null}
                </p>
                <div className="mt-4">
                  <NowProse body={entry.body} />
                </div>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </div>
  );
}
