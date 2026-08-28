import { now as rawNow } from "virtual:now";

import type { Photo } from "@/lib/photo";
import { SITE_URL } from "@/lib/site";

export interface NowEntry {
  /** ISO date, `YYYY-MM-DD`. Empty on `current` when nothing is written yet. */
  updated: string;
  /** Markdown body with the frontmatter block removed. */
  body: string;
  /** Optional, and validated at build time like every other collection's. */
  photos: Photo[];
}

export interface Now {
  /** The newest entry in `src/content/now/`. */
  current: NowEntry;
  /** Every older entry, newest first. */
  archive: NowEntry[];
}

/**
 * Parsed and validated by the content plugin in `vite-plugin-content.ts`. An
 * empty `current.body` means `src/content/now/` has no entries yet, and the
 * page says so rather than rendering a blank.
 */
export const now: Now = rawNow;

/**
 * How long ago the page was written, in whole days. The point of a now page is
 * that the reader can tell how stale it is, and "3 months ago" says that faster
 * than a date they have to do arithmetic on.
 */
export function stalenessInDays(updated: string, today = new Date()): number | null {
  if (!updated) return null;

  /*
   * `updated` is a floating calendar date - it carries no timezone, and the
   * entry was not written at an instant the reader shares. So the honest
   * question is not how much time has elapsed, it is how many of the reader's
   * own days have turned since the day on the entry. That means "today" is
   * built from the *local* calendar date: read at 17:00 in Los Angeles, an
   * entry dated that morning is still today's, though UTC has moved on.
   *
   * Both ends are still anchored at noon so the subtraction lands on a whole
   * day rather than an hour either side of one, and a DST switch between them
   * cannot round the count off by a day.
   *
   * Accepted consequence: near the date line a reader can be a day ahead of
   * the author, so an entry filed the author's today can read "yesterday".
   * That is the right answer for that reader's calendar. The reverse - a
   * reader behind the author, reading an entry dated tomorrow - is what
   * `Math.max(0, ...)` below is for.
   */
  const then = new Date(`${updated}T12:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;

  const nowMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12);

  return Math.max(0, Math.round((nowMs - then) / 86_400_000));
}

/** "today", "yesterday", "3 days ago", "2 months ago". */
export function describeStaleness(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "a month ago" : `${months} months ago`;

  const years = Math.round(days / 365);
  return years === 1 ? "a year ago" : `${years} years ago`;
}

/**
 * How long the entry stood before the next one replaced it. Reads better on an
 * archived entry than a bare date does: "held for 3 weeks" says something about
 * the period, where "August 9" only says when it started.
 */
export function heldForDays(entry: NowEntry, replacedBy: NowEntry | undefined): number | null {
  if (!replacedBy?.updated || !entry.updated) return null;

  const from = new Date(`${entry.updated}T12:00:00Z`).getTime();
  const to = new Date(`${replacedBy.updated}T12:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;

  return Math.round((to - from) / 86_400_000);
}

/**
 * How long an entry stood, phrased. Empty when it stood less than a day, or
 * when it is the current entry and nothing has replaced it yet.
 *
 * Beside `heldForDays` rather than in the timeline that first printed it: the
 * permalink page prints the same figure, and two copies of the wording is two
 * places for "3 weeks" to become "21 days".
 */
export function heldLabel(entry: NowEntry, replacedBy: NowEntry | undefined): string {
  const held = heldForDays(entry, replacedBy);
  if (held === null || held < 1) return "";

  if (held < 14) return `${held} ${held === 1 ? "day" : "days"}`;
  if (held < 60) return `${Math.round(held / 7)} weeks`;
  return `${Math.round(held / 30)} months`;
}

/** Canonical, stable address for one entry. Mirrors `showUrl` in `lib/show-card.ts`. */
export function nowUrl(entry: Pick<NowEntry, "updated">): string {
  return `${SITE_URL}/now/${entry.updated}`;
}

/**
 * One archived entry and what replaced it, for its "stood for" figure.
 *
 * Null for the current entry and for a date nothing was written on. The route
 * sends both of those back to `/now`, so it has no reason to tell them apart -
 * while an entry is current its home *is* `/now`, and a date with no file
 * behind it has no home at all.
 */
export function archivedEntry(date: string): { entry: NowEntry; replacedBy: NowEntry } | null {
  const index = now.archive.findIndex((entry) => entry.updated === date);
  if (index === -1) return null;

  // `archive` is newest first, so the entry before it in the list is the one
  // that pushed it down - and for the newest archived entry that is `current`.
  return { entry: now.archive[index], replacedBy: now.archive[index - 1] ?? now.current };
}
