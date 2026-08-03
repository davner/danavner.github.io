import { shows as rawShows } from "virtual:shows";

export type ShowType = "show" | "festival";

export const MAX_RATING = 5;

export interface Show {
  slug: string;
  /** Display heading: the festival's name, or whoever topped the bill. */
  title: string;
  /** Optional qualifier under the heading, e.g. "Day 1". */
  subtitle: string;
  type: ShowType;
  /** `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  date: string;
  /** Set for multi-day festivals. Same precision rules as `date`. */
  endDate: string;
  venue: string;
  city: string;
  /**
   * Every band on the bill, top billing first. Normalised by the content
   * plugin, so for a show `lineup[0] === title` and a festival's name is never
   * in here — a festival is not a band.
   */
  lineup: string[];
  /** Out of {@link MAX_RATING} horns, partials allowed. `null` means unrated. */
  rating: number | null;
  /** Who came along. Written as `with:` in frontmatter. */
  companions: string[];
  /** Went alone, deliberately recorded rather than merely unstated. */
  solo: boolean;
  /** Full URL to a video of the night. */
  video: string;
  standout: boolean;
  /** Markdown notes about the night. */
  body: string;
}

/** Everyone below top billing — the openers, in running order. */
export function supportFor(show: Show): string[] {
  return show.type === "festival" ? show.lineup : show.lineup.slice(1);
}

/** Parsed, validated, and sorted newest-first by the content plugin. */
export const shows: Show[] = rawShows;

export interface ShowYear {
  year: string;
  shows: Show[];
}

export const showsByYear: ShowYear[] = shows.reduce<ShowYear[]>((years, show) => {
  const year = show.date.slice(0, 4);
  const bucket = years.at(-1);
  if (bucket?.year === year) bucket.shows.push(show);
  else years.push({ year, shows: [show] });
  return years;
}, []);

function mostFrequent(values: string[]): { name: string; count: number } | undefined {
  const tally = new Map<string, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);

  let best: { name: string; count: number } | undefined;
  for (const [name, count] of tally) {
    // Ties resolve alphabetically so the number never jitters between builds.
    if (!best || count > best.count || (count === best.count && name < best.name)) {
      best = { name, count };
    }
  }
  return best && best.count > 1 ? best : undefined;
}

// `lineup` already excludes festival names, so every entry here is a band.
const allBands = shows.flatMap((show) => show.lineup);

const rated = shows.filter((show) => show.rating != null);
const allCompanions = shows.flatMap((show) => show.companions);

export const showStats = {
  total: shows.length,
  bands: new Set(allBands).size,
  venues: new Set(shows.map((show) => show.venue).filter(Boolean)).size,
  cities: new Set(shows.map((show) => show.city)).size,
  festivals: shows.filter((show) => show.type === "festival").length,
  solo: shows.filter((show) => show.solo).length,
  mostSeen: mostFrequent(allBands),
  /** Averaged over rated entries only, so unrated shows do not drag it down. */
  averageRating: rated.length
    ? rated.reduce((sum, show) => sum + (show.rating ?? 0), 0) / rated.length
    : null,
  ratedCount: rated.length,
  mostSeenWith: mostFrequent(allCompanions),
  latest: shows[0] as Show | undefined,
  firstYear: shows.at(-1)?.date.slice(0, 4),
};

export const standouts = shows.filter((show) => show.standout);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats to whatever precision the entry actually has. The year is omitted
 * because the page already groups by it; a year-only entry gets no label at all.
 */
export function formatShowDate(show: Pick<Show, "date" | "endDate">): string {
  const format = (value: string) => {
    const [, month, day] = value.split("-");
    if (!month) return "";
    const name = MONTHS[Number(month) - 1] ?? "";
    return day ? `${name} ${Number(day)}` : name;
  };

  const start = format(show.date);
  if (!show.endDate || show.endDate === show.date) return start;

  const end = format(show.endDate);
  if (!start || !end) return start || end;

  // Same month: "Nov 15–16" rather than "Nov 15–Nov 16".
  const sameMonth = show.date.slice(0, 7) === show.endDate.slice(0, 7);
  return sameMonth ? `${start}–${end.split(" ").at(-1)}` : `${start} – ${end}`;
}

export function showLocation(show: Show): string {
  return [show.venue, show.city].filter(Boolean).join(", ");
}
