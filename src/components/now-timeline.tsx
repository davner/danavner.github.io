import { useCallback, useEffect, useRef, useState } from "react";

import { NowProse } from "@/components/now-prose";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate } from "@/lib/blog";
import { heldForDays, type NowEntry } from "@/lib/now";
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

/** How long an entry stood, when that is more than a day. */
function heldLabel(entry: NowEntry, replacedBy: NowEntry | undefined): string {
  const held = heldForDays(entry, replacedBy);
  if (held === null || held < 1) return "";

  if (held < 14) return `${held} ${held === 1 ? "day" : "days"}`;
  if (held < 60) return `${Math.round(held / 7)} weeks`;
  return `${Math.round(held / 30)} months`;
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

    const observer = new IntersectionObserver(
      (records) => {
        if (jumping.current) return;

        const top = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        const date = top?.target.getAttribute("data-date");
        if (date) setActive(date);
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
    if (!active || jumping.current) return;
    // The wrapper rather than the pill: a pill that opens a year carries its
    // year label as a sibling, and scrolling the pill alone leaves that label
    // just off the left edge.
    rail.current
      ?.querySelector(`[data-rail-group="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
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
        <ToggleGroup
          type="single"
          value={active}
          onValueChange={(next) => {
            if (next) jumpTo(next);
          }}
          aria-label="Jump to a date"
          className="flex w-max items-stretch p-2"
        >
          {entries.map((entry, index) => {
            const year = yearOf(entry.updated);
            // A year label where the year changes, so the rail reads as a scale
            // rather than as a row of interchangeable days.
            const marksYear = index === 0 || yearOf(entries[index - 1].updated) !== year;

            return (
              <div
                key={entry.updated}
                data-rail-group={entry.updated}
                className="flex items-stretch"
              >
                {marksYear ? (
                  <span className="readout-dim flex items-center px-3 text-muted-foreground/70">
                    {year}
                  </span>
                ) : null}
                <ToggleGroupItem
                  value={entry.updated}
                  data-rail-date={entry.updated}
                  aria-label={`Jump to ${formatDate(entry.updated)}`}
                  className={cn(
                    "readout flex-none cursor-pointer px-3 py-2 whitespace-nowrap",
                    "shadow-[0_0_0_1px_var(--color-border)]",
                    "bg-background text-muted-foreground hover:bg-background hover:text-ember",
                    "data-[state=on]:bg-ember data-[state=on]:text-primary-foreground",
                  )}
                >
                  {railLabel(entry.updated)}
                </ToggleGroupItem>
              </div>
            );
          })}
        </ToggleGroup>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <ScrollArea
        type="always"
        viewportRef={viewport}
        className="border border-border"
        viewportClassName="max-h-[26rem] p-5 sm:max-h-[34rem] sm:p-8"
      >
        <ol className="flex flex-col gap-16 border-l border-border pl-6 sm:pl-8">
          {entries.map((entry, index) => {
            const held = heldLabel(entry, entries[index - 1] ?? current);

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
                  <time dateTime={entry.updated}>{formatDate(entry.updated)}</time>
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
