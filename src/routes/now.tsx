import { ArrowLeft } from "lucide-react";
import { Suspense, lazy } from "react";
import { Navigate, useParams } from "react-router";

import { Link } from "@/components/link";
import { NowProse } from "@/components/now-prose";
import { NowTimeline } from "@/components/now-timeline";
import { PageHeader, PageShell } from "@/components/page";
import { ShareNow } from "@/components/share-now";
import { formatDate } from "@/lib/blog";
import {
  archivedEntry,
  describeStaleness,
  heldLabel,
  now,
  stalenessInDays,
  type NowEntry,
} from "@/lib/now";
import { nowDate, nowSummary, nowTitle } from "@/lib/now-summary";
import { catalogueLine, PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

// Most now entries are words only, and the carousel is ~24kB of embla that they
// would otherwise all pay for. Loaded on demand, the same way `blog-post.tsx`
// does it, so only an entry with photos fetches it.
const PhotoCarousel = lazy(() =>
  import("@/components/photo-carousel").then((module) => ({ default: module.PhotoCarousel })),
);

/*
 * The tab, the nav, and the HTML the build serves a crawler all say "Now" - one
 * entry in `lib/routes.ts` feeds all three. The headline is the same word given
 * room to breathe.
 */
const META = PAGE_META["/now"];

/** Solid, then outlined, the way every page title on the site is set. */
const HEADING = (
  <>
    <span className="block">Right</span>
    <span className="display-outline-ember block">now</span>
  </>
);

/*
 * Deliberately the one page on the site nothing generates.
 *
 * Shows, records, comics and the blog are all either validated markdown or a
 * nightly fetch. This is a paragraph a person writes, which is the entire
 * premise of a now page - see https://nownownow.com. Automating the writing
 * would leave a page that updates constantly and says nothing.
 *
 * Nothing is automated about the keeping either. Every entry is a file in
 * `src/content/now/`; the newest is the page and the rest are the timeline, so
 * writing a new now is one new file and nothing written before it is lost.
 *
 * Two views, one component, because `/now` and `/now/:date` share a lazy chunk
 * and splitting them would make the redirect below suspend twice - see the
 * `Now` import in `App.tsx`.
 */
export function Now() {
  const { date } = useParams();

  if (!date) return <NowCurrent />;

  /*
   * While an entry is current its home *is* `/now`, so exactly one address ever
   * shows it - no canonical-tag machinery, because there is never a moment when
   * two URLs render the same entry. A link shared today resolves to `/now`; the
   * same link in two months resolves to the permalink, still showing the entry
   * that was shared.
   *
   * An unknown or malformed date lands here too, and goes the same way, matching
   * `/shows/:slug` falling back to `/shows`.
   */
  if (date === now.current.updated) return <Navigate to="/now" replace />;

  const found = archivedEntry(date);
  if (!found) return <Navigate to="/now" replace />;

  return <NowPermalink entry={found.entry} replacedBy={found.replacedBy} />;
}

/**
 * Whatever is current, at `/now`. The front door, and undated on purpose -
 * this address is always the newest entry, whichever one that is.
 *
 * The date is not decoration. A now page with no date on it is an about page,
 * and the reader cannot tell whether "at the moment" means this week or two
 * years ago. So the staleness is spelled out in words next to it.
 */
function NowCurrent() {
  useDocumentMeta(META.title, META.description);

  const { current, archive } = now;
  const days = stalenessInDays(current.updated);

  if (!current.body) {
    return (
      <PageShell>
        {/* Reader-facing, because this is a live page whenever the now folder
            is empty - not only a state the build passes through. Naming the
            folder here told a visitor about a path they cannot do anything
            with. */}
        <PageHeader
          catalogue={catalogueLine("/now")}
          title={HEADING}
          lede="Nothing here at the moment. I have not written one of these yet."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        catalogue={catalogueLine("/now")}
        title={HEADING}
        /*
         * The same line the meta description carries, deliberately.
         *
         * The entry already explains what a now page is and links where the idea
         * came from, so a lede that explains it again is the first sentence read
         * back in a worse voice. What is left worth saying is when it changes,
         * and that sentence had already been written for the search result.
         * Sharing the one entry in `lib/routes.ts` also means the page and its
         * link preview cannot drift into describing the page differently.
         */
        lede={META.description}
      />

      {/* The measure is the grid's first track, so the archive below can take
          the width beside it without leaving the column's flow. */}
      <div className="prose-grid">
        <NowProse body={current.body} />

        {/* The label is the formatted date because a now entry has no title -
            `PhotoCarousel` composes "Photos from August 27, 2026" out of it.
            Safe to format again here: this sits after the `!current.body`
            return above, and an entry with a body always has an `updated`. */}
        {current.photos.length > 0 ? (
          <Suspense fallback={null}>
            <PhotoCarousel photos={current.photos} label={formatDate(current.updated)} />
          </Suspense>
        ) : null}

        {/* `time` rather than a bare string: the machine-readable date is the
            part a feed reader or a search engine can use. */}
        <p className="readout-dim mt-8">
          Last updated <time dateTime={current.updated}>{formatDate(current.updated)}</time>
          {days === null ? null : <> - {describeStaleness(days)}</>}
        </p>

        {/* The permalink, not `/now` - a link shared today should still show
            this entry once something newer has replaced it. */}
        <div className="mt-5">
          <ShareNow entry={current} />
        </div>

        {archive.length > 0 ? (
          // The Section component's own stepped break, spelled here because
          // this section carries its own heading arrangement.
          <section aria-labelledby="before" className="prose-full mt-16 sm:mt-24">
            <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-3">
              <h2 id="before" className="display text-heading">
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

/**
 * One archived entry at its own address, `/now/<date>`.
 *
 * It exists so a shared link never changes meaning. Without it the only thing
 * to link to is `/now`, which shows whatever is current - so a link sent in
 * August quietly becomes a different entry in October, and the reader has no
 * way to know it happened.
 *
 * `NowPermalink`, not `NowEntry`: `lib/now.ts` already exports an interface by
 * that name, and sharing it would mean one file importing the type while
 * another imports the component.
 */
function NowPermalink({ entry, replacedBy }: { entry: NowEntry; replacedBy: NowEntry }) {
  const held = heldLabel(entry, replacedBy);

  /*
   * `nowTitle` is the one title string for this page, and the build composes the
   * emitted `<title>` from the same call - `useDocumentMeta` appends the site
   * name here, `vite-plugin-pages.ts` appends it there, both with the same
   * separator. The served HTML and the tab cannot say different things.
   */
  useDocumentMeta(nowTitle(entry), nowSummary(entry));

  return (
    <PageShell>
      <Link
        to="/now"
        className="readout group inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-ember"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        What I am doing now
      </Link>

      <div className="mt-10">
        <PageHeader
          size="long"
          title={
            <>
              <span className="block">Now</span>
              <span className="display-outline-ember block">{nowDate(entry)}</span>
            </>
          }
          /* Dated in the past tense, because that is the whole reason this page
             exists: it is what was true then, not what is true now. */
          lede={`What I was doing back then${held ? `, for the ${held} it stood` : ""}.`}
        />

        {/* The same grid as the current entry with nothing in the wide track:
            the reading measure is stated once, so the two now surfaces cannot
            drift into two column widths. */}
        <div className="prose-grid">
          <NowProse body={entry.body} />

          {entry.photos.length > 0 ? (
            <Suspense fallback={null}>
              <PhotoCarousel photos={entry.photos} label={formatDate(entry.updated)} />
            </Suspense>
          ) : null}

          <p className="readout-dim mt-8">
            Written <time dateTime={entry.updated}>{formatDate(entry.updated)}</time>
            {held ? <> - stood for {held}</> : null}
          </p>

          <div className="mt-5">
            <ShareNow entry={entry} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
