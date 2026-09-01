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
  /**
   * The long piece about the record. Every line with anything on it renders as
   * its own paragraph, so a hard return inside one thought makes two. May be
   * empty: a `take` is the sentence every album can carry, and this is the one
   * some of them earn.
   *
   * Only the album being reviewed shows it. The front page's featured card
   * renders it and a list of albums must not, because a page of them would be
   * a page of essays rather than an archive. The album's own permalink is
   * assumed to render it too, on the grounds that the permalink exists to be
   * that album's full record - decide that there rather than inheriting it.
   */
  review: string;
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

/**
 * "1998 pressing" rather than "1998" where the year came off a reissue, and ""
 * for a row that never said. Beside the type rather than in a component,
 * because both surfaces that print an album print this and neither owns it.
 */
export function yearLabel(album: Pick<Album, "year" | "yearIsPressing">): string {
  if (album.year === null) return "";
  return album.yearIsPressing ? `${album.year} pressing` : String(album.year);
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
 * Whether the station has anything on.
 *
 * Two states, over three situations: playing, gone quiet, and never started.
 * The last two are both unlit and both read "Off air", because what separates
 * them is already under the badge - the last album with the day it was heard,
 * or the panel saying nothing has been logged yet. A third label would be a
 * second copy of a distinction the page draws anyway, and the two copies would
 * have to be kept saying the same thing.
 */
export type Lamp = "on-air" | "off-air";

export interface Station {
  lamp: Lamp;
  /** The newest album in the log, and the one the front page shows. */
  featured: Album | undefined;
}

/**
 * How many station days an album keeps the lamp lit, counting the day it was
 * heard.
 *
 * Two, so a record has its own day and the whole of the next one to be followed
 * before the badge reads quiet: one logged at eleven at night would otherwise
 * go off air the next morning. Skip a day entirely and the station is dark on
 * the morning after it, which is the rule rather than a floor - it says a day
 * was missed, and it says so while the miss is still the current state.
 */
export const AIR_DAYS = 2;

/**
 * What the station has on, and whether the lamp is lit.
 *
 * Takes a clock because the lamp is a claim about now rather than about the
 * log: an album ages out of the air after `AIR_DAYS`, so a log nobody is adding
 * to reads as quiet instead of as still playing whatever was heard last.
 *
 * The featured album is the newest row whatever its age, and the page shows it
 * either way. Its date is what says how old it is, which is why an unlit badge
 * needs no second readout beside it saying the same thing in words.
 */
export function station(list: Album[] = albums, now?: Date): Station {
  // Read off the dates rather than taking the head of the list, for the reason
  // `statsFor` does: the payload is newest-first, a caller's list need not be.
  const featured = list.reduce<Album | undefined>(
    (latest, entry) => (!latest || entry.date > latest.date ? entry : latest),
    undefined,
  );

  // The oldest day still on air. Comparing it against the album as strings
  // compares the two as days, because both are `YYYY-MM-DD` and lexical order
  // is calendar order there. `asLogDate` in the content plugin is what
  // guarantees an album's half of that shape.
  const oldest = shiftDays(stationDate(now), 1 - AIR_DAYS);

  return { lamp: featured && featured.date >= oldest ? "on-air" : "off-air", featured };
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

/**
 * The `YYYY-MM-DD` day a whole number of days from another one.
 *
 * Parsed at UTC midnight for the reason `daysApart` is: this is counting dates
 * off a calendar, and no daylight-saving shift changes how many are on one. The
 * input is `stationDate`'s output, which is that shape by construction.
 */
function shiftDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** The same distance counting both ends, which is what a span of days means. */
function spanInDays(first: string, last: string): number {
  const days = daysApart(first, last);
  return days === null ? 0 : days + 1;
}
