import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Flame,
  ListMusic,
  MapPin,
  Music,
  Ticket,
  Users,
  Youtube,
} from "lucide-react";
import Markdown from "react-markdown";
import { Link, Navigate, useParams } from "react-router";
import remarkGfm from "remark-gfm";

import { DuoBadge } from "@/components/duo-badge";
import { FactLine } from "@/components/fact-line";
import { PageHeader, PageShell, Section } from "@/components/page";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Rating } from "@/components/rating";
import { ShareShow } from "@/components/share-show";
import { SoloBadge } from "@/components/solo-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fullShowDate, showSummary } from "@/lib/show-summary";
import { isDuo, shows } from "@/lib/shows";
import { useDocumentMeta } from "@/lib/use-document-meta";

/**
 * One show, on its own page.
 *
 * This is the target of every share link, so it has to stand on its own for
 * someone arriving from a text message who has never seen the site.
 */
export function ShowDetail() {
  const { slug } = useParams();
  const show = shows.find((entry) => entry.slug === slug);

  // An unknown slug is a dead show link, not a dead site - send it to the log.
  if (!show) return <Navigate to="/shows" replace />;

  // Split so the not-found branch can return before any hook runs.
  return <ShowBody show={show} />;
}

/**
 * Which night this was: the date, the room, and the pin on the map. Only what
 * identifies the show - five facts on this line wrapped into three ragged rows
 * on a phone.
 */
function showFacts(show: (typeof shows)[number]) {
  const fact = (Icon: typeof Calendar, text: string) =>
    text ? (
      <span className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-ember" aria-hidden />
        {text}
      </span>
    ) : null;

  return [
    fact(Calendar, fullShowDate(show)),
    fact(Building2, show.venue),
    fact(MapPin, show.city),
  ].filter(Boolean);
}

function ShowBody({ show }: { show: (typeof shows)[number] }) {
  useDocumentMeta(show.title, showSummary(show));

  const facts = showFacts(show);

  return (
    <PageShell>
      <PageHeader title={show.title}>
        {/* The tour, or which day of the festival. It reads as a subtitle to
            the name above it, which is what it is - a badge made it look like
            a category someone filed the night under. */}
        {show.subtitle ? (
          <p className="readout-dim mt-3 text-pretty">{show.subtitle}</p>
        ) : null}

        {/* This page is the target of every share link, so when someone opens
            it from a text message the date and the room are the first thing
            they need, and they are stated nowhere else on the page. */}
        <FactLine items={facts} className="mt-6" />

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          {show.type === "festival" ? <Badge variant="ion">Festival</Badge> : null}
          {/* Outline rather than ion, so a measurement never reads as a label
              someone chose to put on the night. A ticket, because the building
              is the venue itself and the people icon means the people who
              actually came. */}
          {show.capacity ? (
            <Badge variant="outline" className="rounded-none border-border">
              <Ticket />
              {show.capacity.toLocaleString("en-US")} cap
            </Badge>
          ) : null}
          {show.standout ? (
            <Badge variant="ember">
              <Flame />
              Standout
            </Badge>
          ) : null}
          {show.rating != null ? <Rating value={show.rating} /> : null}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <ShareShow show={show} />
          {show.video ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="readout rounded-none text-muted-foreground hover:border-ember hover:text-ember"
            >
              <a href={show.video} target="_blank" rel="noreferrer noopener">
                <Youtube />
                {show.videoIsPlaylist ? "Playlist" : "Watch"}
              </a>
            </Button>
          ) : null}
        </div>

      </PageHeader>

      {/*
       * One row per band, rather than a lineup list and a setlist grid printing
       * the same names twice down the page. A setlist is a fact about a band,
       * not a parallel collection, so it lives on that band's row.
       *
       * The headliner is in here too, which it never was when this section was
       * "Support" - so its own setlist finally has somewhere to go.
       */}
      {show.lineup.length > 0 ? (
        <Section title="Lineup" index="01">
          <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {show.lineup.map((band) => {
              const setlist = show.setlists.find((entry) => entry.band === band);
              const inner = <span className="text-lg">{band}</span>;

              return (
                <li key={band} className="flex bg-background">
                  {setlist ? (
                    <a
                      href={setlist.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${band} setlist on setlist.fm`}
                      className="group flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 transition-colors hover:bg-card/60 hover:text-ember"
                    >
                      {inner}
                      <span className="readout-dim ml-auto flex shrink-0 items-center gap-1.5 transition-colors group-hover:text-ember">
                        <ListMusic className="size-3.5 text-ember" aria-hidden />
                        Setlist
                        <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />
                      </span>
                    </a>
                  ) : (
                    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 text-muted-foreground">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}

            {/*
             * The grid paints its own background through the 1px gaps, so a
             * part-filled last row shows as a grey slab where the missing
             * cells are - four bands across three columns leaves two. These
             * fill it, one set per column count, each only visible at the
             * breakpoint whose arithmetic it was computed for.
             */}
            {Array.from({ length: (3 - (show.lineup.length % 3)) % 3 }, (_, index) => (
              <li key={`fill-lg-${index}`} aria-hidden className="hidden bg-background lg:block" />
            ))}
            {Array.from({ length: (2 - (show.lineup.length % 2)) % 2 }, (_, index) => (
              <li
                key={`fill-sm-${index}`}
                aria-hidden
                className="hidden bg-background sm:block lg:hidden"
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {show.bestSong || show.solo || show.companions.length > 0 ? (
        <Section title="The night" index={show.lineup.length > 0 ? "02" : "01"}>
          <div className="space-y-4">
            {show.bestSong ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Music className="size-4 shrink-0 text-ember" aria-hidden />
                <span>
                  <span className="readout-dim">Best live</span> {show.bestSong}
                </span>
              </p>
            ) : null}

            {show.solo ? (
              <p>
                <SoloBadge />
              </p>
            ) : isDuo(show) ? (
              <p>
                <DuoBadge partner={show.companions[0]} />
              </p>
            ) : show.companions.length > 0 ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4 shrink-0 text-ember" aria-hidden />
                <span>
                  <span className="sr-only">Went with </span>
                  {show.companions.join(", ")}
                </span>
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {show.body ? (
        <Section>
          <div className="prose-dan max-w-prose border-l-2 border-ember/40 pl-5 leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{show.body}</Markdown>
          </div>
        </Section>
      ) : null}

      {show.photos.length > 0 ? (
        <Section>
          <PhotoCarousel photos={show.photos} label={show.title} />
        </Section>
      ) : null}

      <Section>
        <Link
          to="/shows"
          className="readout group inline-flex items-center gap-2 border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-ember hover:bg-ember/10 hover:text-ember"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          All shows
        </Link>
      </Section>
    </PageShell>
  );
}
