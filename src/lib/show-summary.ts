import { MONTHS } from "./dates";

/**
 * The one-line description of a show, used for the share sheet, the link
 * preview a message app renders, and the page's meta description.
 *
 * This module imports nothing the Node build cannot resolve, which is the
 * point: the build calls it from Node while writing the per-show HTML, and the
 * browser calls it from the share button. `./dates` is spelled relatively for
 * exactly that reason - Vite's own config gets no `@/` alias resolution.
 *
 * `ShowLike` is declared structurally rather than derived from `Show` so that
 * pulling it into the Node build does not drag in the app's virtual modules and
 * path aliases. Any real `Show` satisfies it.
 */
export interface ShowLike {
  title: string;
  subtitle: string;
  /** "show" or "festival". Widened to `string` for the Node side. */
  type: string;
  date: string;
  endDate: string;
  venue: string;
  city: string;
  lineup: string[];
}

/** Spells the date out to whatever precision the entry has, year included. */
export function fullShowDate(show: Pick<ShowLike, "date" | "endDate">): string {
  const parts = (value: string) => {
    const [year, month, day] = value.split("-");
    const name = month ? (MONTHS[Number(month) - 1] ?? "") : "";
    if (!name) return year;
    return day ? `${name} ${Number(day)}, ${year}` : `${name} ${year}`;
  };

  const start = parts(show.date);
  if (!show.endDate || show.endDate === show.date) return start;
  return `${start} - ${parts(show.endDate)}`;
}

/** Everyone below top billing. Mirrors `supportFor` without the module graph. */
export function support(show: ShowLike): string[] {
  return show.type === "festival" ? show.lineup : show.lineup.slice(1);
}

export function showLocationOf(show: Pick<ShowLike, "venue" | "city">): string {
  return [show.venue, show.city].filter(Boolean).join(", ");
}

/**
 * "w/ Joyce Manor, Underoath · Long Beach, CA · July 26, 2026"
 *
 * Openers first because they are the part a reader cannot guess from the title.
 */
export function showSummary(show: ShowLike): string {
  const openers = support(show);

  return [
    openers.length ? `w/ ${openers.join(", ")}` : "",
    showLocationOf(show),
    fullShowDate(show),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Underoath - Day 2", for a heading or a share sheet title. */
export function showHeading(show: Pick<ShowLike, "title" | "subtitle">): string {
  return [show.title, show.subtitle].filter(Boolean).join(" - ");
}
