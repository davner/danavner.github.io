import { ArrowUpRight, Disc3 } from "lucide-react";

import {
  AlbumCover,
  AlbumReview,
  AlbumScore,
  AlbumTake,
  AlbumTracks,
} from "@/components/album-record";
import { DanFmArchive } from "@/components/dan-fm-archive";
import { DanFmCharts } from "@/components/dan-fm-charts";
import { DanFmMixtape } from "@/components/dan-fm-mixtape";
import { Link } from "@/components/link";
import { OnAir } from "@/components/on-air";
import { PageHeader, PageShell, Section } from "@/components/page";
import { ShareAlbum } from "@/components/share-album";
import { SourceLine } from "@/components/source-line";
import { SpotifyCredit } from "@/components/spotify-credit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { albums, log, station, statsFor, yearLabel, type Album } from "@/lib/dan-fm";
import { albumUrl } from "@/lib/dan-fm-summary";
import { longDate } from "@/lib/dates";
import { catalogueLine, PAGE_META } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";
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

        {/* The album's own address. The title is what a reader reaches for to
            go from the card to the record, and it is the shortest way there:
            the archive below holds the same link, a scroll and a scan further
            down. */}
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

        <AlbumTake take={album.take} className="mt-6" />

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
            reach them. The actions then sit where the reading ends. */}
        <AlbumReview review={album.review} className="mt-10" />

        {/* The same pair the album's own page carries under its badges, in the
            same order and at the same size, so the two surfaces do not offer
            one album two sets of controls. The row owns the margin rather than
            either control: the Spotify link is only there on the days the log
            has an address for the record, and the space under the review is
            not.

            The share button carries the station's address rather than this
            album's, because someone sharing the front page is sharing what is
            on and tomorrow that is a different record. The poster is still this
            album - it is what is on air at the moment the link is sent. */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ShareAlbum album={album} url={`${SITE_URL}/dan-fm`} />

          {/* A plain anchor behind the button styling, and it stays one. An
              embed or a play button would have this page reach Spotify on load,
              which `tests/links.spec.ts` fails the build over. */}
          {album.url ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="readout rounded-none text-muted-foreground hover:border-ember hover:text-ember"
            >
              <a href={album.url} target="_blank" rel="noopener noreferrer">
                Open on Spotify
                <ArrowUpRight />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DanFm() {
  useDocumentMeta(META.title, META.description);

  const now = station();
  const stats = statsFor(albums);

  return (
    <PageShell>
      <PageHeader
        catalogue={catalogueLine("/dan-fm")}
        title="dan.fm"
        lede="One album a day. A review, a favourite track, a least favourite, and a score out of five."
        /* On the catalogue row rather than a row of its own: the halo reaches
           2.5rem past the badge, and up here it dies in the poster title's
           own air before reaching its glyphs - a glow touching text would
           tint what axe can give no contrast ratio for. */
        catalogueAside={<OnAir lamp={now.lamp} />}
      />

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

      {/* All four sections stand from the first day, each with its own empty
          state, so the page's shape never changes under someone who comes
          back. */}
      <DanFmArchive albums={albums} />
      <DanFmCharts albums={albums} />
      <DanFmMixtape albums={albums} />

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
