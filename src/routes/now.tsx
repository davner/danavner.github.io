import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PageHeader, PageShell } from "@/components/page";
import { formatDate } from "@/lib/blog";
import { describeStaleness, now, stalenessInDays } from "@/lib/now";
import { useDocumentMeta } from "@/lib/use-document-meta";

const TITLE = "Now";
const DESCRIPTION = "What I'm doing at the moment, updated whenever it stops being true.";

/*
 * Deliberately the one page on the site nothing generates.
 *
 * Shows, records, and the blog are all either validated markdown or a nightly
 * fetch. This is a paragraph a person writes, which is the entire premise of a
 * now page - see https://nownownow.com. Automating it would leave a page that
 * updates constantly and says nothing.
 *
 * The date is not decoration. A now page with no date on it is an about page,
 * and the reader cannot tell whether "at the moment" means this week or two
 * years ago. So the staleness is spelled out in words next to it.
 */
export function Now() {
  useDocumentMeta(TITLE, DESCRIPTION);

  const days = stalenessInDays(now.updated);

  if (!now.body) {
    return (
      <PageShell>
        <PageHeader
          title={TITLE}
          lede="There is no now page yet. Once `src/content/now.md` has something in it, it lands here."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={TITLE}
        lede={
          <>
            What I'm up to at the moment, in the sense meant by{" "}
            <a
              href="https://nownownow.com/about"
              target="_blank"
              rel="noreferrer noopener"
              className="text-ember underline underline-offset-4"
            >
              nownownow.com
            </a>
            . Not a blog, not an archive. It goes out of date, and then I fix it.
          </>
        }
      />

      <div className="max-w-2xl">
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
            {now.body}
          </Markdown>
        </div>

        <div className="rule-ticks my-10" />

        {/* `time` rather than a bare string: the machine-readable date is the
            part a feed reader or a search engine can use. */}
        <p className="readout-dim">
          Last updated{" "}
          <time dateTime={now.updated}>{formatDate(now.updated)}</time>
          {days === null ? null : <> - {describeStaleness(days)}</>}
        </p>
      </div>
    </PageShell>
  );
}
