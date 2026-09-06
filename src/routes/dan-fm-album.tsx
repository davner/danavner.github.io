import { ArrowLeft } from "lucide-react";
import { Navigate, useParams } from "react-router";

import {
  AlbumActions,
  AlbumCover,
  AlbumReview,
  AlbumScore,
  AlbumTake,
  AlbumTracks,
} from "@/components/album-record";
import { FactLine } from "@/components/fact-line";
import { Link } from "@/components/link";
import { PageHeader, PageShell, Section } from "@/components/page";
import { SpotifyCredit } from "@/components/spotify-credit";
import { Badge } from "@/components/ui/badge";
import { type Album, albums, yearLabel } from "@/lib/dan-fm";
import { albumSummary, albumTitle } from "@/lib/dan-fm-summary";
import { longDate } from "@/lib/dates";
import { useDocumentMeta } from "@/lib/use-document-meta";

/**
 * How wide the sleeve is laid out, for whatever candidates the cover offers.
 * One clause, because `PageHeader`'s aside is a 24rem track at `lg` and a
 * full-width block below it. Rounded up rather than down, since asking for a
 * few px too many costs bytes and asking for too few ships blur.
 */
const COVER_SIZES = "(min-width: 1024px) 384px, 100vw";

/**
 * One album, on its own page.
 *
 * This is the target of every share link, so it has to stand on its own for
 * someone arriving from a message who has never seen the site: the record, who
 * made it, what it scored, and the whole of what was written about it.
 */
export function DanFmAlbum() {
  const { slug } = useParams();
  const album = albums.find((entry) => entry.slug === slug);

  // An unknown slug is a dead album link, not a dead site - send it to the
  // station, which is showing whatever is on now.
  if (!album) return <Navigate to="/dan-fm" replace />;

  // Split so the not-found branch can return before any hook runs.
  return <AlbumBody album={album} />;
}

function AlbumBody({ album }: { album: Album }) {
  useDocumentMeta(albumTitle(album), albumSummary(album));

  const attribution = album.from ? `From ${album.from}` : "Own pick";

  return (
    <PageShell>
      <PageHeader
        title={album.album}
        /* An album name is a phrase rather than the word or two the poster step
           is drawn for, and this is arbitrary text off a spreadsheet: the long
           step is the one sized so a single long word still clears a 320px
           screen without breaking mid-word. */
        size="long"
        /*
         * Nothing where there is no sleeve, rather than the placeholder square
         * the front page draws. There the square is a grid track holding a card
         * together; here it would be the largest thing on the page and would
         * say a picture failed to load rather than that none was saved.
         */
        aside={album.cover ? <AlbumCover cover={album.cover} sizes={COVER_SIZES} /> : undefined}
        asideAlign="start"
      >
        <p className="mt-4 text-title leading-snug text-muted-foreground text-pretty">
          {[album.artist, yearLabel(album)].filter(Boolean).join(" · ")}
        </p>

        {/* Which day it was heard and which day of the log that is. Someone
            arriving from a message has nothing else on the page telling them
            how old this is, and the station's badge is not on it. */}
        <FactLine items={[longDate(album.date), `Day ${album.ordinal}`]} className="mt-6" />

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <AlbumScore album={album} />

          {album.shelf ? <Badge variant="ember">{album.shelf}</Badge> : null}
          <Badge variant="outline">{attribution}</Badge>
        </div>

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

        <AlbumActions album={album} className="mt-7" />
      </PageHeader>

      {/* The record in the order the front page reads it, so one album on two
          surfaces is the same album: the verdict, then the two tracks, then the
          long piece. */}
      <Section className="mt-10">
        <AlbumTake take={album.take} />

        <AlbumTracks album={album} className="mt-8" />
        <AlbumReview review={album.review} className="mt-10" />
      </Section>

      {/* Only where a sleeve is on screen. Same rule as the station's front
          page: a `spotifyId` never earns the credit, because it is parsed out
          of a link typed into the sheet and nothing here has contacted
          Spotify. */}
      {album.cover ? <SpotifyCredit className="mt-8" /> : null}

      <Section>
        <Link
          to="/dan-fm"
          className="readout group inline-flex items-center gap-2 border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-ember hover:bg-ember/5 hover:text-ember"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Back to dan.fm
        </Link>
      </Section>
    </PageShell>
  );
}
