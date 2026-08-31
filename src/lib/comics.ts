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

export interface Publisher {
  name: string;
  /** Issues owned, not runs. See `publishers` on the payload. */
  count: number;
}

export interface ComicsPayload {
  user: string;
  url: string;
  /** ISO date of the last successful read. */
  fetched: string;
  /**
   * Publisher totals as League of Comic Geeks reports them, biggest first, and
   * weighted by issues owned rather than by runs - 24 DC issues across however
   * many DC series. Counting the series here instead would answer a different
   * question and get "most of" wrong.
   */
  publishers: Publisher[];
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
  /*
   * "This week" rather than "Pull list", because it is the narrower of the two
   * things that phrase means. This is the issues shipping this Wednesday that
   * are pulled for me - not the standing list of series I am subscribed to.
   * That second list lives behind a login and cannot be read; see the note in
   * `scripts/update-comics.mjs`. Calling this one "Pull list" invites exactly
   * the wrong reading.
   */
  { id: "pullList", label: "This week", note: "Pulled for me at the shop this Wednesday." },
  { id: "wants", label: "Wants", note: "On the list, not yet on the shelf." },
] as const;

export type ShelfId = (typeof SHELVES)[number]["id"];

export function shelf(id: ShelfId): ComicEntry[] {
  return comics[id];
}

/** Total issues held, which is not the same as the number of runs. */
export function issueCount(entries: ComicEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.issues ?? 0), 0);
}
