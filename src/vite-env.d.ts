/// <reference types="vite/client" />

/** ISO date of the last commit, injected by `define` in `vite.config.ts`. */
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

declare module "virtual:trips" {
  import type { Trip } from "@/lib/trips";

  /** Supplied by `contentPlugin()` in `vite-plugin-content.ts`. */
  export const trips: Trip[];
}
