import { ArrowUpRight, BookOpen } from "lucide-react";
import { useSearchParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { FilterStatus } from "@/components/filter-status";
import { FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import { ScrollingText } from "@/components/scrolling-text";
import { SourceLine } from "@/components/source-line";
import { comics, issueCount, SHELVES, type ComicEntry, type ShelfId } from "@/lib/comics";
import { coverSrcSet } from "@/lib/covers";
import { catalogueLine, PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

/*
 * The tab, the nav, and the HTML the build serves a crawler all say "Comics" -
 * one entry in `lib/routes.ts` feeds all three, and it is the word someone
 * scans a list of links for. The headline is free to be the line.
 */
const META = PAGE_META["/comics"];

/** Solid, then outlined, the way every page title on the site is set. */
const HEADING = (
  <>
    <span className="block">With great power</span>
    <span className="display-outline-ember block">comes great responsibility</span>
  </>
);

const SHELF_IDS = SHELVES.map((entry) => entry.id);

function isShelf(value: string | null): value is ShelfId {
  return value !== null && (SHELF_IDS as readonly string[]).includes(value);
}

/**
 * League of Comic Geeks writes an open-ended run as "2026 - Present". "Now"
 * says the same thing in four fewer characters, which is the difference between
 * fitting a tile on a 320px phone and clipping to "2026 - PRESE…".
 *
 * Done here rather than in the fetch so `comics.json` keeps saying what the
 * source said, and this stays a wording choice rather than a data edit.
 */
function shortenYears(years: string): string {
  return years.replace(/\bpresent\b/i, "Now");
}

/** "Aug 5, 2026" - short enough to sit in a tile without wrapping. */
function formatReleased(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * How wide a cover is laid out, so the browser can choose between the two
 * candidates in `srcSet` before there is any layout to measure. Kept beside the
 * grid classes below, which are what it describes.
 *
 * The fixed clause is the one that earns the string. Past 1152px `max-w-6xl`
 * stops the page growing, so a tile stops at the 220px five columns leave it
 * inside the shell's `sm:px-6` and four `gap-px` seams. Written as `20vw`
 * instead, a 1440px desktop asks for 288px, skips the 250w cover and fetches
 * the full one.
 *
 * The `vw` clauses round up, never down. Asking for a few px too many costs a
 * few bytes at the top of a breakpoint; asking for too few picks a candidate
 * that cannot fill the tile and ships it blurred.
 */
const COVER_SIZES =
  "(min-width: 1152px) 220px, (min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw";

/**
 * One cover in the grid. The whole tile is the link and it goes to League of
 * Comic Geeks, for the same reason a record sleeve goes to Discogs - there is no
 * page of our own to send it to, and inventing one would put a click in front of
 * what the tile already says.
 */
function ComicTile({ entry }: { entry: ComicEntry }) {
  /*
   * Three short lines rather than one joined one. "DC COMICS · 2024 - Present"
   * did not fit a tile at any breakpoint and truncated to "DC COMICS · 2024 -
   * PR…", which loses the half that varies. Split, each line fits whole.
   *
   * The publisher takes the ember the record sleeves give their wax colour, for
   * the same reason: it is the one field you scan a shelf by.
   */
  const held = entry.issues ? `${entry.issues} ${entry.issues === 1 ? "issue" : "issues"}` : "";

  /*
   * A run reads "when did it run, how deep does it go"; a single issue reads
   * "what did it cost, when did it land". One line each, because joining even
   * two of them re-introduced the truncation: "2024 - Present · 6 issues" clips
   * to "2024 - PRESENT · 6 IS…" in a tile this wide, and the issue count is the
   * half that gets eaten.
   */
  const lines = entry.price
    ? [entry.price, entry.released ? formatReleased(entry.released) : ""]
    : [shortenYears(entry.years), held];

  return (
    <li
      data-slot="comic"
      /*
       * The seam, drawn per tile rather than by the grid behind it. A 1px spread
       * shadow takes no layout space, so with the grid's `gap-px` a tile's
       * shadow lands on the exact pixel its neighbour's does - one hairline
       * between them, and nothing painted where there is no tile. Painting the
       * container instead works only while the last row happens to be full: a
       * part-filled row leaves empty cells, which render as a solid grey block.
       * Same fix as the filter pills.
       */
      className="group relative flex flex-col bg-background shadow-[0_0_0_1px_var(--color-border)]"
    >
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col"
      >
        {entry.cover ? (
          <img
            src={entry.cover}
            srcSet={coverSrcSet(entry.cover) ?? undefined}
            sizes={COVER_SIZES}
            /* Decoration for a tile that names the comic in text directly
               beneath it - describing it again would make a screen reader read
               every entry twice. */
            alt=""
            width={400}
            height={600}
            loading="lazy"
            decoding="async"
            className="aspect-2/3 w-full object-cover transition-opacity group-hover:opacity-80"
          />
        ) : (
          <div className="flex aspect-2/3 w-full items-center justify-center border-b border-border bg-card/40">
            <BookOpen className="size-6 text-muted-foreground" aria-hidden />
          </div>
        )}

        {/* Tighter padding below `sm`. The readout face carries 0.18em of
            tracking, so a 14-character publisher like "IDW Publishing" spends
            ~27px on letter-spacing alone and clipped inside `p-4` on a 320px
            phone. Buying back 8px of line fits it without touching the type. */}
        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <h3 className="leading-snug font-medium text-pretty transition-colors group-hover:text-ember">
            {entry.name}
            <ArrowUpRight className="ml-1 inline size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </h3>

          {/* `mt-auto` pins this to the bottom so it lines up across a row
              whether the title above ran to one line or three. */}
          <div className="mt-auto pt-3">
            {entry.publisher ? (
              <ScrollingText className="readout-dim mb-1.5 text-ember">
                {entry.publisher}
              </ScrollingText>
            ) : null}
            {lines.filter(Boolean).map((line) => (
              <ScrollingText key={line} className="readout-dim">
                {line}
              </ScrollingText>
            ))}
          </div>
        </div>
      </a>
    </li>
  );
}

export function Comics() {
  useDocumentMeta(META.title, META.description);

  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("shelf");
  const active: ShelfId = isShelf(raw) ? raw : "series";

  function update(next: ShelfId) {
    const params = new URLSearchParams(searchParams);
    // The default shelf is the bare URL rather than `?shelf=series`, so the
    // page has one address instead of two that render the same thing.
    if (next === "series") params.delete("shelf");
    else params.set("shelf", next);
    setSearchParams(params, { replace: true });
  }

  const shown = comics[active];
  const shelf = SHELVES.find((entry) => entry.id === active)!;

  const publishers = comics.publishers;
  const issues = issueCount(comics.series);

  if (comics.series.length === 0 && comics.pullList.length === 0 && comics.wants.length === 0) {
    return (
      <PageShell>
        <PageHeader
          catalogue={catalogueLine("/comics")}
          title={HEADING}
          size="long"
          lede="The shelf has not been read yet. Once the nightly League of Comic Geeks job runs, it lands here."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        catalogue={catalogueLine("/comics")}
        title={HEADING}
        size="long"
        lede="New comic day is Wednesday. This is every run on the shelf, what is waiting at the shop this week, and what I have not talked myself into yet."
      >
        <FilterToggle
          label="Which comics to show"
          className="mt-8"
          value={active}
          onChange={update}
          options={SHELVES.map((entry) => ({
            value: entry.id,
            label: entry.label,
            count: comics[entry.id].length,
          }))}
        />
      </PageHeader>

      {/* The collection's shape, stated once. These describe the shelf rather
          than the current filter, so they do not move when the filter does -
          the same reason the record page keeps its stats above the toggle. */}
      {publishers.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          <Stat label="Runs" value={String(comics.series.length)} />
          <Stat label="Issues held" value={issues > 0 ? String(issues) : "-"} />
          <Stat label="Publishers" value={String(publishers.length)} />
          <Stat label="Most of" value={publishers[0].name} />
        </dl>
      ) : null}

      {/* Outside the shelf's own emptiness check on purpose: a live region that
          appears at the same moment as its content is never announced, so this
          has to be on the page before the shelf changes under it. */}
      <FilterStatus message={`${shown.length} comics on the ${shelf.label} shelf`} />

      <section aria-labelledby="shelf-list">
        {/* The shelf's own label, so the outline says which of the lists is on
            screen. Every tile below is an `h3`, and without this the page is a
            title and then a run of comic names, with nothing in between to say
            what they are. */}
        <h2 id="shelf-list" className="sr-only">
          {shelf.label}
        </h2>

        <p className="readout-dim mt-8">{shelf.note}</p>

        {shown.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((entry) => (
              <ComicTile key={entry.key} entry={entry} />
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-4">
            {active === "pullList"
              ? "Nothing pulled this week."
              : "Nothing on this list right now."}
          </EmptyState>
        )}

        <SourceLine
          count={`${shown.length} shown`}
          href={comics.url}
          source="League of Comic Geeks"
          fetched={comics.fetched}
        />
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5 sm:p-6">
      <dt className="readout-dim">{label}</dt>
      <dd className="display mt-2 text-heading text-pretty">{value}</dd>
    </div>
  );
}
