import { ArrowUpRight, Disc3 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { OnAir } from "@/components/on-air";
import { PageHeader, PageShell, Section } from "@/components/page";
import { Rating } from "@/components/rating";
import { SourceLine } from "@/components/source-line";
import { SpotifyCredit } from "@/components/spotify-credit";
import { Badge } from "@/components/ui/badge";
import { coverSrcSet } from "@/lib/covers";
import {
  CHART_MINIMUM,
  MIXTAPE_SCORE,
  albums,
  log,
  mixtape,
  station,
  statsFor,
  type Album,
  type Station,
} from "@/lib/dan-fm";
import { longDate } from "@/lib/dates";
import { PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

const META = PAGE_META["/dan-fm"];

/**
 * A star instead of the show log's horns. `Rating` paints whatever mark it is
 * handed and takes its colour from the line it sits on, so the album score and
 * a show's rating stay one component drawing one ember.
 */
const STAR = "★";

/**
 * How wide the sleeve is laid out, so the browser can pick between the two
 * candidates in `srcSet` before there is a layout to measure. Each clause is a
 * grid track below: 22rem at `lg`, 18rem at `md`, and capped at `sm` so a
 * tablet does not open on a 700px square. Rounded up rather than down, since
 * asking for a few px too many costs bytes and asking for too few ships blur.
 */
const COVER_SIZES =
  "(min-width: 1024px) 352px, (min-width: 768px) 288px, (min-width: 640px) 384px, 100vw";

/** A station with an album to show, which is every state but launch day. */
type Playing = Station & { featured: Album };

/**
 * The line above the album, saying which album this is and why it is the one on
 * screen. It is the only place the lamp's three states differ in words, so the
 * copy and the light cannot drift apart.
 *
 * Standing by gets a sentence rather than a count, because a day's album is
 * logged in the evening and every morning would otherwise open on what reads
 * like a failure. Dead air is the one that means something, so it counts.
 */
function statusLine({ lamp, featured, silentDays }: Playing): string {
  const when = longDate(featured.date);

  if (lamp === "on-air") return `${when} · Day ${featured.ordinal}`;
  if (lamp === "standing-by") return `Today's album is not logged yet · Last on air ${when}`;
  return `Off air ${silentDays} days · Last spin ${when}`;
}

/** "1998 pressing" rather than "1998" where the year came off a reissue. */
function yearLabel(album: Album): string {
  if (album.year === null) return "";
  return album.yearIsPressing ? `${album.year} pressing` : String(album.year);
}

/** One album, at the size the front page gives the current one. */
function TodayCard({ playing }: { playing: Playing }) {
  const album = playing.featured;
  const attribution = album.from ? `From ${album.from}` : "Own pick";

  return (
    <div className="grid gap-8 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="sm:max-w-sm md:max-w-none">
        {album.cover ? (
          <img
            src={album.cover}
            srcSet={coverSrcSet(album.cover) ?? undefined}
            sizes={COVER_SIZES}
            /* The artist and the album are set in full beside it, so naming the
               sleeve as well would have a screen reader read the record twice. */
            alt=""
            width={500}
            height={500}
            decoding="async"
            className="aspect-square w-full border border-border object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center border border-border bg-card/40">
            <Disc3 className="size-8 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <div>
        <p className="readout-dim">{statusLine(playing)}</p>

        <h3 className="display mt-4 text-feature text-balance">{album.album}</h3>

        <p className="mt-4 text-title leading-snug text-muted-foreground text-pretty">
          {[album.artist, yearLabel(album)].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Rating value={album.score} mark={STAR} />

          {album.later === null ? (
            <span className="readout-dim">{album.score}</span>
          ) : (
            /* The stars draw the first score, so the second one is written out
               beside them rather than folded into the graphic - and the word is
               spoken where the arrow is only drawn. */
            <span className="readout text-ember">
              {album.score} <span aria-hidden>→</span>
              <span className="sr-only">later</span> {album.later}
            </span>
          )}

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

        <Tracks album={album} />

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

/**
 * The two tracks a row can name. Either half may be blank - an album can be
 * worth hearing with no favourite standing out, and one with nothing to skip is
 * the whole point of a good one - so each row appears only when it has a name.
 */
function Tracks({ album }: { album: Album }) {
  const rows = [
    { label: "Standout", name: album.standout.name, accent: true },
    { label: "Skip", name: album.skip.name, accent: false },
  ].filter((row) => row.name);

  if (rows.length === 0) return null;

  return (
    <dl className="mt-8 max-w-2xl">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 border-t border-border py-2.5"
        >
          <dt className={row.accent ? "readout text-ember" : "readout-dim"}>{row.label}</dt>
          <dd className="text-sm text-pretty">{row.name}</dd>
        </div>
      ))}
    </dl>
  );
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
          <TodayCard playing={{ ...now, featured: now.featured }} />
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
