import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import Markdown from "react-markdown";
import { Link, useParams } from "react-router";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { PageShell } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CATEGORY_LABEL, formatDate, getPost, posts } from "@/lib/blog";
import { highlightLanguages } from "@/lib/highlight-languages";
import { useDocumentMeta } from "@/lib/use-document-meta";
import { NotFound } from "@/routes/not-found";

export function WritingPost() {
  const { slug } = useParams();
  const post = getPost(slug);

  useDocumentMeta(post?.title ?? "Not found", post?.summary ?? "");

  if (!post) return <NotFound />;

  const index = posts.findIndex((entry) => entry.slug === post.slug);
  const newer = index > 0 ? posts[index - 1] : undefined;
  const older = index < posts.length - 1 ? posts[index + 1] : undefined;

  return (
    <PageShell className="max-w-3xl">
      <Link
        to={`/writing?category=${post.category}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All {CATEGORY_LABEL[post.category].toLowerCase()} posts
      </Link>

      <article className="mt-8">
        <header>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <Badge variant={post.category === "work" ? "default" : "secondary"}>
              {CATEGORY_LABEL[post.category]}
            </Badge>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {post.readingTime} min read
            </span>
            {post.draft ? (
              <Badge variant="outline" className="border-dashed">
                Draft
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {post.title}
          </h1>

          {post.summary ? (
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
              {post.summary}
            </p>
          ) : null}

          {post.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="outline" className="font-mono font-normal">
                    #{tag}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        <Separator className="my-10" />

        <div className="prose-dan">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSlug,
              [rehypeHighlight, { languages: highlightLanguages, detect: false }],
            ]}
            components={{
              a: ({ href, children, ...props }) => {
                const external = href?.startsWith("http");
                return (
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {post.body}
          </Markdown>
        </div>
      </article>

      {newer || older ? (
        <>
          <Separator className="my-14" />
          <nav aria-label="More posts" className="grid gap-4 sm:grid-cols-2">
            {older ? (
              <Link
                to={`/writing/${older.slug}`}
                className="group rounded-xl border border-border p-5 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                  Older
                </span>
                <span className="mt-2 block font-medium text-pretty">{older.title}</span>
              </Link>
            ) : (
              <span />
            )}

            {newer ? (
              <Link
                to={`/writing/${newer.slug}`}
                className="group rounded-xl border border-border p-5 text-right transition-colors hover:border-primary/40 hover:bg-card sm:col-start-2"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  Newer
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-2 block font-medium text-pretty">{newer.title}</span>
              </Link>
            ) : null}
          </nav>
        </>
      ) : null}
    </PageShell>
  );
}
