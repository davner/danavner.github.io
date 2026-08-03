import { shows as raw, type Show } from "@/content/shows";

export type { Show };

/** Newest first. */
export const shows: Show[] = [...raw].sort((a, b) => b.date.localeCompare(a.date));

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

function everyBand(show: Show): string[] {
  return [show.headliner, ...(show.support ?? [])];
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
  venues: new Set(shows.map((show) => show.venue)).size,
  cities: new Set(shows.map((show) => show.city)).size,
  mostSeen: mostFrequent(allBands),
  latest: shows[0],
  firstYear: shows.at(-1)?.date.slice(0, 4),
};

export const standouts = shows.filter((show) => show.standout);

export function formatShowDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function showLineup(show: Show): string {
  return everyBand(show).join(" · ");
}
