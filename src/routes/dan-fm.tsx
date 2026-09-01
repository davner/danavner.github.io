import { ArrowUpRight, Disc3 } from "lucide-react";
import { Link } from "react-router";

import { AlbumCover, AlbumReview, AlbumScore, AlbumTracks } from "@/components/album-record";
import { EmptyState } from "@/components/empty-state";
import { OnAir } from "@/components/on-air";
import { PageHeader, PageShell, Section } from "@/components/page";
import { SourceLine } from "@/components/source-line";
import { SpotifyCredit } from "@/components/spotify-credit";
import { Badge } from "@/components/ui/badge";
import {
  CHART_MINIMUM,
  MIXTAPE_SCORE,
  albums,
  log,
  mixtape,
  station,
  statsFor,
  yearLabel,
  type Album,
} from "@/lib/dan-fm";
import { albumUrl } from "@/lib/dan-fm-summary";
import { longDate } from "@/lib/dates";
import { PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

const META = PAGE_META["/dan-fm"];

/**
 * How wide the sleeve is laid out, so the browser can pick between the two
 * candidates in `srcSet` before there is a layout to measure. Each clause is a
 * grid track below: 22rem at `lg`, 18rem at `md`, and capped at `sm` so a
 * tablet does not open on a 700px square. Rounded up rather than down, since
 * asking for a few px too many costs bytes and asking for too few ships blur.
 */
const COVER_SIZES =
  "(min-width: 1024px) 352px, (min-width: 768px) 288px, (min-width: 640px) 384px, 100vw";

/** One album, at the size the front page gives the current one. */
function TodayCard({ album }: { album: Album }) {
  const attribution = album.from ? `From ${album.from}` : "Own pick";

  return (
    <div className="grid gap-8 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="sm:max-w-sm md:max-w-none">
        {album.cover ? (
          <AlbumCover cover={album.cover} sizes={COVER_SIZES} />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center border border-border bg-card/40">
            <Disc3 className="size-8 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <div>
        {/* Which day of the log this is, and which day it was heard. The badge
            above says only whether the station is still on air; how long ago
            this was is read here, which is why an off-air badge needs nothing
            beside it repeating the same thing in words. */}
        <p className="readout-dim">
          {longDate(album.date)} · Day {album.ordinal}
        </p>

        {/* The album's own address, and the only way onto it from the site
            while the archive is unbuilt - the title is what a reader would
            click to go from the card to the record. */}
        <h3 className="display mt-4 text-feature text-balance">
          <Link to={albumUrl(album)} className="transition-colors hover:text-ember">
            {album.album}
          </Link>
        </h3>

        <p className="mt-4 text-title leading-snug text-muted-foreground text-pretty">
          {[album.artist, yearLabel(album)].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <AlbumScore album={album} />

          {album.shelf ? <Badge variant="ember">{album.shelf}</Badge> : null}
          <Badge variant="outline">{attribution}</Badge>
        </div>

        {album.take ? (
          <p className="mt-6 max-w-2xl text-lede leading-relaxed text-pretty">{album.take}</p>
        ) : null}

        {album.genre || album.tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {album.genre ? <Badge variant="outline">{album.genre}</Badge> : null}
            {album.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <AlbumTracks album={album} className="mt-8" />

        {/* Last of the writing, under the spec block rather than over it: the
            score, the tags and the two tracks are scanned in a second, and a
            reader who wants them should not have to pass a thousand words to
            reach them. The Spotify link then sits where the reading ends. */}
        <AlbumReview review={album.review} className="mt-10" />

        {album.url ? (
          <a
            href={album.url}
            target="_blank"
            rel="noopener noreferrer"
            className="readout mt-8 inline-flex items-center gap-2 border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-ember hover:bg-ember/5 hover:text-ember"
          >
            Open on Spotify
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/*
 * The three sections that stand on the page before they are built.
 *
 * Each sentence says what the log holds for that section and admits the section
 * itself is not there, and both halves have to stay true as the log fills: the
 * page shows an album and a score the moment the first row is committed, so
 * copy written only for an empty log would sit on screen contradicting it.
 * Every one of these goes when the section it stands in is built.
 */

function archiveCopy(total: number): string {
  if (total === 0) return "Nothing logged yet. Give it a day.";

  return `${total === 1 ? "1 album" : `${total} albums`} logged. I have not built the list yet.`;
}

/**
 * Below the minimum the wait is counted down from the constant rather than
 * named as a month, since the log misses days and a date would drift off the
 * count the first time one is skipped. Above it there is nothing left to count.
 */
function chartsCopy(total: number): string {
  if (total >= CHART_MINIMUM) return "Enough albums to chart now. I have not drawn the charts yet.";

  return `Not enough albums to chart anything honest. ${CHART_MINIMUM - total} to go.`;
}

/**
 * Counted off the keepers rather than the log, because the tape's bar is a score
 * and not a row: a log of nothing but 3s has plenty in it and still nothing to
 * play.
 */
function mixtapeCopy(keepers: number): string {
  if (keepers === 0) return `Nothing has scored a ${MIXTAPE_SCORE} yet.`;

  const many = keepers === 1 ? "1 album has" : `${keepers} albums have`;
  return `${many} scored a ${MIXTAPE_SCORE} or better. I have not made the tape yet.`;
}

export function DanFm() {
  useDocumentMeta(META.title, META.description);

  const now = station();
  const stats = statsFor(albums);
  const keepers = mixtape(albums).length;

  return (
    <PageShell>
      <PageHeader
        title="dan.fm"
        lede="One album a day. A review, a favourite track, a least favourite, and a score out of five."
      >
        {/* The halo reaches 2.5rem past the badge, so this gap is structural
            rather than taste: a glow touching the lede would tint text that axe
            can then give no contrast ratio for. */}
        <div className="mt-10">
          <OnAir lamp={now.lamp} />
        </div>
      </PageHeader>

      <Section title="Today">
        {now.featured ? (
          <TodayCard album={now.featured} />
        ) : (
          <div className="max-w-xl">
            <h3 className="display text-feature">Nothing on yet</h3>
            <p className="mt-6 text-lede leading-relaxed text-muted-foreground text-pretty">
              One album a day, with a review, a favourite track, a least favourite, and a score out
              of five. The first one shows up here the day it is logged.
            </p>
          </div>
        )}
      </Section>

      {/* All four sections stand from the first day, each with its own copy, so
          the page's shape never changes under someone who comes back. */}
      {/* No count in the head. "N albums · M days" belongs with the rows it
          counts, which arrive with the archive itself. */}
      <Section title="Archive">
        <EmptyState>{archiveCopy(stats.total)}</EmptyState>
      </Section>

      <Section title="Charts">
        <EmptyState>{chartsCopy(stats.total)}</EmptyState>
      </Section>

      <Section
        title="Mixtape"
        action={<p className="readout-dim">Standouts from everything {MIXTAPE_SCORE} and up</p>}
      >
        <EmptyState>{mixtapeCopy(keepers)}</EmptyState>
      </Section>

      {/* The gate is whether cover art is on screen, which is the featured
          album's and nothing else: `TodayCard` paints the only sleeve, so a
          cover saved against an older row is nowhere to be seen and crediting
          it would name art nobody can look at. A section that paints its own
          covers joins the gate. A `spotifyId` never does - it is parsed out of
          the link typed in the sheet, so gating on one would credit Spotify for
          a page that had never contacted it. Same rule as the source line
          below. */}
      {now.featured?.cover ? <SpotifyCredit className="mt-8" /> : null}

      {/* Only once the job has read the sheet. Before that there is no URL to
          link and no date to print, and a source line with neither is furniture
          claiming a provenance the page does not have. */}
      {log.url ? (
        <SourceLine
          count={stats.total > 0 ? `${stats.total} logged` : undefined}
          href={log.url}
          source="the sheet"
          fetched={log.fetched}
        />
      ) : null}
    </PageShell>
  );
}
