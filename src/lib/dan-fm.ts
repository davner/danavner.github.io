import { danFm as payload } from "virtual:dan-fm";

import { MAX_SCORE } from "./dan-fm-summary";
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
  /** 1 to 5 in quarter steps. */
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
   *
   * The share poster is the one place it is cut rather than withheld: up to two
   * lines off the front of it under the take, marked as the excerpt they are. A
   * poster has a footer rule to stay above, and the page it links to is where
   * the rest is.
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
 * How many albums the section needs before it draws any board at all.
 *
 * Not what keeps the figures honest - each board refuses what it cannot
 * support, so an average never stands on one album and a spread never draws a
 * lone bar at full width. What is left for this gate is whether the section is
 * worth opening at all: a log this short rarely holds the spread any board
 * needs, and a grid of panels all saying "not yet" is worse than one sentence
 * admitting the same thing. A longer log can still starve every board, and
 * there each board's own sentence is the right place to say so.
 *
 * The empty state counts down to this rather than naming a month, since the log
 * misses days and a date would drift off the count.
 */
export const CHART_MINIMUM = 7;

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

/*
 * The charts.
 *
 * Four boards of bars and one line, every one of them read off the same
 * committed payload the archive filters.
 *
 * All of them count `score` and none of them counts `later`. A row can carry a
 * second score, and a board that quietly preferred it would be averaging one
 * number for those albums and a different one for the rest. What living with a
 * record did to it is printed beside the record, where both figures are shown.
 */

/**
 * How many albums a name needs behind it before a board averages them.
 *
 * One of something is not a pattern, the rule `vinyl.ts` applies to its
 * collected-most boards. An average over one album is that album rather than a
 * track record, and a single lucky 5 would otherwise top a leaderboard on it.
 */
export const RECOMMENDER_MINIMUM = 2;

/**
 * The scale's floor, `MAX_SCORE` being its top.
 *
 * The score line is drawn over the whole scale rather than over the range the
 * log happens to hold, so a day that logs a new low does not silently redraw
 * every album before it at a different height.
 */
export const MIN_SCORE = 1;

/** How many rows a ranked board draws before the tail is left to a line of text. */
const BOARD_ROWS = 8;

export interface BoardRow {
  /** What the row is filed under, spelled as the sheet spells it. */
  name: string;
  /** Albums behind it: what a share counts, and what an average is over. */
  count: number;
  /** The figure the row prints, and the length the bar is drawn to. */
  value: number;
}

/**
 * What a board's figures are, which is the whole of what differs between them.
 *
 * A `share` counts albums and draws every row against the log, so two share
 * boards side by side are read at one scale. An `average` scores them and draws
 * every row against the top of the rating scale.
 */
export type BoardKind = "share" | "average";

export interface Board {
  id: string;
  /** Names the board over its rows. */
  title: string;
  kind: BoardKind;
  /** Empty until the log has earned them, which is what `empty` is for. */
  rows: BoardRow[];
  /** The value a full-length bar stands for. */
  top: number;
  /** One line under the rows, where the board owes the reader its rule. */
  note?: string;
  /** What the board says in place of rows. */
  empty: string;
}

/** The albums under each distinct value of one field, blanks dropped. */
function groupBy(list: Album[], pick: (album: Album) => string): Map<string, Album[]> {
  const held = new Map<string, Album[]>();

  for (const album of list) {
    const key = pick(album);
    if (!key) continue;

    const group = held.get(key);
    if (group) group.push(album);
    else held.set(key, [album]);
  }

  return held;
}

/**
 * The mean of a list's scores to one decimal, or null for a list with nothing
 * to average.
 *
 * Null rather than a zero, which would be a score outside the scale printed as
 * though it were one. Trailing zeros are dropped for the reason `Rating` drops
 * them: 4, not 4.0, on a log somebody keeps by hand.
 */
function averageScore(list: Album[]): number | null {
  if (list.length === 0) return null;

  const mean = list.reduce((sum, album) => sum + album.score, 0) / list.length;
  return Number(mean.toFixed(1));
}

/**
 * What the log is made of, biggest share first.
 *
 * A board of one row is a full-width bar claiming the log is all one thing,
 * which the sentence in its place says better - the rule `facetsFor` applies to
 * a control every row answers the same way.
 */
function genreBoard(list: Album[]): Board {
  const held = [...groupBy(list, (album) => album.genre)]
    .map(([name, group]) => ({ name, count: group.length, value: group.length }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));

  const rows = held.length > 1 ? held.slice(0, BOARD_ROWS) : [];

  return {
    id: "genre",
    title: "What it is",
    kind: "share",
    rows,
    top: list.length,
    note:
      rows.length > 0 && held.length > rows.length
        ? `Top ${rows.length} of ${held.length} genres`
        : undefined,
    empty: "Not enough genres in the log to set against each other yet.",
  };
}

/** "1990s" for a year, and "" for a row that never said one. */
function decadeOf(year: number | null): string {
  return year === null ? "" : `${Math.floor(year / 10) * 10}s`;
}

/**
 * When the records came out, oldest decade first.
 *
 * Chronological rather than ranked, because a run of decades is read as a
 * timeline and ranking it would file the 1970s between the 2010s and the 1990s.
 * Sorted as strings, which is chronological order while a decade label is four
 * digits and an "s" - the same thing that makes `YYYY-MM-DD` sortable.
 *
 * Uncapped, unlike the ranked boards: the number of decades a record can come
 * from is bounded by how long records have existed.
 *
 * A row with no year is not a point in time and gets no bar. How many there are
 * is said underneath, so the bars stay readable as shares of the log without a
 * bucket that is not a decade absorbing the difference. That count answers for
 * the bars and is printed only where there are bars: with none drawn there is
 * no share for it to reconcile, and the sentence standing in for them is the
 * whole of what the board claims.
 */
function decadeBoard(list: Album[]): Board {
  const held = [...groupBy(list, (album) => decadeOf(album.year))]
    .map(([name, group]) => ({ name, count: group.length, value: group.length }))
    .sort((first, second) => first.name.localeCompare(second.name));

  const rows = held.length > 1 ? held : [];
  const undated = list.filter((album) => album.year === null).length;

  return {
    id: "decade",
    title: "When it came out",
    kind: "share",
    rows,
    top: list.length,
    note: rows.length > 0 && undated > 0 ? `${undated} with no year` : undefined,
    empty: "Not enough release years in the log to set against each other yet.",
  };
}

/** The parts of an averaging board that are not the arithmetic. */
interface AverageBoard {
  id: string;
  title: string;
  /** The field the albums are grouped by. */
  pick: (album: Album) => string;
  /**
   * What one row stands for, in the plural, for the note a cut board prints.
   * Written out rather than derived from `id`, which names the column the rows
   * are grouped by and not the things standing in them.
   */
  plural: string;
  /** What a row's albums are called on this board, in the plural. */
  counted: string;
  note: string;
  empty: string;
}

/**
 * How well one column's values scored, best first.
 *
 * One qualifying row still draws, unlike a share board: a share means nothing
 * without the shares beside it, and an average is a number on a scale the
 * reader already knows the ends of.
 */
function averageBoard(list: Album[], board: AverageBoard): Board {
  const held = [...groupBy(list, board.pick)]
    .filter(([, group]) => group.length >= RECOMMENDER_MINIMUM)
    .flatMap(([name, group]) => {
      const value = averageScore(group);
      return value === null ? [] : [{ name, count: group.length, value }];
    })
    .sort((first, second) => second.value - first.value || first.name.localeCompare(second.name));

  const rows = held.slice(0, BOARD_ROWS);

  // A cut ranking reads as the whole field, which the share boards' tail note
  // answers - and in their shape, so two boards side by side are read the same
  // way. It counts only the rows that cleared the minimum and names that bar in
  // the same breath, rather than leaving a count and a rule to be reconciled.
  const note =
    held.length > rows.length
      ? `Top ${rows.length} of ${held.length} ${board.plural} with ` +
        `${RECOMMENDER_MINIMUM} ${board.counted} or more`
      : board.note;

  return {
    id: board.id,
    title: board.title,
    kind: "average",
    rows,
    top: MAX_SCORE,
    note: rows.length > 0 ? note : undefined,
    empty: board.empty,
  };
}

export interface DanFmCharts {
  /** The log's mean score, or null for a log with nothing to average. */
  average: number | null;
  /** Every album's score, oldest first - the one board with time on an axis. */
  line: number[];
  boards: Board[];
}

/** Every board the log can support, and the ones it cannot, each saying so. */
export function chartsFor(list: Album[]): DanFmCharts {
  // Ordered off the dates rather than by reversing the payload, for the reason
  // `statsFor` reads them: newest-first is how the build writes the file, not
  // something a caller's list is bound by.
  const oldestFirst = [...list].sort((first, second) => first.date.localeCompare(second.date));

  return {
    average: averageScore(list),
    line: oldestFirst.map((album) => album.score),
    boards: [
      genreBoard(list),
      decadeBoard(list),
      averageBoard(list, {
        id: "source",
        title: "How it was found",
        pick: (album) => album.source,
        plural: "sources",
        counted: "albums",
        note: `${RECOMMENDER_MINIMUM} albums from a source before it appears.`,
        empty: `No way of finding a record has ${RECOMMENDER_MINIMUM} albums behind it yet.`,
      }),
      averageBoard(list, {
        id: "from",
        title: "Whose recommendations land",
        pick: (album) => album.from,
        plural: "names",
        counted: "recommendations",
        note: `${RECOMMENDER_MINIMUM} recommendations before a name appears.`,
        empty: `Nobody has recommended ${RECOMMENDER_MINIMUM} albums yet.`,
      }),
    ],
  };
}

/*
 * The archive's filters.
 *
 * Every vocabulary below is built from the log's own distinct values. Genre,
 * source, shelf and the tags are free text typed into a spreadsheet, so a list
 * spelled out here would go on offering last month's words and quietly stop
 * offering the ones being typed today.
 */

/**
 * What a control carries when it is not filtering.
 *
 * Not an empty string, because these are `Select` option values and Radix
 * reserves "" for "nothing is selected". Not a word either: the options beside
 * it are genres, tags, shelves and sentences typed into a spreadsheet, and one
 * of them spelling the sentinel puts two options with the same value in the
 * same control - the real one then unselectable, because choosing it reads as
 * clearing the filter. A separator character answers that by being something
 * the sheet cannot produce, and it never reaches a URL: a control set to this
 * drops its parameter instead of carrying it.
 */
export const ALL = "\u001fall";

/** The four things a row files itself under. */
export const FACET_IDS = ["genre", "tag", "source", "shelf"] as const;

export type FacetId = (typeof FACET_IDS)[number];

/**
 * Both strings a facet's control needs. Written out rather than derived,
 * because the plural of "shelf" is not the name with an "s" on it.
 */
const FACET_TEXT: Record<FacetId, { name: string; all: string }> = {
  genre: { name: "Genre", all: "All genres" },
  tag: { name: "Tag", all: "All tags" },
  source: { name: "Source", all: "All sources" },
  shelf: { name: "Shelf", all: "All shelves" },
};

/**
 * Every value an album files itself under for one facet.
 *
 * Blanks dropped. A row may leave any of these empty, and an empty cell is not
 * a value worth offering - it would arrive in the list as an option labelled
 * with nothing.
 */
function valuesOf(album: Album, facet: FacetId): string[] {
  return (facet === "tag" ? album.tags : [album[facet]]).filter(Boolean);
}

export interface FacetOption {
  value: string;
  /** Albums filed under it, out of the whole log. */
  count: number;
}

export interface Facet {
  id: FacetId;
  /** Names the control, for its accessible label. */
  name: string;
  /** The option that filters nothing out. */
  all: string;
  options: FacetOption[];
}

/**
 * Whether a control over these options can change what is listed.
 *
 * An option every album matches narrows nothing, so a control whose every
 * option does that cannot be moved to any effect. A log of one album has one
 * genre, one source and one shelf, and a bar of controls over a single row is
 * furniture.
 */
function narrows(options: readonly { count: number }[], total: number): boolean {
  return options.some((option) => option.count < total);
}

/**
 * The facets worth offering over a list, each with the values it holds.
 *
 * Options are alphabetical rather than ranked by count: a dropdown is scanned
 * for a value the reader already has in mind, and a list that reorders itself
 * as the log fills is one they have to read twice.
 */
export function facetsFor(list: Album[]): Facet[] {
  return FACET_IDS.map((id) => {
    const counts = new Map<string, number>();
    for (const album of list) {
      for (const value of valuesOf(album, id)) counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return {
      id,
      ...FACET_TEXT[id],
      options: [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((first, second) => first.value.localeCompare(second.value)),
    };
  }).filter((facet) => narrows(facet.options, list.length));
}

/** Scores are recorded in quarter steps, so one band tops out a step under the next. */
const SCORE_STEP = 0.25;

/**
 * The archive's lower cut, the middle of a 1-to-5 scale. At or above it a
 * record was worth the day it took; below it, it was not.
 */
const MIDDLING_SCORE = 3;

export interface ScoreBand {
  /** What the URL carries. */
  id: string;
  label: string;
  holds: (score: number) => boolean;
}

/**
 * The three bands the scale is read in, best first.
 *
 * The top one is the mixtape's bar rather than a figure of its own, so the two
 * surfaces cut the scale in the same place instead of at two nearby numbers a
 * reader has to reconcile. Both labels below it are written from the constants,
 * so a moved bar cannot leave a pill advertising where it used to be.
 */
const SCORE_BANDS: readonly ScoreBand[] = [
  { id: "keepers", label: `${MIXTAPE_SCORE} and up`, holds: (score) => score >= MIXTAPE_SCORE },
  {
    id: "middling",
    label: `${MIDDLING_SCORE} to ${MIXTAPE_SCORE - SCORE_STEP}`,
    holds: (score) => score >= MIDDLING_SCORE && score < MIXTAPE_SCORE,
  },
  { id: "low", label: `Under ${MIDDLING_SCORE}`, holds: (score) => score < MIDDLING_SCORE },
];

export interface BandTally extends ScoreBand {
  count: number;
}

/**
 * The bands the log actually falls into, with what each holds. Empty when every
 * album lands in one of them, for the reason `facetsFor` drops a facet.
 */
export function bandsFor(list: Album[]): BandTally[] {
  const held = SCORE_BANDS.map((band) => ({
    ...band,
    count: list.filter((album) => band.holds(album.score)).length,
  })).filter((band) => band.count > 0);

  return narrows(held, list.length) ? held : [];
}

export type FilterKey = FacetId | "score";

/** One archive control each, and the query parameter it is carried in. */
export const FILTER_KEYS: readonly FilterKey[] = [...FACET_IDS, "score"];

/** What each control is set to, `ALL` where it is not filtering. */
export type Selection = Record<FilterKey, string>;

/** Whether anything is narrowing the list. */
export function isFiltered(selection: Selection): boolean {
  return FILTER_KEYS.some((key) => selection[key] !== ALL);
}

/**
 * Everything in `list` that every set control agrees on, in the order it
 * arrived.
 *
 * A score no band names filters nothing rather than everything, which is what a
 * stale link should do: show the log, instead of an empty list with nothing on
 * the page to say why it is empty.
 */
export function filterAlbums(list: Album[], selection: Selection): Album[] {
  const band = SCORE_BANDS.find((entry) => entry.id === selection.score);

  return list.filter(
    (album) =>
      FACET_IDS.every(
        (id) => selection[id] === ALL || valuesOf(album, id).includes(selection[id]),
      ) &&
      (band === undefined || band.holds(album.score)),
  );
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
