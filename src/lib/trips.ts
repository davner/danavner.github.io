import { trips as rawTrips } from "virtual:trips";

import { profile } from "@/content/profile";
import type { Photo } from "@/lib/shows";

export type TripType = "vacation" | "family" | "work" | "tour";

export const TRIP_LABEL: Record<TripType, string> = {
  vacation: "Vacation",
  family: "Family",
  work: "Work",
  tour: "Tour",
};

export interface Trip {
  slug: string;
  /** Display heading - where the trip was, however you think of it. */
  title: string;
  type: TripType;
  /** `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  date: string;
  /** When you came home. Same precision rules as `date`. */
  endDate: string;
  /** Every place you went, in order, each written "City, Country". */
  stops: string[];
  /** The countries in `stops`, de-duplicated, in the order first visited. */
  countries: string[];
  /** The few things worth remembering. Bulleted rather than prose. */
  highlights: string[];
  /** The one thing you would tell someone about this trip. */
  oneThing: string;
  bestMeal: string;
  /** `null` means undecided, which is not the same as no. */
  wouldGoBack: boolean | null;
  /** Who came along. Written as `with:` in frontmatter. */
  companions: string[];
  solo: boolean;
  photos: Photo[];
  /** Markdown notes about the trip. */
  body: string;
}

/** Parsed, validated, and sorted newest-first by the content plugin. */
export const trips: Trip[] = rawTrips;

/**
 * Just the two of them. Matches the show log's rule so a trip with Alexis and a
 * night out with Alexis are marked the same way.
 */
export function isDuo(trip: Trip): boolean {
  return !trip.solo && trip.companions.length === 1 && trip.companions[0] === profile.partner;
}

/** "Madrid" and "Barcelona" out of "Madrid, Spain". */
export function cityOf(stop: string): string {
  return stop.split(",")[0]!.trim();
}

/** "Spain" out of "Madrid, Spain". */
export function countryOf(stop: string): string {
  return stop.split(",").at(-1)!.trim();
}

export interface TripYear {
  year: string;
  trips: Trip[];
}

export const tripsByYear: TripYear[] = trips.reduce<TripYear[]>((years, trip) => {
  const year = trip.date.slice(0, 4);
  const bucket = years.at(-1);
  if (bucket?.year === year) bucket.trips.push(trip);
  else years.push({ year, trips: [trip] });
  return years;
}, []);

/**
 * Nights away, counted only for trips precise enough to know. A trip written as
 * a bare month has no length, and guessing one would put a made-up number in a
 * total that is supposed to be a record.
 */
export function nightsAway(trip: Pick<Trip, "date" | "endDate">): number | null {
  const full = /^\d{4}-\d{2}-\d{2}$/;
  if (!full.test(trip.date) || !full.test(trip.endDate)) return null;

  const start = Date.parse(`${trip.date}T00:00:00Z`);
  const end = Date.parse(`${trip.endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return Math.round((end - start) / 86_400_000);
}

const allStops = trips.flatMap((trip) => trip.stops);
const measuredNights = trips.map(nightsAway).filter((nights): nights is number => nights != null);

export const tripStats = {
  total: trips.length,
  countries: new Set(trips.flatMap((trip) => trip.countries)).size,
  cities: new Set(allStops.map(cityOf)).size,
  stops: allStops.length,
  solo: trips.filter((trip) => trip.solo).length,
  /** Summed over trips with both ends dated, so it is a floor, not a guess. */
  nights: measuredNights.reduce((sum, nights) => sum + nights, 0),
  latest: trips[0] as Trip | undefined,
  firstYear: trips.at(-1)?.date.slice(0, 4),
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Whatever precision the entry has, with the year kept: "June 2026",
 * "June 12–20, 2026", "June – July 2026". Unlike a show, a trip is read on its
 * own as often as in a list, so the year cannot be left to the grouping.
 */
export function formatTripDate(trip: Pick<Trip, "date" | "endDate">): string {
  interface Parts {
    year: string;
    month: string;
    day: string;
  }

  const parse = (value: string): Parts => {
    const [year, month, day] = value.split("-");
    return {
      year: year ?? "",
      month: month ? (MONTHS[Number(month) - 1] ?? "") : "",
      day: day ? String(Number(day)) : "",
    };
  };

  // "June 12, 2026", "June 2026", "2026" - the comma only belongs where a day
  // sits next to a year.
  const stamp = (parts: Parts, withYear = true): string => {
    const monthDay = [parts.month, parts.day].filter(Boolean).join(" ");
    if (!withYear) return monthDay;
    if (!monthDay) return parts.year;
    return parts.day ? `${monthDay}, ${parts.year}` : `${monthDay} ${parts.year}`;
  };

  const from = parse(trip.date);
  if (!trip.endDate || trip.endDate === trip.date) return stamp(from);

  const to = parse(trip.endDate);

  // "June 12–20, 2026" - one month and one year, so each is said once.
  if (from.year === to.year && from.month === to.month) {
    if (!from.day || !to.day) return stamp(from);
    return `${from.month} ${from.day}–${to.day}, ${from.year}`;
  }

  // "June 28 – July 4, 2026", or "December 2025 – January 2026" once the year
  // changes and the start has to carry its own.
  return `${stamp(from, from.year !== to.year)} – ${stamp(to)}`;
}

/** "Spain and Portugal", "Spain, Portugal, and France". */
export function countryList(trip: Pick<Trip, "countries">): string {
  const { countries } = trip;
  if (countries.length <= 1) return countries[0] ?? "";
  if (countries.length === 2) return `${countries[0]} and ${countries[1]}`;
  return `${countries.slice(0, -1).join(", ")}, and ${countries.at(-1)}`;
}
