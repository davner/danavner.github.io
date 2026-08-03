/// <reference types="vite/client" />

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
