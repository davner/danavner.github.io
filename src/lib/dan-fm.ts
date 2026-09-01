import { danFm as payload } from "virtual:dan-fm";

import { SITE_TIME_ZONE } from "./site";

/**
 * A track named on a row - the one worth keeping, or the one worth skipping.
 *
 * Both halves are optional in the sheet and both are recorded empty rather than
 * absent: an album can be worth hearing without a favourite standing out, and
 * `id` stays "" for a name that matched nothing on the release.
 */
export interface Track {
  name: string;
  id: string;
}

/**
 * One day's album, as the log records it. Read from a published sheet by the
 * scheduled job and validated at build time, so everything here is already the
 * right shape by the time the app sees it.
 */
export interface Album {
  /** `YYYY-MM-DD`, the day it was listened to. The log's key, one per day. */
  date: string;
  /** `<date>-<artist>-<album>`, and the album's address. */
  slug: string;
  /**
   * Which day of the log this is, counting from the oldest entry. Derived from
   * position at build time, not carried in the file, so it cannot go stale -
   * and it is not the sheet's own streak column, which counts something else.
   */
  ordinal: number;
  artist: string;
  album: string;
  /** `null` when neither the log nor Spotify could say. */
  year: number | null;
  /**
   * The year names this pressing rather than the release, because it came from
   * Spotify after the log left it blank. The page says so instead of printing a
   * reissue date as though it were the original.
   */
  yearIsPressing: boolean;
  genre: string;
  /** How it was found - free text, deliberately not a fixed vocabulary. */
  source: string;
  /** Who recommended it. "" when it was my own pick. */
  from: string;
  /** 1 to 5 in half steps. */
  score: number;
  /** Where it ended up afterwards, as typed - free text, like `source`. */
  shelf: string;
  standout: Track;
  skip: Track;
  /** The written review. May be empty; not every album gets a sentence. */
  take: string;
  /** Up to three, blanks dropped. */
  tags: string[];
  /** A second score after living with it. `null` means the first one stands. */
  later: number | null;
  /** Base-62 Spotify album id, "" when the row carried no link. */
  spotifyId: string;
  url: string;
  /** Path under `public/`, or "" when no art was saved. */
  cover: string;
}

export interface DanFmPayload {
  /** The published sheet, for the source line under the page. */
  url: string;
  /** `YYYY-MM-DD` in UTC, when the job last read the sheet. */
  fetched: string;
  /** Newest first. Empty before the first fetch, which is a valid log. */
  albums: Album[];
}

export const log: DanFmPayload = payload;
export const albums: Album[] = payload.albums;

const STATION_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The station's current day as `YYYY-MM-DD`, comparable against `Album.date`. */
export function stationDate(now: Date = new Date()): string {
  return STATION_DAY.format(now);
}

/** What is playing, or nothing when today has not been logged yet. */
export function todaysAlbum(now?: Date): Album | undefined {
  const today = stationDate(now);
  return albums.find((entry) => entry.date === today);
}

/**
 * What an album has to score to make the mixtape: one I liked, not one I
 * tolerated, at a bar low enough that the tape fills.
 */
export const MIXTAPE_SCORE = 4;

/**
 * The keepers, newest first.
 *
 * Gated on the score alone, which is the only field every row has - an entry
 * that scored well without a favourite track named still belongs on the tape,
 * and the section renders it without one.
 */
export function mixtape(list: Album[] = albums): Album[] {
  return list.filter((entry) => entry.score >= MIXTAPE_SCORE);
}

/**
 * How the log is running right now, and it is not a clock reading: what "lapsed"
 * means here is whether *yesterday* has an entry.
 *
 * Standing by is the ordinary state every morning - the day's album is logged in
 * the evening - so it is kept apart from dead air, which is the one that means
 * something.
 */
export type Lamp = "on-air" | "standing-by" | "dead-air";

export interface Station {
  lamp: Lamp;
  /** The album on the front page: today's, or the last one to air. */
  featured: Album | undefined;
  /** Whole days from the last entry to today. 0 while on air. */
  silentDays: number;
}

export function station(list: Album[] = albums, now?: Date): Station {
  const today = stationDate(now);
  // Read off the dates rather than taking the head of the list, for the reason
  // `statsFor` does: the payload is newest-first, a caller's list need not be.
  const featured = list.reduce<Album | undefined>(
    (latest, entry) => (!latest || entry.date > latest.date ? entry : latest),
    undefined,
  );
  if (!featured) return { lamp: "dead-air", featured: undefined, silentDays: 0 };

  // Clamped at zero so a date ahead of the station's day still reads as on air.
  // The job holds a future row back rather than publishing it, so this only
  // catches a payload that got past it - and dark is the wrong answer there.
  const silentDays = Math.max(daysApart(featured.date, today) ?? 0, 0);
  const lamp: Lamp = silentDays === 0 ? "on-air" : silentDays === 1 ? "standing-by" : "dead-air";

  return { lamp, featured, silentDays };
}

/**
 * How many albums the charts need before they say anything.
 *
 * Averages over a handful of records describe the handful rather than the taste,
 * and a board that swings a whole point because one album landed is a board
 * nobody should read. The empty state counts down to this rather than naming a
 * month, since the log misses days and a date would drift off the count.
 */
export const CHART_MINIMUM = 30;

export interface DanFmStats {
  /** Albums logged. */
  total: number;
  /**
   * Station days the log spans, first entry to newest inclusive. It exceeds
   * `total` the first time a day is missed, which is why both are shown: eleven
   * albums over fourteen days is a different claim from eleven over eleven.
   */
  days: number;
  first: Album | undefined;
  latest: Album | undefined;
}

const DAY = 24 * 60 * 60 * 1000;

export function statsFor(list: Album[]): DanFmStats {
  // Read off the dates rather than trusting position: the list arrives
  // newest-first from the build, but a caller may have filtered or sorted it.
  const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0];
  const latest = ordered[ordered.length - 1];

  return {
    total: list.length,
    days: first && latest ? spanInDays(first.date, latest.date) : 0,
    first,
    latest,
  };
}

/**
 * Whole days from one `YYYY-MM-DD` date to another, or null for a string that is
 * not one. Parsed at UTC midnight so the arithmetic is a subtraction rather than
 * a question about daylight saving, which cannot change how many dates are on a
 * calendar.
 *
 * Null rather than a number, so each caller states its own fallback instead of
 * inheriting a zero that reads as "the same day".
 */
function daysApart(first: string, last: string): number | null {
  const from = Date.parse(`${first}T00:00:00Z`);
  const to = Date.parse(`${last}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;

  return Math.round((to - from) / DAY);
}

/** The same distance counting both ends, which is what a span of days means. */
function spanInDays(first: string, last: string): number {
  const days = daysApart(first, last);
  return days === null ? 0 : days + 1;
}
