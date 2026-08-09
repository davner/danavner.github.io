import { ArrowUpRight, BookOpen } from "lucide-react";
import { useSearchParams } from "react-router";

import { FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import {
  comics,
  issueCount,
  publisherCounts,
  SHELVES,
  type ComicEntry,
  type ShelfId,
} from "@/lib/comics";
import { useDocumentMeta } from "@/lib/use-document-meta";

const TITLE = "Comics";
const DESCRIPTION =
  "Every run I own, what is waiting at the shop this week, and what I still want - read from League of Comic Geeks nightly.";

const SHELF_IDS = SHELVES.map((entry) => entry.id);

function isShelf(value: string | null): value is ShelfId {
  return value !== null && (SHELF_IDS as readonly string[]).includes(value);
}

/** "read 4 days ago", the same line the record collection signs off with. */
function formatFetched(date: string): string {
  if (!date) return "";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One cover in the grid. The whole tile is the link and it goes to League of
 * Comic Geeks, for the same reason a record sleeve goes to Discogs - there is no
 * page of our own to send it to, and inventing one would put a click in front of
 * what the tile already says.
 */
function ComicTile({ entry }: { entry: ComicEntry }) {
  /*
   * A series and an issue carry different facts, and each reads off the cover in
   * a different order. A run is "how much of it do you have"; a single issue is
   * "what did it cost and when did it land".
   */
  const spine = entry.price
    ? [entry.publisher, entry.price].filter(Boolean).join(" · ")
    : [entry.publisher, entry.years].filter(Boolean).join(" · ");

  return (
    <li
      data-slot="comic"
      /*
       * The seam, drawn per tile rather than by the grid behind it. A 1px spread
       * shadow takes no layout space, so with the grid's `gap-px` a tile's
       * shadow lands on the exact pixel its neighbour's does - one hairline
       * between them, and nothing painted where there is no tile. Painting the
       * container instead works only while the last row happens to be full: 16
       * comics across five columns leaves four empty cells, which rendered as a
       * solid grey block. Same fix as the filter pills.
       */
      className="group relative flex flex-col bg-background shadow-[0_0_0_1px_var(--color-border)]"
    >
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
      >
        {entry.cover ? (
          <img
            src={entry.cover}
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
            <BookOpen className="size-10 text-muted-foreground/40" aria-hidden />
          </div>
        )}

        <div className="flex flex-1 flex-col p-4">
          <h3 className="leading-snug font-medium text-pretty transition-colors group-hover:text-ember">
            {entry.name}
            <ArrowUpRight className="ml-1 inline size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </h3>

          {/* `mt-auto` pins this to the bottom so it lines up across a row
              whether the title above ran to one line or three. */}
          <div className="mt-auto pt-3">
            <p className="readout-dim truncate" title={spine}>
              {spine}
            </p>
          </div>
        </div>
      </a>
    </li>
  );
}

export function Comics() {
  useDocumentMeta(TITLE, DESCRIPTION);

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

  const publishers = publisherCounts(comics.series);
  const issues = issueCount(comics.series);

  if (comics.series.length === 0 && comics.pullList.length === 0 && comics.wants.length === 0) {
    return (
      <PageShell>
        <PageHeader
          title={TITLE}
          size="long"
          lede="The shelf has not been read yet. Once the nightly League of Comic Geeks job runs, it lands here."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={TITLE}
        size="long"
        lede="New comic day is Wednesday. This is every run on the shelf, what is waiting at the shop this week, and what I have not talked myself into yet. Read from League of Comic Geeks nightly."
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

      <p className="readout-dim mt-8">{shelf.note}</p>

      {shown.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((entry) => (
            <ComicTile key={entry.key} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 border border-dashed border-border p-16 text-center text-muted-foreground">
          {active === "pullList"
            ? "Nothing pulled this week."
            : "Nothing on this list right now."}
        </p>
      )}

      {/* Says where the numbers came from and when, so a stale figure is
          visibly stale rather than quietly wrong. */}
      <p className="readout-dim mt-8">
        {shown.length} shown ·{" "}
        <a
          href={comics.url}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-ember"
        >
          Read from League of Comic Geeks
        </a>{" "}
        {formatFetched(comics.fetched)}
      </p>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5 sm:p-6">
      <dt className="readout-dim">{label}</dt>
      <dd className="display mt-2 text-3xl text-pretty sm:text-4xl">{value}</dd>
    </div>
  );
}
