import { comics as rawComics } from "virtual:comics";

/**
 * One comic, whether it is a series on the shelf or a single issue on the pull
 * list. The two come from different markup and carry different fields, so the
 * ones that only apply to one of them are empty on the other rather than
 * optional - a series has no price, an issue has no run of years.
 */
export interface ComicEntry {
  /** Unique across all three lists, and the name of the cover file. */
  key: string;
  id: number;
  name: string;
  publisher: string;
  /** "2026" or "2026 - Present". Series only. */
  years: string;
  /** How many issues of the run are held. Series only. */
  issues: number | null;
  /** Cover price as League of Comic Geeks prints it. Issues only. */
  price: string;
  /** ISO date, `YYYY-MM-DD`. Issues only. */
  released: string;
  url: string;
  cover: string;
}

export interface ComicsPayload {
  user: string;
  url: string;
  /** ISO date of the last successful read. */
  fetched: string;
  series: ComicEntry[];
  pullList: ComicEntry[];
  wants: ComicEntry[];
}

/**
 * Read from `src/content/comics.json` and validated at build time by
 * `vite-plugin-content.ts`. Empty lists mean the fetch has never run, and the
 * page says so rather than rendering an empty grid.
 */
export const comics: ComicsPayload = rawComics;

/** The three lists, in the order the page shows them. */
export const SHELVES = [
  {
    id: "series",
    label: "Collection",
    /** Shown under the heading when the shelf has something on it. */
    note: "Runs I own at least one issue of.",
  },
  { id: "pullList", label: "Pull list", note: "Reserved at the shop this week." },
  { id: "wants", label: "Wants", note: "On the list, not yet on the shelf." },
] as const;

export type ShelfId = (typeof SHELVES)[number]["id"];

export function shelf(id: ShelfId): ComicEntry[] {
  return comics[id];
}

/**
 * Publishers across the collection, biggest first. Two-thirds of a comic shelf
 * is usually two publishers, which is worth saying out loud on a page that is
 * otherwise a wall of covers.
 */
export function publisherCounts(entries: ComicEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.publisher) continue;
    counts.set(entry.publisher, (counts.get(entry.publisher) ?? 0) + 1);
  }

  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Total issues held, which is not the same as the number of runs. */
export function issueCount(entries: ComicEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.issues ?? 0), 0);
}
