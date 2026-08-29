import { ArrowLeft, ArrowRight } from "lucide-react";
import { Suspense, lazy } from "react";
import Markdown from "react-markdown";
import { Link, useParams } from "react-router";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { FactLine } from "@/components/fact-line";
import { PageHeader, PageShell } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL, formatDate, getPost, posts } from "@/lib/blog";
import { useDocumentMeta } from "@/lib/use-document-meta";
import { NotFound } from "@/routes/not-found";

// Most posts are words only, and the carousel is ~24kB of embla that they would
// otherwise all pay for. Loaded on demand so only a post with photos fetches it.
const PhotoCarousel = lazy(() =>
  import("@/components/photo-carousel").then((module) => ({ default: module.PhotoCarousel })),
);

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
        {/* A post title is a phrase, so it takes the long step - and the header
            block itself is the shared one, so a post's title, lede and meta sit
            at the same measurements as every other page's. */}
        <PageHeader title={post.title} size="long" lede={post.summary}>
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

          {post.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {post.tags.map((tag) => (
                <li key={tag} className="readout-dim">
                  #{tag}
                </li>
              ))}
            </ul>
          ) : null}
        </PageHeader>

        <div className="rule-ticks mb-10" />

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
              // `node` is the mdast node react-markdown hands every override.
              // Dropped here so the spread cannot land it on the element.
              pre: ({ node, children, ...props }) => (
                <pre tabIndex={0} {...props}>
                  {children}
                </pre>
              ),
              a: ({ node, href, children, ...props }) => {
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

        {/* Below the writing rather than inside it. A post's photos are the
            same carousel a show gets, so they carry captions and alt
            text the build has already checked. */}
        {post.photos.length > 0 ? (
          <Suspense fallback={null}>
            <div className="mt-12">
              <PhotoCarousel photos={post.photos} label={post.title} />
            </div>
          </Suspense>
        ) : null}
      </article>

      {newer || older ? (
        /* Seams per cell rather than a `bg-border` behind the grid. The newest
           post has only an older link, and a grid is as wide as its columns
           whether or not anything is in them, so a seam colour behind it paints
           a grey block in the column the newer link would fill. A 1px spread
           shadow takes no layout space, so with `gap-px` each link's shadow
           lands on the exact pixel its neighbour's does. Same idiom as the
           record shelf and the season grid. */
        <nav aria-label="More posts" className="mt-20 grid gap-px sm:grid-cols-2">
          {older ? (
            <Link
              to={`/blog/${older.slug}`}
              className="group bg-background p-6 shadow-[0_0_0_1px_var(--color-border)] transition-colors hover:bg-card/60 sm:p-8"
            >
              <span className="readout-dim flex items-center gap-2">
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                Older
              </span>
              <span className="display mt-3 block text-xl text-balance transition-colors group-hover:text-ember">
                {older.title}
              </span>
            </Link>
          ) : null}

          {newer ? (
            <Link
              to={`/blog/${newer.slug}`}
              className="group bg-background p-6 text-right shadow-[0_0_0_1px_var(--color-border)] transition-colors hover:bg-card/60 sm:col-start-2 sm:p-8"
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
