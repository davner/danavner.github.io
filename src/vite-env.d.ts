/// <reference types="vite/client" />

/** Last-commit date in the site's time zone, formatted like "Aug 4, 2026", injected by `define` in `vite.config.ts`. */
declare const __LAST_UPDATED__: string;

/** The imprint's epoch stamp, like "J2026.67", from the same commit timestamp as `__LAST_UPDATED__`. */
declare const __EPOCH__: string;

/** The deploy run number - `IMPRESSION` in `deploy.yml` - as a string; null on a local proof build. */
declare const __IMPRESSION__: string | null;

/** Short commit id of the pressing, from `git rev-parse`; "proof" where git is unavailable. */
declare const __COMMIT_SHA__: string;

declare module "virtual:blog" {
  import type { Post } from "@/lib/blog";

  /** Supplied by `contentPlugin()` in `vite-plugin-content.ts`. */
  export const posts: Post[];
}

declare module "virtual:shows" {
  import type { Show } from "@/lib/shows";

  /**
   * Supplied by `contentPlugin()` in `vite-plugin-content.ts`. `duo` is raw
   * frontmatter - `src/lib/shows.ts` expands it into `companions` and strips it.
   */
  export const shows: (Show & { duo: boolean })[];
}

declare module "virtual:comics" {
  import type { ComicsPayload } from "@/lib/comics";

  /**
   * The comics, read from League of Comic Geeks nightly and validated at build
   * time. Supplied by `contentPlugin()` in `vite-plugin-content.ts`.
   */
  export const comics: ComicsPayload;
}

declare module "virtual:fortnite" {
  import type { FortnitePayload } from "@/lib/fortnite";

  /**
   * The Fortnite stats, read from Fortnite-API nightly and validated at build
   * time. Supplied by `contentPlugin()` in `vite-plugin-content.ts`.
   */
  export const fortnite: FortnitePayload;
}

declare module "virtual:now" {
  import type { Now } from "@/lib/now";

  /** Supplied by `contentPlugin()` in `vite-plugin-content.ts`. */
  export const now: Now;
}

declare module "virtual:vinyl" {
  import type { VinylPayload } from "@/lib/vinyl";

  /**
   * The record collection, read from Discogs nightly and validated at build
   * time. Supplied by `contentPlugin()` in `vite-plugin-content.ts`.
   */
  export const vinyl: VinylPayload;
}

declare module "virtual:dan-fm" {
  import type { DanFmPayload } from "@/lib/dan-fm";

  /**
   * The album log, read from a published sheet and validated at build time.
   * Supplied by `contentPlugin()` in `vite-plugin-content.ts`.
   */
  export const danFm: DanFmPayload;
}
