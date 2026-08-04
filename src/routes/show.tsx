import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Flame,
  ListMusic,
  MapPin,
  Music,
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
import { isDuo, ordinal, shows, timesAtVenue, timesSeen } from "@/lib/shows";
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
  return [
    fullShowDate(show),
    show.venue,
    show.city ? (
      <span className="flex items-center gap-2">
        <MapPin className="size-4 shrink-0 text-ember" aria-hidden />
        {show.city}
      </span>
    ) : null,
  ].filter(Boolean);
}

/**
 * How big the room was and whether I had been there before. Measurements rather
 * than identity, so they sit with the tags instead of in the line that says
 * which show this is.
 */
function showMeasures(show: (typeof shows)[number]) {
  const nth = show.venue ? timesAtVenue(show) : 0;

  return [
    show.capacity ? `${show.capacity.toLocaleString("en-US")} cap` : "",
    nth > 1 ? `${ordinal(nth)} time here` : "",
  ].filter(Boolean);
}

function ShowBody({ show }: { show: (typeof shows)[number] }) {
  useDocumentMeta(show.title, showSummary(show));

  const facts = showFacts(show);
  const measures = showMeasures(show);
  const tags = [show.type === "festival" ? "Festival" : "", show.subtitle].filter(Boolean);

  return (
    <PageShell>
      <PageHeader title={show.title}>
        {/* This page is the target of every share link, so when someone opens
            it from a text message the date and the room are the first thing
            they need, and they are stated nowhere else on the page. */}
        <FactLine items={facts} className="mt-6" />

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="ion">
              {tag}
            </Badge>
          ))}
          {/* Outline rather than ion, so a measurement never reads as a label
              someone chose to put on the night. The building marks the room's
              size; a people icon would collide with the one that means the
              people who actually came. */}
          {measures.map((measure) => (
            <Badge key={measure} variant="outline" className="rounded-none border-border">
              {measure.endsWith("cap") ? <Building2 /> : null}
              {measure}
            </Badge>
          ))}
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
       * "Support" - so its own setlist and its own repeat count finally show.
       */}
      {show.lineup.length > 0 ? (
        <Section title="Lineup" index="01">
          <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {show.lineup.map((band) => {
              const nth = timesSeen(show, band);
              const setlist = show.setlists.find((entry) => entry.band === band);

              // Repeats are the interesting part of a log, so a band only gets
              // a marker once it is not the first time. Everything saying "1st
              // time" would just be noise.
              const inner = (
                <>
                  <span className="text-lg">{band}</span>
                  {nth > 1 ? (
                    <Badge
                      data-slot="band-repeat"
                      variant="outline"
                      size="sm"
                      className="shrink-0 rounded-none border-border"
                    >
                      {ordinal(nth)} time
                    </Badge>
                  ) : null}
                </>
              );

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
