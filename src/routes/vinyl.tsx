import { ArrowUpRight, Disc3, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { CONTROL_CLASS, FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import { ScrollingText } from "@/components/scrolling-text";
import { SelectControl } from "@/components/select-control";
import {
  ALL,
  SORTS,
  SORT_LABEL,
  collection,
  formatFetched,
  isOwner,
  isSort,
  matches,
  owners,
  records,
  recordsFor,
  sortRecords,
  statsFor,
  type Sort,
  type Tally,
  type VinylRecord,
} from "@/lib/vinyl";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/use-document-meta";

/** The gap between the page's major blocks, matching the show log's rhythm. */
const BLOCK = "mt-16";

const TITLE = (
  <>
    <span className="block">’Cause I should be</span>
    <span className="display-outline-ember block">spinnin’ you around now</span>
  </>
);

/**
 * One sleeve in the grid. The whole tile is the link, and it goes to Discogs -
 * there is no page of our own to send it to, and pretending otherwise would put
 * a click in front of information the tile already shows.
 */
function RecordTile({ record }: { record: VinylRecord }) {
  // Everything under the sleeve, in the order you would read it off a spine.
  const spine = [record.year ? String(record.year) : "", record.format, record.label]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      data-slot="record"
      /*
       * The seam, drawn per sleeve rather than by the grid behind it. Painting
       * the container and letting `gap-px` show it through works only while the
       * last row is full - 51 records across four columns leaves three empty
       * cells, which rendered as a solid grey block. A 1px spread shadow takes
       * no layout space, so neighbouring tiles land their hairline on the same
       * pixel and nothing is painted where there is no tile. Same fix as the
       * filter pills.
       */
      className="group relative flex flex-col bg-background shadow-[0_0_0_1px_var(--color-border)]"
    >
      <a
        href={record.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
      >
        {record.cover ? (
          <img
            src={record.cover}
            /* The sleeve is decoration for a tile that already names the record
               in text directly beneath it, so describing it again would make a
               screen reader read every entry twice. */
            alt=""
            width={500}
            height={500}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full object-cover transition-opacity group-hover:opacity-80"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center border-b border-border bg-card/40">
            <Disc3 className="size-10 text-muted-foreground/40" aria-hidden />
          </div>
        )}

        <div className="flex flex-1 flex-col p-4">
          <ScrollingText className="readout-dim">{record.artist}</ScrollingText>
          <h3 className="mt-1.5 leading-snug font-medium text-pretty transition-colors group-hover:text-ember">
            {record.title}
            <ArrowUpRight className="ml-1 inline size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </h3>

          {/* `mt-auto` pins this to the bottom, so the spine lines up across a
              row whether the title above it ran to one line or three. */}
          <div className="mt-auto pt-3">
            {record.variant ? (
              <ScrollingText className="readout-dim mb-1.5 text-ember">
                {record.variant}
              </ScrollingText>
            ) : null}
            <ScrollingText className="readout-dim">{spine}</ScrollingText>
          </div>
        </div>
      </a>
    </li>
  );
}

/**
 * One column of the collected-most board, the same shape the show log's repeat
 * lists use so the two pages read as the same site.
 */
function TallyList({
  slot,
  label,
  entries,
  empty,
}: {
  slot: string;
  label: string;
  entries: Tally[];
  empty: string;
}) {
  return (
    <div data-slot={slot} className="col-span-2 bg-background p-5 sm:p-6">
      <p className="readout-dim">{label}</p>

      {entries.length > 0 ? (
        <ol className="mt-5 space-y-3">
          {entries.map((entry) => (
            <li key={entry.name} className="flex items-baseline justify-between gap-4">
              <span className="text-lg text-pretty">{entry.name}</span>
              <span className="readout-dim shrink-0 tabular-nums">{entry.count}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export function Vinyl() {
  useDocumentMeta(
    "Vinyl",
    "Every record Alexis and I own, read from Discogs nightly - what it is, when it was pressed, and whose shelf it is on.",
  );

  // Owner and sort live in the URL so a filtered shelf is linkable and survives
  // a refresh, the same contract the blog's category filter has. The search box
  // stays out of it: it is something you type, scan, and clear, not a view you
  // would send someone.
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const rawOwner = searchParams.get("owner");
  const owner = isOwner(rawOwner) ? rawOwner : ALL;
  const rawSort = searchParams.get("sort");
  const sort: Sort = isSort(rawSort) ? rawSort : "added";

  function update(next: { owner?: string; sort?: Sort }) {
    const merged = { owner, sort, ...next };
    const params: Record<string, string> = {};
    if (merged.owner !== ALL) params.owner = merged.owner;
    if (merged.sort !== "added") params.sort = merged.sort;
    setSearchParams(params, { replace: true });
  }

  // The owner filter drives the stats, the search box only narrows what is
  // listed. Typing "misfits" should not tell you the collection is worth $40.
  const owned = useMemo(() => recordsFor(owner), [owner]);
  const stats = useMemo(() => statsFor(owned), [owned]);
  const visible = useMemo(
    () => sortRecords(owned.filter((record) => matches(record, query)), sort),
    [owned, query, sort],
  );

  if (records.length === 0) {
    return (
      <PageShell>
        <PageHeader
          title={TITLE}
          size="long"
          lede="The shelf has not been read yet. Once the nightly Discogs job runs, it lands here."
        />
      </PageShell>
    );
  }

  // These all follow the owner filter. Candidates in priority order, and a stat
  // only shows once it has something to say, so a one-record shelf never
  // renders "LABELS - 0".
  const tiles: { label: string; value: ReactNode; show: boolean }[] = [
    { label: "Records", value: String(stats.total), show: true },
    { label: "Discs", value: String(stats.discs), show: stats.discs > stats.total },
    { label: "Artists", value: String(stats.artists), show: stats.artists > 0 },
    { label: "Labels", value: String(stats.labels), show: stats.labels > 0 },
    { label: "Colored wax", value: String(stats.colored), show: stats.colored > 0 },
  ]
    .filter((tile) => tile.show)
    .slice(0, 4);

  // The second string of facts, too small to spend a tile on but the kind of
  // thing you actually want to know about a shelf.
  const asides = [
    stats.colored > 0 && !tiles.some((tile) => tile.label === "Colored wax")
      ? `${stats.colored} on colored wax`
      : "",
    stats.oldest && stats.newest && stats.oldest !== stats.newest
      ? `Pressings ${stats.oldest}–${stats.newest}`
      : "",
    // Only worth saying when it is not just the record count again - the whole
    // collection was catalogued in one year, so "51 added this year" sitting
    // under "RECORDS 51" states the same fact twice.
    stats.addedThisYear > 0 && stats.addedThisYear < stats.total
      ? `${stats.addedThisYear} added this year`
      : "",
  ].filter(Boolean);

  const hasBoards = stats.topArtists.length > 0 || stats.topStyles.length > 0;

  /*
   * Each control sits with the thing it changes.
   *
   * Whose records it is scopes the entire page, counts included, so it goes in
   * the header under the sentence that offers it. It used to sit below the
   * stats, which meant picking "Alexis" changed four numbers you had already
   * scrolled past - on a phone the whole board was off screen by then.
   *
   * Sort and search only touch the list, so they sit directly on top of it.
   */
  return (
    <PageShell>
      <PageHeader
        title={TITLE}
        size="long"
        lede="Alexis and I share one Discogs account and separate opinions on what music is good. Collecting vinyl is an expensive hobby, but nothing beats the warm sound of a record player, not to mention the vibes. This list updates daily. Filter it down to just hers or mine."
      >
        {owners.length > 1 ? (
          <FilterToggle
            label="Filter records by whose they are"
            className="mt-8"
            value={owner}
            onChange={(value) => update({ owner: value })}
            options={[
              { value: ALL, label: "Everything", count: records.length },
              ...owners.map((entry) => ({
                value: entry.id,
                label: entry.name,
                count: entry.count,
              })),
            ]}
          />
        ) : null}
      </PageHeader>

      <section aria-label="What is on the shelf">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {tiles.map((tile) => (
            <dl key={tile.label} data-slot="stat" className="bg-background p-5 sm:p-6">
              <dt className="readout-dim">{tile.label}</dt>
              <dd className="display mt-2 text-2xl text-balance sm:text-3xl">{tile.value}</dd>
            </dl>
          ))}

          {hasBoards ? (
            <>
              <TallyList
                slot="collected-most"
                label="Collected most"
                entries={stats.topArtists}
                empty="No artist twice yet."
              />
              <TallyList
                slot="sounds-like"
                label="Sounds like"
                entries={stats.topStyles}
                empty="Not enough of a pattern yet."
              />
            </>
          ) : null}
        </div>

        {asides.length > 0 ? <p className="readout-dim mt-4">{asides.join(" · ")}</p> : null}
      </section>

      {/* A full block below the counts and half of one above the grid, so the
          row reads as belonging to the sleeves rather than to the stats. */}
      <div className={cn(BLOCK, "flex flex-col gap-4 sm:flex-row sm:items-center")}>
        <SelectControl
          label="Sort records"
          value={sort}
          onChange={(value: Sort) => update({ sort: value })}
          options={SORTS.map((option) => ({ value: option, label: SORT_LABEL[option] }))}
          className="sm:w-56"
        />

        <div className="relative sm:ml-auto sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          {/* Same `CONTROL_CLASS` as the select beside it, so the row lines up
              on one baseline instead of by eye. */}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Artist, label, genre"
            aria-label="Search the collection"
            className={cn(
              CONTROL_CLASS,
              "w-full border border-border bg-background pl-11 text-sm",
              "placeholder:text-muted-foreground focus-visible:border-ember focus-visible:outline-none",
            )}
          />
        </div>
      </div>

      {visible.length > 0 ? (
        <ul className="mt-8 grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((record) => (
            <RecordTile key={record.instanceId} record={record} />
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8">Nothing on the shelf matches “{query}”.</EmptyState>
      )}

      {/* Says where the numbers came from and when, so a stale figure is
          visibly stale rather than quietly wrong. */}
      <p className="readout-dim mt-8">
        {visible.length} of {records.length} shown ·{" "}
        <a
          href={collection.url}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-ember"
        >
          Read from Discogs
        </a>{" "}
        {formatFetched(collection.fetched)}
      </p>
    </PageShell>
  );
}
