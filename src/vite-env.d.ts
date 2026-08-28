/// <reference types="vite/client" />

/** Last-commit date (UTC), formatted like "Aug 4, 2026", injected by `define` in `vite.config.ts`. */
declare const __LAST_UPDATED__: string;

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
