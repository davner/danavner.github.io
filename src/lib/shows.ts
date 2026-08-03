import { shows as rawShows } from "virtual:shows";

export type ShowType = "show" | "festival";

export interface Show {
  slug: string;
  title: string;
  type: ShowType;
  /** `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  date: string;
  /** Set for multi-day festivals. Same precision rules as `date`. */
  endDate: string;
  venue: string;
  city: string;
  /** Who played, in running order. Openers count. */
  lineup: string[];
  /** Full URL to a video of the night. */
  video: string;
  standout: boolean;
  /** Markdown notes about the night. */
  body: string;
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

/**
 * A festival's title is the event, not a band, so only its lineup counts toward
 * "bands seen". A regular show's headliner does.
 */
function everyBand(show: Show): string[] {
  return show.type === "festival" ? show.lineup : [show.title, ...show.lineup];
}

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

const allBands = shows.flatMap(everyBand);

export const showStats = {
  total: shows.length,
  bands: new Set(allBands).size,
  venues: new Set(shows.map((show) => show.venue).filter(Boolean)).size,
  cities: new Set(shows.map((show) => show.city)).size,
  festivals: shows.filter((show) => show.type === "festival").length,
  mostSeen: mostFrequent(allBands),
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
