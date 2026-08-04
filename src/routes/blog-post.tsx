import { ArrowLeft, ArrowRight } from "lucide-react";
import Markdown from "react-markdown";
import { Link, useParams } from "react-router";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { FactLine } from "@/components/fact-line";
import { PageShell } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL, formatDate, getPost, posts } from "@/lib/blog";
import { useDocumentMeta } from "@/lib/use-document-meta";
import { NotFound } from "@/routes/not-found";

export function BlogPost() {
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
        to={`/blog?category=${post.category}`}
        className="readout group inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-ember"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        All {CATEGORY_LABEL[post.category].toLowerCase()} posts
      </Link>

      <article className="mt-10">
        <header>
          <h1 className="display text-[clamp(2.5rem,8vw,5rem)]">{post.title}</h1>

          {/* When it went up and what it costs to read, stated the same way a
              show page states its date and room. */}
          <FactLine
            items={[
              <time dateTime={post.date}>{formatDate(post.date)}</time>,
              `${post.readingTime} min read`,
            ]}
            className="mt-6"
          />

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge variant={post.category === "work" ? "ember" : "ion"}>
              {CATEGORY_LABEL[post.category]}
            </Badge>
            {post.draft ? <Badge variant="ember">Draft</Badge> : null}
          </div>

          {post.summary ? (
            <p className="mt-7 text-lg leading-relaxed text-muted-foreground text-pretty">
              {post.summary}
            </p>
          ) : null}

          {post.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {post.tags.map((tag) => (
                <li key={tag} className="readout-dim">
                  #{tag}
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        <div className="rule-ticks my-10" />

        <div className="prose-dan">
          <Markdown
            remarkPlugins={[remarkGfm]}
            // rehype-highlight defaults to lowlight's `common` set - about 37
            // languages. Narrowing it was measured and made the bundle very
            // slightly larger, so the default stays. `detect: false` keeps
            // unlabelled blocks plain rather than guessing at them.
            rehypePlugins={[rehypeSlug, [rehypeHighlight, { detect: false }]]}
            components={{
              // A code block that scrolls sideways is unreachable to a keyboard
              // unless it can take focus, which is most of them on a phone.
              pre: ({ children, ...props }) => (
                <pre tabIndex={0} {...props}>
                  {children}
                </pre>
              ),
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
        <nav
          aria-label="More posts"
          className="mt-20 grid gap-px border border-border bg-border sm:grid-cols-2"
        >
          {older ? (
            <Link
              to={`/blog/${older.slug}`}
              className="group bg-background p-6 transition-colors hover:bg-card/60"
            >
              <span className="readout-dim flex items-center gap-2">
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                Older
              </span>
              <span className="display mt-3 block text-xl text-balance transition-colors group-hover:text-ember">
                {older.title}
              </span>
            </Link>
          ) : (
            <span className="hidden bg-background sm:block" />
          )}

          {newer ? (
            <Link
              to={`/blog/${newer.slug}`}
              className="group bg-background p-6 text-right transition-colors hover:bg-card/60 sm:col-start-2"
            >
              <span className="readout-dim flex items-center justify-end gap-2">
                Newer
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="display mt-3 block text-xl text-balance transition-colors group-hover:text-ember">
                {newer.title}
              </span>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </PageShell>
  );
}
