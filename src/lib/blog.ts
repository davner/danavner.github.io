import { posts as rawPosts } from "virtual:blog";

import type { Photo } from "@/lib/photo";

export const CATEGORIES = ["work", "personal"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Post {
  slug: string;
  title: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  category: Category;
  summary: string;
  tags: string[];
  /**
   * Optional, and validated the way a show's or a trip's are. Markdown in the
   * body can embed an image inline, but nothing checks those - use this when
   * the photos are part of the post rather than an illustration in it.
   */
  photos: Photo[];
  draft: boolean;
  /** Rounded up, in minutes. */
  readingTime: number;
  /** Markdown body with the frontmatter block removed. */
  body: string;
}

/**
 * Parsed, validated, and sorted newest-first by the blog plugin in
 * `vite-plugin-blog.ts`. Drafts are present under `npm run dev` and absent
 * from production builds.
 */
export const posts: Post[] = rawPosts;

export function getPost(slug: string | undefined): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

export function postsByCategory(category: Category | "all"): Post[] {
  return category === "all" ? posts : posts.filter((post) => post.category === category);
}

export function formatDate(date: string): string {
  // Parsed as UTC noon so the displayed day never shifts by timezone.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const CATEGORY_LABEL: Record<Category, string> = {
  work: "Work",
  personal: "Personal",
};
