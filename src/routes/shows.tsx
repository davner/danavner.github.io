import { ArrowUpRight, Flame, Music, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { BandList } from "@/components/band-list";
import { Marquee } from "@/components/marquee";
import { PageHeader, PageShell, Section } from "@/components/page";
import { DuoBadge } from "@/components/duo-badge";
import { Rating } from "@/components/rating";
import { SoloBadge } from "@/components/solo-badge";
import { Badge } from "@/components/ui/badge";
import {
  formatShowDate,
  isDuo,
  showsByYear,
  showStats,
  standouts,
  supportFor,
  type Show,
} from "@/lib/shows";
import { useDocumentMeta } from "@/lib/use-document-meta";

function ShowRow({ show }: { show: Show }) {
  const date = formatShowDate(show);
  const support = supportFor(show);
  const tags = [show.type === "festival" ? "Festival" : "", show.subtitle].filter(Boolean);

  const inside = [
    show.photos.length > 0
      ? `${show.photos.length} ${show.photos.length === 1 ? "photo" : "photos"}`
      : "",
    show.body ? "Notes" : "",
    show.setlists.length > 0 ? "Setlists" : "",
    show.video ? (show.videoIsPlaylist ? "Playlist" : "Video") : "",
  ].filter(Boolean);

  return (
    <li
      data-slot="show"
      className="cut-corners group relative grid gap-x-6 gap-y-3 border-b border-border px-3 py-7 transition-colors hover:bg-card/60 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,15rem)]"
    >
      {/* A year-only entry has no day label; the grid column keeps the
          alignment, so nothing needs to stand in for it. */}
      {date ? <p className="readout-dim tabular-nums">{date}</p> : <span />}

      <div>
        <h3 className="display flex items-center gap-3 text-2xl sm:text-3xl">
          <Link
            to={`/shows/${show.slug}`}
            className="inline-flex items-center gap-2 transition-colors group-hover:text-ember after:absolute after:inset-0"
          >
            {show.title}
            <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </Link>
          {show.standout ? (
            <Flame className="size-4 shrink-0 text-ember" aria-label="Standout" />
          ) : null}
        </h3>

        {tags.length > 0 || show.rating != null ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="ion">
                {tag}
              </Badge>
            ))}
            {show.rating != null ? <Rating value={show.rating} /> : null}
          </div>
        ) : null}

        {support.length > 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
            <span className="text-ember">w/</span> <BandList bands={support} />
          </p>
        ) : null}

        {show.bestSong ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Music className="size-3.5 shrink-0 text-ember" aria-hidden />
            <span>
              <span className="readout-dim">Best live</span> {show.bestSong}
            </span>
          </p>
        ) : null}

        {show.solo ? (
          <p className="mt-3">
            <SoloBadge />
          </p>
        ) : isDuo(show) ? (
          <p className="mt-3">
            <DuoBadge partner={show.companions[0]} />
          </p>
        ) : show.companions.length > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-3.5 shrink-0 text-ember" aria-hidden />
            <span>
              <span className="sr-only">Went with </span>
              {show.companions.join(", ")}
            </span>
          </p>
        ) : null}

        {/* Says what is behind the click, so the row is honest about having
            more rather than just ending. */}
        {inside.length > 0 ? (
          <p className="readout-dim mt-4">{inside.join(" · ")}</p>
        ) : null}
      </div>

      <div className="sm:text-right">
        {show.venue ? <p className="font-mono text-sm">{show.venue}</p> : null}
        <p className="readout-dim mt-1">{show.city}</p>
        {/* Capacity only means anything next to another capacity, so it lives
            in the list rather than only on the show's own page. */}
        {show.capacity ? (
          <p className="readout-dim mt-1">{show.capacity.toLocaleString("en-US")} cap</p>
        ) : null}
      </div>
    </li>
  );
}

export function Shows() {
  useDocumentMeta(
    "Shows",
    "A running log of every gig I have been to - who played, where, and how loud it got.",
  );

  if (showStats.total === 0) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Shows"
          title={
            <>
              <span className="block">Every show</span>
              <span className="display-outline-ember block">so far</span>
            </>
          }
          lede="Nothing logged yet. Give it a weekend."
        />
      </PageShell>
    );
  }

  // Candidates in priority order; a stat is only shown once it has something to
  // say, so an early log of one festival never renders "BANDS SEEN - 0".
  const stats: { label: string; value: ReactNode; show: boolean }[] = [
    { label: "Logged", value: String(showStats.total), show: true },
    { label: "Bands seen", value: String(showStats.bands), show: showStats.bands > 0 },
    {
      label: `Average (${showStats.ratedCount} rated)`,
      value:
        showStats.averageRating != null ? (
          <span className="flex flex-wrap items-center gap-2">
            {Number(showStats.averageRating.toFixed(1))}
            <Rating value={showStats.averageRating} size="sm" />
          </span>
        ) : null,
      show: showStats.averageRating != null,
    },
    showStats.mostSeen
      ? {
          label: `Most seen (${showStats.mostSeen.count}×)`,
          value: showStats.mostSeen.name,
          show: true,
        }
      : { label: "", value: null, show: false },
    { label: "Festivals", value: String(showStats.festivals), show: showStats.festivals > 0 },
    { label: "Solo runs", value: String(showStats.solo), show: showStats.solo > 0 },
    { label: "Venues", value: String(showStats.venues), show: showStats.venues > 0 },
    { label: "Cities", value: String(showStats.cities), show: showStats.cities > 0 },
    { label: "Since", value: showStats.firstYear ?? "", show: Boolean(showStats.firstYear) },
  ]
    .filter((stat) => stat.show)
    .slice(0, 4);

  return (
    <>
      <PageShell className="pb-0">
        <PageHeader
          eyebrow="Shows"
          title={
            <>
              <span className="block">Every show</span>
              <span className="display-outline-ember block">so far</span>
            </>
          }
          meta={[
            `${showStats.total} logged`,
            showStats.firstYear ? `Since ${showStats.firstYear}` : "",
            "Ears: negotiable",
          ].filter(Boolean)}
          lede="I keep a list. Mostly metalcore, occasionally something with clean vocals, and I am always somewhere near the front. Openers count too. Half the best sets I have seen went on at 7:15 to about forty people."
        />
      </PageShell>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-background p-5 sm:p-6">
              <dt className="readout-dim">{stat.label}</dt>
              <dd className="display mt-2 text-2xl text-balance sm:text-3xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {standouts.length > 0 ? (
        <div className="mt-16">
          <Marquee
            items={standouts.map((show) =>
              [show.title, show.venue || show.city].filter(Boolean).join(" - "),
            )}
            duration="28s"
            separator="🔥"
            className="text-ember"
          />
        </div>
      ) : null}

      <PageShell className="pt-16">
        {showsByYear.map((group, groupIndex) => (
          <Section
            key={group.year}
            title={group.year}
            index={String(groupIndex + 1).padStart(2, "0")}
            className={groupIndex === 0 ? "mt-0" : undefined}
            action={
              <span className="readout-dim">
                {group.shows.length} {group.shows.length === 1 ? "entry" : "entries"}
              </span>
            }
          >
            <ul className="border-t border-border">
              {group.shows.map((show) => (
                <ShowRow key={show.slug} show={show} />
              ))}
            </ul>
          </Section>
        ))}
      </PageShell>
    </>
  );
}
