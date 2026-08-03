import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL, formatDate, type Post } from "@/lib/blog";

export function PostCard({ post, index }: { post: Post; index?: number }) {
  return (
    <article className="cut-corners group relative flex flex-col bg-background p-6 transition-colors hover:bg-card/60 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <Badge variant={post.category === "work" ? "ember" : "ion"}>
          {CATEGORY_LABEL[post.category]}
        </Badge>
        {index != null ? (
          <span className="font-mono text-xs text-muted-foreground">
            {String(index).padStart(2, "0")}
          </span>
        ) : null}
      </div>

      <h3 className="display mt-5 text-3xl text-balance transition-colors group-hover:text-ember sm:text-4xl">
        <Link to={`/writing/${post.slug}`} className="after:absolute after:inset-0">
          {post.title}
        </Link>
      </h3>

      {post.summary ? (
        <p className="mt-4 flex-1 leading-relaxed text-muted-foreground text-pretty">
          {post.summary}
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
        <time dateTime={post.date} className="readout-dim">
          {formatDate(post.date)}
        </time>
        <span className="text-ember">·</span>
        <span className="readout-dim">{post.readingTime} min</span>
        {post.draft ? (
          <>
            <span className="text-ember">·</span>
            <Badge variant="ember">Draft</Badge>
          </>
        ) : null}
        <ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember" />
      </div>
    </article>
  );
}
