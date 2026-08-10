import { fortnite as rawFortnite } from "virtual:fortnite";

/** One playlist's numbers, for one time window. */
export interface ModeStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  /** Kills per death, as the API computes it. */
  kd: number;
  /** Percent, 0-100. */
  winRate: number;
  killsPerMatch: number;
  /*
   * Placement tiers. A playlist only counts the two that suit its team size -
   * 100 players solo counts top 10 and top 25, 50 duos count top 5 and top 12,
   * 25 squads count top 3 and top 6 - and reports a flat 0 for the rest. See
   * `placements`.
   */
  top3: number;
  top5: number;
  top6: number;
  top10: number;
  top12: number;
  top25: number;
  minutesPlayed: number;
  score: number;
  playersOutlived: number;
}

/**
 * Every playlist for one time window. `overall` is always there; the rest are
 * null when that playlist has no matches, which the page draws as "not played"
 * rather than as a row of zeroes.
 */
export interface Snapshot {
  overall: ModeStats;
  solo: ModeStats | null;
  duo: ModeStats | null;
  trio: ModeStats | null;
  squad: ModeStats | null;
}

/** The outfit worn all season, and the render downloaded for it. */
export interface Main {
  name: string;
  /** Fortnite's cosmetic id, e.g. `Character_PolishedJade_Mind`. */
  id: string;
  /** Path under `public/`, or "" when the render has not been fetched yet. */
  image: string;
  /**
   * The style worn, e.g. "Voidburn Jade". "" when it is the default look.
   *
   * Recorded rather than rendered. The tile draws the outfit's icon, which is
   * its default look, so captioning it with the style would name something the
   * picture is not showing. Kept because it is a fact about the season and
   * because `fetch-fortnite-skins.mjs` reports it when resolving an outfit.
   */
  style: string;
}

export interface SeasonEntry {
  key: string;
  /** "Chapter 6". */
  chapter: string;
  /** "Season 1", or "Mini Season 1". */
  season: string;
  /** The season's own name, e.g. "Hunters". */
  name: string;
  /** "Chapter 6 Season 1". */
  label: string;
  /** ISO date the season began. */
  start: string;
  /** ISO date the *next* season began, so ranges meet rather than overlap. */
  end: string;
  main: Main | null;
  /** ISO date these numbers start from - see `coverage`. "" when unplayed. */
  first: string;
  /** ISO date of the last successful read. */
  fetched: string;
  /** `epic` for a backfilled season, `fortnite-api` for a recorded one. */
  source: string;
  /** Null for a season with no numbers on file. */
  stats: Snapshot | null;
}

export interface FortnitePayload {
  name: string;
  accountId: string;
  fetched: string;
  lifetime: Snapshot | null;
  seasons: SeasonEntry[];
}

/**
 * Read from `src/content/fortnite.json` and validated at build time by
 * `vite-plugin-content.ts`. A null `lifetime` means the fetch has never run,
 * and the page says so rather than rendering an empty board.
 */
export const fortnite: FortnitePayload = rawFortnite;

export const MODES = [
  { id: "overall", label: "All modes" },
  { id: "solo", label: "Solo" },
  { id: "duo", label: "Duo" },
  { id: "trio", label: "Trio" },
  { id: "squad", label: "Squad" },
] as const;

export type ModeId = (typeof MODES)[number]["id"];

/** The window keys the page tabs by: lifetime, then each season, newest first. */
export const LIFETIME = "lifetime";

export interface Window {
  key: string;
  label: string;
  /** Null for a season with no numbers on file. */
  stats: Snapshot | null;
  /** Null for lifetime, which is not a season and needs no caveat. */
  season: SeasonEntry | null;
}

/**
 * Every window worth a tab, in the order they are shown.
 *
 * Lifetime leads because it is the only one that is complete by definition - it
 * is the number the API keeps whatever happens to a season. The seasons follow
 * newest first, straight from the calendar.
 *
 * Seasons with no numbers get a tab too. One with only a name, a run of dates
 * and the outfit worn through it is still a season that was played, and hiding
 * it would make the history look shorter than it was.
 */
export const windows: Window[] = [
  ...(fortnite.lifetime
    ? [
        {
          key: LIFETIME,
          label: "Lifetime",
          stats: fortnite.lifetime,
          season: null,
        },
      ]
    : []),
  ...fortnite.seasons.map((season) => ({
    key: season.key,
    label: season.label,
    stats: season.stats,
    season,
  })),
];

/** The calendar, newest first. */
export const seasons: SeasonEntry[] = fortnite.seasons;

export function isWindowKey(value: string | null): boolean {
  return value !== null && windows.some((window) => window.key === value);
}

/**
 * The two placement tiers worth showing for a playlist, and what to call them.
 *
 * Every playlist ends when one team is left, so "top 10" is only a thing in a
 * lobby of 100 individuals. Duos play 50 teams and count top 5 and top 12;
 * squads play 25 and count top 3 and top 6. Epic tracks each playlist's own
 * pair and returns a flat 0 for the others, so a board hardcoded to top 10 and
 * top 25 told a squad player they had never once placed - the number was real
 * and the question was wrong.
 *
 * `overall` gets none. A top 3 in squads and a top 10 in solos are different
 * achievements, and adding them together produces a figure that answers no
 * question anyone has.
 */
export function placements(mode: ModeId): { label: string; field: keyof ModeStats }[] {
  switch (mode) {
    case "solo":
      return [
        { label: "Top 10", field: "top10" },
        { label: "Top 25", field: "top25" },
      ];
    case "duo":
      return [
        { label: "Top 5", field: "top5" },
        { label: "Top 12", field: "top12" },
      ];
    case "trio":
    case "squad":
      return [
        { label: "Top 3", field: "top3" },
        { label: "Top 6", field: "top6" },
      ];
    default:
      return [];
  }
}

/** Only the playlists actually played in this window, so no tab leads nowhere. */
export function playedModes(stats: Snapshot) {
  return MODES.filter((mode) => stats[mode.id] !== null);
}

/** `1,234`. Every counter on the page is a whole number of something. */
export function count(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/**
 * Minutes as the longest unit that still reads as a quantity. Past a few days
 * "14,integer minutes" stops meaning anything, and past a couple of weeks so
 * does the hours figure.
 */
export function playtime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;

  return `${Math.round(hours).toLocaleString("en-US")}h`;
}

/**
 * How much of a season these numbers actually cover.
 *
 * The stats endpoint only answers for the season running right now, so a season
 * this site started watching late is missing its opening weeks and there is no
 * way to go back for them. Saying "from 12 August" is the honest version of a
 * number that would otherwise read as the whole season.
 */
export function coverage(season: SeasonEntry): string | null {
  if (!season.first || !season.start || season.first <= season.start) return null;

  const from = new Date(`${season.first}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `Tracked from ${from}, not the season's first day`;
}

/** "Dec 1, 2024 - Feb 21, 2025". A season's run, as every season table writes it. */
export function dateRange(season: SeasonEntry): string {
  const day = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return `${day(season.start)} - ${day(season.end)}`;
}

/**
 * How a season's figure sits against the lifetime one.
 *
 * The point of the season tabs is the comparison - a 42% win rate means nothing
 * on its own and a great deal next to a lifetime 27%. `direction` is which way
 * the difference goes and not whether it is good news; every figure this is
 * used on happens to be one where up is better, but that is the caller's fact
 * to know rather than this function's to assume.
 */
export interface Delta {
  text: string;
  direction: "up" | "down" | "level";
}

export function delta(value: number, against: number, digits: number, suffix = ""): Delta {
  const difference = value - against;

  // Rounded before it is compared, so a difference too small to print does not
  // render as "+0.00" with an arrow claiming it moved.
  const shown = Number(difference.toFixed(digits));
  if (shown === 0) return { text: `level with lifetime`, direction: "level" };

  const sign = shown > 0 ? "+" : "-";
  return {
    text: `${sign}${Math.abs(shown).toFixed(digits)}${suffix} vs lifetime`,
    direction: shown > 0 ? "up" : "down",
  };
}

/** "August 10, 2026" - the same sign-off the record and comic pages use. */
export function formatFetched(date: string): string {
  if (!date) return "";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
