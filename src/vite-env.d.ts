/// <reference types="vite/client" />

declare module "virtual:blog" {
  import type { Post } from "@/lib/blog";

  /** Supplied by `blogPlugin()` in `vite-plugin-blog.ts`. */
  export const posts: Post[];
}
