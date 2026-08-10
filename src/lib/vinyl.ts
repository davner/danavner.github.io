import { vinyl as payload } from "virtual:vinyl";

/**
 * One record on the shelf, as Discogs describes it. Written nightly by
 * `scripts/update-vinyl.mjs` and validated at build time, so everything here is
 * already the right shape by the time the app sees it.
 */
export interface VinylRecord {
  /** Discogs release id. Two copies of the same pressing share it. */
  id: number;
  /** Discogs instance id, unique to this copy. The stable React key. */
  instanceId: number;
  /** `null` for a record sitting in Discogs' Uncategorized folder. */
  owner: string | null;
  artist: string;
  title: string;
  /** Year of this pressing, not of the original release. `null` when unknown. */
  year: number | null;
  label: string;
  catno: string;
  /** How it reads on a shelf: "LP", "2×LP", `7"`. */
  format: string;
  /** The colour of the wax, when it is not black. */
  variant: string;
  genres: string[];
  styles: string[];
  /** `YYYY-MM-DD`, when it entered the collection. */
  added: string;
  /** Out of five. `0` means unrated, which is not the same as bad. */
  rating: number;
  url: string;
  /** Path under `public/`, or `""` when Discogs had no sleeve scan. */
  cover: string;
}

/**
 * What the shelf is worth, as Discogs values it, already formatted with a
 * currency symbol.
 *
 * Read nightly and deliberately not rendered. A page about records that opens
 * with three dollar figures is a page about money, and the number invites a
 * reading of the collection nobody who keeps one recognises. The data stays so
 * that it is one component away if it ever earns a place.
 *
 * If it comes back, it cannot sit among the counts: these cover the whole
 * collection and cannot be broken down by owner, because valuing a single
 * record needs `/marketplace/price_suggestions`, which is gated behind seller
 * privileges and returns nothing for a buyer's account. Dropped in beside a
 * filtered "9 records" it would read as Alexis' nine being worth seventeen
 * hundred dollars.
 */
export interface VinylValue {
  minimum: string;
  median: string;
  maximum: string;
}

/** A person with a folder in the collection - one of Dan or Alexis. */
export interface VinylOwner {
  id: string;
  name: string;
  count: number;
}

export interface VinylPayload {
  user: string;
  url: string;
  /** `YYYY-MM-DD` in UTC, when the nightly job last read Discogs. */
  fetched: string;
  value: VinylValue;
  owners: VinylOwner[];
  records: VinylRecord[];
}

export const collection: VinylPayload = payload;
export const records: VinylRecord[] = payload.records;
export const owners: VinylOwner[] = payload.owners;

/** The owner filter, where `all` is everyone's records together. */
export type OwnerFilter = string;
export const ALL: OwnerFilter = "all";

export function isOwner(value: string | null): value is OwnerFilter {
  return value === ALL || owners.some((owner) => owner.id === value);
}

export function ownerName(id: string): string {
  return owners.find((owner) => owner.id === id)?.name ?? id;
}

export function recordsFor(owner: OwnerFilter): VinylRecord[] {
  return owner === ALL ? records : records.filter((record) => record.owner === owner);
}

/** How the shelf can be ordered. The default is what arrived most recently. */
export const SORTS = ["added", "artist", "title", "year"] as const;
export type Sort = (typeof SORTS)[number];

/**
 * Read as a whole sentence in the sort control, which shows one option at a
 * time - "Artist" alone in a box says nothing about what is being done to it.
 */
export const SORT_LABEL: Record<Sort, string> = {
  added: "Newest first",
  artist: "By artist",
  title: "By title",
  year: "By pressing year",
};

export function isSort(value: string | null): value is Sort {
  return SORTS.includes(value as Sort);
}

/**
 * Sorted for display. Every comparison falls through to artist then title, so
 * the order is total - two records that tie on the sort key never swap places
 * between renders.
 */
export function sortRecords(list: VinylRecord[], sort: Sort): VinylRecord[] {
  const byName = (a: VinylRecord, b: VinylRecord) =>
    a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);

  return [...list].sort((a, b) => {
    switch (sort) {
      case "added":
        return b.added.localeCompare(a.added) || byName(a, b);
      case "artist":
        return byName(a, b);
      case "title":
        return a.title.localeCompare(b.title) || byName(a, b);
      // An undated pressing sorts last rather than as year zero, which would
      // put it at the top of the newest-first end and read as a claim.
      case "year":
        return (b.year ?? -Infinity) - (a.year ?? -Infinity) || byName(a, b);
    }
  });
}

/** Matches a record against a typed query across the fields worth searching. */
export function matches(record: VinylRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [
    record.artist,
    record.title,
    record.label,
    record.catno,
    ...record.genres,
    ...record.styles,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export interface Tally {
  name: string;
  count: number;
}

/**
 * Discogs files every compilation and soundtrack under the artist "Various".
 * That is a database placeholder, not a band: left in, it tops the
 * collected-most board with a name nobody chose to collect, and it counts as
 * one more artist for six records that have no single artist at all.
 */
const VARIOUS = "Various";

const named = (list: VinylRecord[]) => list.filter((record) => record.artist !== VARIOUS);

/** The most common values of one field, biggest first, ties broken by name. */
function tally(list: VinylRecord[], pick: (record: VinylRecord) => string[], limit = 5): Tally[] {
  const counts = new Map<string, number>();
  for (const record of list) {
    for (const value of pick(record)) {
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return (
    [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit)
      // One of something is not a pattern, and a "most collected" board full of
      // ones says nothing. Same rule the show log's repeat boards follow.
      .filter((entry) => entry.count > 1)
  );
}

export interface VinylStats {
  total: number;
  /** Distinct credited artists, not counting the "Various" placeholder. */
  artists: number;
  labels: number;
  /** Records whose wax is not black. */
  colored: number;
  /** How many discs are on the shelf - a 2×LP is one record but two slabs. */
  discs: number;
  /** The ends of the pressing-year range present. */
  oldest: number | null;
  newest: number | null;
  addedThisYear: number;
  latest: VinylRecord | undefined;
  topArtists: Tally[];
  topLabels: Tally[];
  topStyles: Tally[];
}

export function statsFor(list: VinylRecord[]): VinylStats {
  const years = list
    .map((record) => record.year)
    .filter((year): year is number => year != null && year > 1900);

  const thisYear = new Date().getUTCFullYear();

  return {
    total: list.length,
    artists: new Set(named(list).map((record) => record.artist)).size,
    labels: new Set(list.map((record) => record.label).filter(Boolean)).size,
    colored: list.filter((record) => record.variant).length,
    // "2×LP" means two slabs in the sleeve; anything else counts as one.
    discs: list.reduce((sum, record) => sum + (Number(/^(\d+)×/.exec(record.format)?.[1]) || 1), 0),
    oldest: years.length ? Math.min(...years) : null,
    newest: years.length ? Math.max(...years) : null,
    addedThisYear: list.filter((record) => record.added.startsWith(String(thisYear))).length,
    // The list arrives newest-first from the build, but a caller may have
    // sorted it, so this reads the dates rather than trusting position.
    latest: [...list].sort((a, b) => b.added.localeCompare(a.added))[0],
    topArtists: tally(named(list), (record) => [record.artist]),
    topLabels: tally(list, (record) => [record.label]),
    topStyles: tally(list, (record) => record.styles),
  };
}

/** "Aug 6, 2026" from the payload's `YYYY-MM-DD`, formatted in UTC like the footer. */
export function formatFetched(date: string): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return "";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}
