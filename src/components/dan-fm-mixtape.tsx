import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { Section } from "@/components/page";
import { MIXTAPE_SCORE, mixtape, type Album } from "@/lib/dan-fm";
import { albumTitle, albumUrl } from "@/lib/dan-fm-summary";

/**
 * The standout track off every album that cleared the bar, newest first.
 *
 * A tracklist and not a player. Playing a track in the page needs a Spotify
 * track id, which nothing in the log carries yet, so every row leads outward:
 * to the album's own page here, and to the album on Spotify where the log has
 * a link. Nothing on this page contacts Spotify - `tests/links.spec.ts` fails
 * the build if any request leaves the origin, and an embed or a facade that
 * preloaded one would be that request.
 *
 * The row is laid out so that a control can join it rather than replace it: the
 * cell the Spotify link sits in takes a second child, and neither line above
 * moves when it does.
 */

/** One track, or one album that earned a place without naming one. */
function TapeRow({ album, position }: { album: Album; position: number }) {
  const track = album.standout.name;

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-border py-3.5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
      {/* The list already numbers itself for anything reading it aloud, so this
          is the tape's own hand-written label and nothing more. */}
      <span aria-hidden className="readout-dim tabular-nums">
        {String(position).padStart(2, "0")}
      </span>

      <Link to={albumUrl(album)} className="group min-w-0">
        {/* The album takes the track's place where none was named, rather than
            the row losing a line and going a different shape. Which of the two
            is on this line is said underneath, so a title cannot be read as a
            song somebody picked. */}
        <span className="block leading-snug font-medium text-pretty transition-colors group-hover:text-ember">
          {track || album.album}
        </span>
        <span className="readout-dim mt-1 block truncate">
          {track ? `${album.artist} · ${album.album}` : `${album.artist} · no standout named`}
        </span>
      </Link>

      {album.url ? (
        <a
          href={album.url}
          target="_blank"
          rel="noopener noreferrer"
          /* Named for the album rather than for the service, so a reader
             listing the links off this page gets one destination per row
             instead of the same word down the whole tape. */
          aria-label={`Open ${albumTitle(album)} on Spotify`}
          className="readout col-start-2 inline-flex items-center gap-2 justify-self-start border border-border px-3 py-2 text-muted-foreground transition-colors hover:border-ember hover:bg-ember/5 hover:text-ember sm:col-start-auto"
        >
          Spotify
          <ArrowUpRight className="size-3.5" />
        </a>
      ) : null}
    </li>
  );
}

export function DanFmMixtape({ albums }: { albums: Album[] }) {
  const tape = mixtape(albums);

  return (
    <Section
      title="Mixtape"
      action={<p className="readout-dim">Standouts from everything {MIXTAPE_SCORE} and up</p>}
    >
      {tape.length > 0 ? (
        <ol className="border-t border-border">
          {tape.map((album, index) => (
            <TapeRow key={album.slug} album={album} position={index + 1} />
          ))}
        </ol>
      ) : (
        /* Counted off the scores rather than off the rows: a log of nothing but
           3s has plenty in it and still nothing to play. */
        <EmptyState>{`Nothing has scored a ${MIXTAPE_SCORE} yet.`}</EmptyState>
      )}
    </Section>
  );
}
