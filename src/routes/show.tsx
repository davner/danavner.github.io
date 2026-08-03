import { ArrowLeft, Flame, ListMusic, Music, Users, Youtube } from "lucide-react";
import Markdown from "react-markdown";
import { Link, Navigate, useParams } from "react-router";
import remarkGfm from "remark-gfm";

import { BandList } from "@/components/band-list";
import { DuoBadge } from "@/components/duo-badge";
import { PageHeader, PageShell, Section } from "@/components/page";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Rating } from "@/components/rating";
import { ShareShow } from "@/components/share-show";
import { SoloBadge } from "@/components/solo-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fullShowDate, showSummary } from "@/lib/show-summary";
import { isDuo, shows, supportFor } from "@/lib/shows";
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

function ShowBody({ show }: { show: (typeof shows)[number] }) {
  useDocumentMeta(show.title, showSummary(show));

  const support = supportFor(show);
  const tags = [show.type === "festival" ? "Festival" : "", show.subtitle].filter(Boolean);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Show log"
        title={show.title}
        meta={[fullShowDate(show), show.venue, show.city].filter(Boolean)}
      >
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="ion">
              {tag}
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

        {show.setlists.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="readout-dim self-center text-xs" aria-hidden>
              Setlists
            </span>
            {show.setlists.map((set) => (
              <Button
                key={set.band}
                asChild
                variant="outline"
                size="sm"
                className="readout h-7 rounded-none px-2.5 text-xs text-muted-foreground hover:border-ember hover:text-ember"
              >
                <a
                  href={set.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${set.band} setlist on setlist.fm`}
                >
                  <ListMusic />
                  {set.band}
                </a>
              </Button>
            ))}
          </div>
        ) : null}
      </PageHeader>

      {support.length > 0 ? (
        <Section title={show.type === "festival" ? "Lineup" : "Support"} index="01">
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            <BandList bands={support} />
          </p>
        </Section>
      ) : null}

      {show.bestSong || show.solo || show.companions.length > 0 ? (
        <Section title="The night" index={support.length > 0 ? "02" : "01"}>
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
          className="readout group inline-flex items-center gap-2 border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-ember hover:text-ember"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          All shows
        </Link>
      </Section>
    </PageShell>
  );
}
