import { Disc3 } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { AlbumScore } from "@/components/album-record";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/components/link";
import { FilterStatus } from "@/components/filter-status";
import { FilterToggle } from "@/components/filter-toggle";
import { Section } from "@/components/page";
import { SelectControl } from "@/components/select-control";
import { coverSrcSet } from "@/lib/covers";
import {
  ALL,
  FILTER_KEYS,
  bandsFor,
  facetsFor,
  filterAlbums,
  isFiltered,
  statsFor,
  yearLabel,
  type Album,
  type BandTally,
  type Facet,
  type FacetId,
  type FilterKey,
  type Selection,
} from "@/lib/dan-fm";
import { albumUrl } from "@/lib/dan-fm-summary";
import { MONTHS } from "@/lib/dates";

/**
 * Every album, newest first, and the controls that narrow it.
 *
 * The list is not paged and not virtualised. A day is a row, so this grows by
 * about 365 a year, and both of the usual answers cost the two things the
 * archive is for: find-in-page over the whole log, and a link that opens on the
 * same rows the sender was looking at.
 */

/**
 * The thumb is 56px wherever a row is drawn, so one value answers `srcSet` at
 * every breakpoint.
 */
const COVER_SIZES = "56px";

/**
 * "Aug 31", which is as much date as a 3.5rem column holds.
 *
 * The month is named rather than numbered because the whole row is one link, so
 * this is read out as part of its name: "08\u00b731" is a legible pair of numbers
 * and an illegible thing to hear. "" for a date that is not `YYYY-MM-DD`, the
 * answer `longDate` gives the same input.
 */
function shortDate(date: string): string {
  const month = MONTHS[Number(date.slice(5, 7)) - 1];
  return month ? `${month.slice(0, 3)} ${Number(date.slice(8, 10))}` : "";
}

/** "1 album", "8 albums". */
function counted(total: number, noun: string): string {
  return `${total} ${total === 1 ? noun : `${noun}s`}`;
}

/**
 * One day of the log.
 *
 * Five cells, laid out as five columns once there is room and stacked beside
 * the sleeve before that. Every one of them renders whether or not the row has
 * anything to put in it: a cell dropped for a blank genre would slide the score
 * into the genre's column and take the whole grid with it.
 */
function ArchiveRow({ album }: { album: Album }) {
  const spine = [album.artist, yearLabel(album)].filter(Boolean).join(" · ");

  return (
    <li className="border-b border-border">
      <Link
        to={albumUrl(album)}
        /* The wash is what makes the whole row the target. A title that goes
           ember on its own is feedback at the far left of a row a metre wide,
           so the pointer is told nothing wherever it actually is. Same 5% ember
           the page's outline link commits to. */
        className="group grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 py-3.5 transition-colors hover:bg-ember/5 md:grid-cols-[3.5rem_3.5rem_minmax(0,1fr)_8rem_6rem]"
      >
        {album.cover ? (
          <img
            src={album.cover}
            srcSet={coverSrcSet(album.cover) ?? undefined}
            sizes={COVER_SIZES}
            /* The record is named in full beside it, so describing the sleeve
               as well would read every row twice. */
            alt=""
            width={500}
            height={500}
            /* A year of listening is a year of sleeves, and all but the first
               screenful of them are below the fold. */
            loading="lazy"
            decoding="async"
            className="row-span-4 size-14 border border-border object-cover md:row-span-1"
          />
        ) : (
          <div className="row-span-4 flex size-14 items-center justify-center border border-border bg-card/40 md:row-span-1">
            <Disc3 className="size-5 text-muted-foreground" aria-hidden />
          </div>
        )}

        {/* The year is spoken and not printed: it does not fit the column, and
            the rows are read newest first so it is rarely the question. One
            interpolated string rather than separate children, or the comma and
            the space are whitespace the name computation drops and it reads
            "Aug 312026". */}
        <time dateTime={album.date} className="readout-dim col-start-2 md:col-start-auto">
          {shortDate(album.date)}
          <span className="sr-only">{`, ${album.date.slice(0, 4)}`}</span>
        </time>

        <div className="col-start-2 md:col-start-auto">
          <h3 className="leading-snug font-medium text-pretty transition-colors group-hover:text-ember">
            {album.album}
          </h3>
          <p className="readout-dim mt-1 truncate">{spine}</p>
        </div>

        <p className="readout-dim col-start-2 truncate md:col-start-auto">{album.genre}</p>

        <div className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 md:col-start-auto">
          <AlbumScore album={album} />
        </div>
      </Link>
    </li>
  );
}

/**
 * What the five controls are set to, read off the URL.
 *
 * A value the log does not hold - a stale link, a query typed by hand - falls
 * back to everything. Taking it literally answers with an empty list and
 * nothing on the page to say why it is empty.
 */
function readSelection(params: URLSearchParams, facets: Facet[], bands: BandTally[]): Selection {
  const chosen = (key: FilterKey, allowed: readonly string[]): string => {
    const raw = params.get(key);
    return raw !== null && allowed.includes(raw) ? raw : ALL;
  };

  const facet = (id: FacetId): string =>
    chosen(
      id,
      facets.find((entry) => entry.id === id)?.options.map((option) => option.value) ?? [],
    );

  return {
    genre: facet("genre"),
    tag: facet("tag"),
    source: facet("source"),
    shelf: facet("shelf"),
    score: chosen(
      "score",
      bands.map((band) => band.id),
    ),
  };
}

export function DanFmArchive({ albums }: { albums: Album[] }) {
  // All five live in the URL, so a narrowed archive is linkable and survives a
  // refresh - the contract `/vinyl` and `/blog` already have. `replace`, so a
  // run of filter changes leaves one history entry and Back goes to wherever
  // the reader came from rather than back through their own adjustments.
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * Read off the whole log rather than off what is currently showing, so the
   * controls hold still while they are being used. Narrowing them to the
   * visible rows would mean picking a genre silently removed most of the shelf
   * options, and undoing that first choice is the one move a reader cannot
   * discover from what is left on screen.
   */
  const facets = useMemo(() => facetsFor(albums), [albums]);
  const bands = useMemo(() => bandsFor(albums), [albums]);
  const stats = useMemo(() => statsFor(albums), [albums]);

  const selection = readSelection(searchParams, facets, bands);
  const visible = filterAlbums(albums, selection);

  function update(key: FilterKey, value: string) {
    const params: Record<string, string> = {};
    for (const other of FILTER_KEYS) {
      const set = other === key ? value : selection[other];
      if (set !== ALL) params[other] = set;
    }
    setSearchParams(params, { replace: true });
  }

  /*
   * The head counts the log while the log is what is on screen, and counts the
   * subset the moment it is not. Days belong to the whole log - eleven albums
   * over fourteen days is a different claim from eleven over eleven - and say
   * nothing about three rows filtered out of it, so they go when it narrows.
   */
  const head =
    visible.length === albums.length
      ? `${counted(stats.total, "album")} · ${counted(stats.days, "day")}`
      : `${visible.length} of ${counted(albums.length, "album")}`;

  return (
    <Section
      title="Archive"
      action={albums.length > 0 ? <p className="readout-dim">{head}</p> : undefined}
    >
      {/* Outside the branch below, because the region has to exist before it
          has anything to say: assistive technology announces a change to a
          region it was already watching, and one that appears alongside its own
          first message is usually missed. `FilterStatus` says so itself, and an
          empty log is the one state where nothing can ever change it - which is
          an argument for it being harmless here, not for wrapping it. */}
      <FilterStatus message={`${visible.length} of ${counted(albums.length, "album")} shown`} />

      {albums.length === 0 ? (
        <EmptyState>Nothing logged yet. Give it a day.</EmptyState>
      ) : (
        <>
          {facets.length > 0 || bands.length > 0 ? (
            <div className="mb-8 flex flex-col gap-4">
              {facets.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {facets.map((facet) => (
                    <SelectControl
                      key={facet.id}
                      label={`Filter albums by ${facet.name.toLowerCase()}`}
                      value={selection[facet.id]}
                      onChange={(value) => update(facet.id, value)}
                      options={[
                        { value: ALL, label: facet.all },
                        ...facet.options.map((option) => ({
                          value: option.value,
                          label: option.value,
                        })),
                      ]}
                      /* How it was found is typed as a sentence rather than a
                         word, so this one control is sized to what the log
                         actually puts in it. */
                      className={facet.id === "source" ? "sm:w-72" : "sm:w-44"}
                    />
                  ))}
                </div>
              ) : null}

              {bands.length > 0 ? (
                <FilterToggle
                  label="Filter albums by score"
                  value={selection.score}
                  onChange={(value) => update("score", value)}
                  options={[
                    { value: ALL, label: "All scores", count: albums.length },
                    ...bands.map((band) => ({
                      value: band.id,
                      label: band.label,
                      count: band.count,
                    })),
                  ]}
                />
              ) : null}

              {/* Five controls set independently take five moves to undo, and
                  the state worth undoing fastest is the one showing nothing. */}
              {isFiltered(selection) ? (
                <p className="readout-dim">
                  <button
                    type="button"
                    onClick={() => setSearchParams({}, { replace: true })}
                    className="readout-link cursor-pointer"
                  >
                    Clear filters
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}

          {visible.length > 0 ? (
            <ul className="border-t border-border">
              {visible.map((album) => (
                <ArchiveRow key={album.slug} album={album} />
              ))}
            </ul>
          ) : (
            <EmptyState>Nothing in the log matches those filters.</EmptyState>
          )}
        </>
      )}
    </Section>
  );
}
