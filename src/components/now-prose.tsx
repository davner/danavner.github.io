import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A now entry's body, rendered.
 *
 * Shared by the current entry and every archived one so they cannot drift into
 * looking like two different kinds of writing - they are the same writing, one
 * of them just older.
 *
 * No syntax highlighting here, unlike a blog post. A now entry is prose about a
 * few weeks of life; carrying a highlighter into this route to cover the case
 * where one contains a code block would cost more than the case is worth.
 */
export function NowProse({ body }: { body: string }) {
  return (
    <div className="prose-dan">
      <Markdown
        remarkPlugins={[remarkGfm]}
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
        {body}
      </Markdown>
    </div>
  );
}
