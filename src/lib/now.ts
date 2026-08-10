import { now as rawNow } from "virtual:now";

export interface NowEntry {
  /** ISO date, `YYYY-MM-DD`. Empty on `current` when nothing is written yet. */
  updated: string;
  /** Markdown body with the frontmatter block removed. */
  body: string;
}

export interface Now {
  /** What `src/content/now.md` says today. */
  current: NowEntry;
  /** What it used to say, newest first. Written by the archive job, not by hand. */
  archive: NowEntry[];
}

/**
 * Parsed and validated by the content plugin in `vite-plugin-content.ts`. An
 * empty `current.body` means there is no `src/content/now.md` yet, and the page
 * says so rather than rendering a blank.
 */
export const now: Now = rawNow;

/**
 * How long ago the page was written, in whole days. The point of a now page is
 * that the reader can tell how stale it is, and "3 months ago" says that faster
 * than a date they have to do arithmetic on.
 */
export function stalenessInDays(updated: string, today = new Date()): number | null {
  if (!updated) return null;

  // Both ends parsed as UTC noon so a timezone can never shift the count by a
  // day, the same way `formatDate` in `lib/blog.ts` avoids it.
  const then = new Date(`${updated}T12:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;

  const nowMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12);

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
