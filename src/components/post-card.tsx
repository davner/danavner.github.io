import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL, formatDate, type Post } from "@/lib/blog";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="group relative rounded-xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/40 hover:bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <Badge variant={post.category === "work" ? "default" : "secondary"}>
          {CATEGORY_LABEL[post.category]}
        </Badge>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {post.readingTime} min
        </span>
        {post.draft ? (
          <Badge variant="outline" className="border-dashed">
            Draft
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance">
        <Link to={`/writing/${post.slug}`} className="after:absolute after:inset-0">
          {post.title}
        </Link>
      </h3>

      {post.summary ? (
        <p className="mt-2 leading-relaxed text-muted-foreground text-pretty">{post.summary}</p>
      ) : null}

      <p className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
        Read
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </p>
    </article>
  );
}
