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

  /** Supplied by `contentPlugin()` in `vite-plugin-content.ts`. */
  export const shows: Show[];
}

declare module "virtual:vinyl" {
  import type { VinylPayload } from "@/lib/vinyl";

  /**
   * The record collection, read from Discogs nightly and validated at build
   * time. Supplied by `contentPlugin()` in `vite-plugin-content.ts`.
   */
  export const vinyl: VinylPayload;
}
