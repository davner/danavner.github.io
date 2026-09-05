import { longDate } from "./dates";

/**
 * How one album from the log names and describes itself: the heading, the share
 * sheet, the link preview a message app renders, and the album page's meta
 * description.
 *
 * This module imports nothing the Node build cannot resolve, and that is the
 * constraint it is written under rather than an accident: an album has to name
 * itself identically whether the build stamps the words into HTML from Node or
 * the browser reads them off the share button, so one module answers for both.
 * `./dates` is spelled relatively for exactly that reason - Vite's own config
 * gets no `@/` alias resolution, and `virtual:dan-fm` does not exist there at
 * all because the content plugin is what creates it. `tsconfig.node.json` lists
 * this file, so an aliased import fails `tsc -b` rather than the build.
 *
 * `AlbumLike` is declared structurally rather than derived from `Album` so that
 * pulling it into the Node build does not drag the app's virtual modules and
 * path aliases along. Any real `Album` satisfies it.
 */
export interface AlbumLike {
  /** `YYYY-MM-DD`, the day it was listened to rather than the day it came out. */
  date: string;
  slug: string;
  artist: string;
  album: string;
  /** `null` when neither the log nor Spotify could say. */
  year: number | null;
  genre: string;
  score: number;
  /** A second score after living with it. `null` means the first one stands. */
  later: number | null;
}

/** The top of the scale, in quarter steps from 1. */
export const MAX_SCORE = 5;

/** "Julien Baker - Little Oblivions", for a heading or a share sheet title. */
export function albumTitle(album: Pick<AlbumLike, "artist" | "album">): string {
  return `${album.artist} - ${album.album}`;
}

/**
 * "Indie rock, 2021 · 4.5 out of 5 · August 20, 2026"
 *
 * The metadata rather than the written take, even though the take is the more
 * interesting sentence: a take is optional on any row, and a description that
 * is sometimes a review and sometimes a spec line is two shapes wearing one
 * name. This one is never empty, because a date and a score always exist.
 */
export function albumSummary(album: AlbumLike): string {
  return [
    [album.genre, album.year].filter(Boolean).join(", "),
    // One number with no room for history, so it is the standing score: a
    // preview must not contradict the stars on the page it opens, and the
    // first read belongs to surfaces that can draw both. Spelled inline
    // because `standingScore` lives in `./dan-fm`, behind the virtual module
    // this file exists to avoid.
    `${album.later ?? album.score} out of ${MAX_SCORE}`,
    longDate(album.date),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Where the album is served, site-relative. */
export function albumUrl(album: Pick<AlbumLike, "slug">): string {
  return `/dan-fm/${album.slug}`;
}
