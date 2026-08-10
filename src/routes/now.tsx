import { NowProse } from "@/components/now-prose";
import { NowTimeline } from "@/components/now-timeline";
import { PageHeader, PageShell } from "@/components/page";
import { formatDate } from "@/lib/blog";
import { describeStaleness, now, stalenessInDays } from "@/lib/now";
import { useDocumentMeta } from "@/lib/use-document-meta";

const TITLE = "Now";
const DESCRIPTION = "What I'm doing at the moment, updated whenever it stops being true.";

/*
 * Deliberately the one page on the site nothing generates.
 *
 * Shows, records, comics and the blog are all either validated markdown or a
 * nightly fetch. This is a paragraph a person writes, which is the entire
 * premise of a now page - see https://nownownow.com. Automating the writing
 * would leave a page that updates constantly and says nothing.
 *
 * What is automated is the keeping. Editing `src/content/now.md` with a new
 * `updated` date archives the old text on push, so writing a new now stays one
 * file and one commit while nothing written before it is lost.
 *
 * The date is not decoration. A now page with no date on it is an about page,
 * and the reader cannot tell whether "at the moment" means this week or two
 * years ago. So the staleness is spelled out in words next to it.
 */
export function Now() {
  useDocumentMeta(TITLE, DESCRIPTION);

  const { current, archive } = now;
  const days = stalenessInDays(current.updated);

  if (!current.body) {
    return (
      <PageShell>
        {/* Reader-facing, because this is a live page whenever `now.md` is
            absent - not only a state the build passes through. Naming the file
            here told a visitor about a path they cannot do anything with. */}
        <PageHeader
          title={TITLE}
          lede="Nothing here at the moment. I have not written one of these yet."
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
        <NowProse body={current.body} />

        {/* `time` rather than a bare string: the machine-readable date is the
            part a feed reader or a search engine can use. */}
        <p className="readout-dim mt-8">
          Last updated <time dateTime={current.updated}>{formatDate(current.updated)}</time>
          {days === null ? null : <> - {describeStaleness(days)}</>}
        </p>

        {archive.length > 0 ? (
          <section aria-labelledby="before" className="mt-24">
            <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-3">
              <h2 id="before" className="display text-2xl sm:text-3xl">
                Before this
              </h2>
              <p className="readout-dim shrink-0">
                {archive.length} {archive.length === 1 ? "entry" : "entries"}
              </p>
            </div>

            <NowTimeline entries={archive} current={current} />
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
