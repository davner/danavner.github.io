import {
  ArrowUpRight,
  Building2,
  Calendar,
  ChevronDown,
  Flame,
  MapPin,
  Music,
  Ticket,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { BandList } from "@/components/band-list";
import { Link } from "@/components/link";
import { PageHeader, PageShell } from "@/components/page";
import { DuoBadge } from "@/components/duo-badge";
import { Rating } from "@/components/rating";
import { SoloBadge } from "@/components/solo-badge";
import { Badge } from "@/components/ui/badge";
import {
  formatShowDate,
  isDuo,
  showsByYear,
  showStats,
  supportFor,
  type Show,
  type Tally,
} from "@/lib/shows";
import { catalogueLine, PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

const META = PAGE_META["/shows"];

function ShowRow({ show }: { show: Show }) {
  const date = formatShowDate(show);
  const support = supportFor(show);

  const inside = [
    show.photos.length > 0
      ? `${show.photos.length} ${show.photos.length === 1 ? "photo" : "photos"}`
      : "",
    show.body ? "Notes" : "",
    show.setlists.length > 0 ? "Setlists" : "",
    show.video ? (show.videoIsPlaylist ? "Playlist" : "Video") : "",
  ].filter(Boolean);

  return (
    /* Three columns at `md` rather than `sm`, which is the one thing `md` is
       sanctioned for. At 640 the card has 568px inside it, and the date column,
       the gaps and the duo chip claim 373 of that - so a venue column wide
       enough to hold "Riyadh Air Metropolitano" and a chip wide enough to name
       a partner cannot both fit, and the chip is the one that overhangs into the
       venue's band. Stacked until 768, where the middle column opens to 312px
       and the chip clears it by 82. */
    <li
      data-slot="show"
      className="cut-corners group relative grid gap-x-6 gap-y-3 border-b border-border px-3 py-7 transition-colors hover:bg-card/60 md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,15rem)]"
    >
      {/* A year-only entry has no day label; the grid column keeps the
          alignment, so nothing needs to stand in for it.

          `self-start` because the grid stretches this cell to the tallest
          column, and centring inside a stretched cell drops the date to the
          middle of the row. */}
      {date ? (
        <p className="readout-dim flex items-center gap-1.5 self-start tabular-nums">
          <Calendar className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {date}
        </p>
      ) : (
        <span />
      )}

      <div>
        <h3 className="display flex items-center gap-3 text-heading">
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

        {/* The tour, or which day of the festival - a subtitle to the name
            above it rather than a badge. It also wraps, which a badge does not:
            a long tour name would push the row off a 320px screen. */}
        {show.subtitle ? <p className="readout-dim mt-2 text-pretty">{show.subtitle}</p> : null}

        {show.type === "festival" || show.rating != null ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {show.type === "festival" ? <Badge variant="outline">Festival</Badge> : null}
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
            <Music className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
            <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="sr-only">Went with </span>
              {show.companions.join(", ")}
            </span>
          </p>
        ) : null}

        {/* Says what is behind the click, so the row is honest about having
            more rather than just ending. */}
        {inside.length > 0 ? <p className="readout-dim mt-4">{inside.join(" · ")}</p> : null}
      </div>

      {/* One glyph, one meaning, everywhere: calendar is when, building is the
          room, pin is where on a map, ticket is how many the room holds, and
          people means the people who actually came. */}
      <div className="space-y-1.5 md:text-right">
        {show.venue ? (
          <p className="flex items-center gap-1.5 font-mono text-sm md:justify-end">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {show.venue}
          </p>
        ) : null}
        <p className="readout-dim flex items-center gap-1.5 md:justify-end">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {show.city}
        </p>
        {/* Capacity only means anything next to another capacity, so it lives
            in the list rather than only on the show's own page. */}
        {show.capacity ? (
          <p className="readout-dim flex items-center gap-1.5 md:justify-end">
            <Ticket className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {show.capacity.toLocaleString("en-US")} cap
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * One column of the repeats board. The count sits in the display face so the
 * column scans as a ranking rather than as a list that happens to have numbers
 * after it.
 */
function RepeatList({
  slot,
  label,
  entries,
  unit,
  empty,
}: {
  /** `data-slot` hook, so a test can target one board without matching text. */
  slot: string;
  label: string;
  entries: Tally[];
  /** Singularised already; the "s" is added when the count is not one. */
  unit: string;
  empty: string;
}) {
  return (
    <div data-slot={slot} className="col-span-2 bg-background p-5 sm:p-6">
      <p className="readout-dim">{label}</p>

      {entries.length > 0 ? (
        <ol className="mt-5 space-y-3">
          {entries.map((entry) => (
            <li key={entry.name} className="flex items-baseline justify-between gap-4">
              <span className="text-lede text-pretty">{entry.name}</span>
              <span className="readout-dim shrink-0 tabular-nums">
                {entry.count} {unit}
                {entry.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export function Shows() {
  useDocumentMeta(META.title, META.description);

  if (showStats.total === 0) {
    return (
      <PageShell>
        <PageHeader
          catalogue={catalogueLine("/shows")}
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
            <Rating value={showStats.averageRating} />
          </span>
        ) : null,
      show: showStats.averageRating != null,
    },
    { label: "Festivals", value: String(showStats.festivals), show: showStats.festivals > 0 },
    { label: "Solo runs", value: String(showStats.solo), show: showStats.solo > 0 },
    { label: "Venues", value: String(showStats.venues), show: showStats.venues > 0 },
    { label: "Cities", value: String(showStats.cities), show: showStats.cities > 0 },
    { label: "Since", value: showStats.firstYear ?? "", show: Boolean(showStats.firstYear) },
  ]
    .filter((stat) => stat.show)
    .slice(0, 4);

  const hasRepeats = showStats.topBands.length > 0 || showStats.topVenues.length > 0;

  return (
    <>
      <PageShell className="pb-0">
        <PageHeader
          catalogue={catalogueLine("/shows")}
          title={
            <>
              <span className="block">Every show</span>
              <span className="display-outline-ember block">so far</span>
            </>
          }
          lede="I keep a list, call me Santa. Mostly emo, pop punk, and Alexis' favorite artists. I am always somewhere near the front. Openers count too. Some of the best sets I have seen went on first to about thirty people."
        />
      </PageShell>

      {/* The counts and the rankings are the same idea at two resolutions, so
          they share one block rather than the rankings taking a section and a
          heading of their own. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {stats.map((stat) => (
            <dl key={stat.label} className="bg-background p-5 sm:p-6">
              <dt className="readout-dim">{stat.label}</dt>
              <dd className="display mt-2 text-heading text-balance">{stat.value}</dd>
            </dl>
          ))}

          {hasRepeats ? (
            <>
              <RepeatList
                slot="seen-most"
                label="Seen most"
                entries={showStats.topBands}
                unit="time"
                empty="No band twice yet."
              />
              <RepeatList
                slot="been-most"
                label="Been most"
                entries={showStats.topVenues}
                unit="night"
                empty="No room twice yet."
              />
            </>
          ) : null}
        </div>
      </div>

      <PageShell className="pt-16">
        <section aria-labelledby="log">
          {/* Every row below is an `h3`, and the years above them are
              disclosure summaries rather than headings, so this is the only
              thing in the outline that says what the rows are. `sr-only`
              because the page title already says it in print. */}
          <h2 id="log" className="sr-only">
            The log
          </h2>

          {/* Each year is a collapsible accordion. The most recent year opens by
              default; older years start minimized so the log stays scannable. */}
          <div className="border-t border-border">
            {showsByYear.map((group, groupIndex) => (
              <details
                key={group.year}
                {...(groupIndex === 0 ? { open: true } : {})}
                className="group/year border-b border-border"
              >
                <summary className="group/sum flex cursor-pointer list-none items-center justify-between gap-6 py-4 select-none marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="display text-heading transition-colors group-hover/sum:text-ember">
                    {group.year}
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="readout-dim">
                      {group.shows.length} {group.shows.length === 1 ? "entry" : "entries"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-hover/sum:text-ember group-open/year:rotate-180" />
                  </span>
                </summary>
                <ul className="border-t border-border">
                  {group.shows.map((show) => (
                    <ShowRow key={show.slug} show={show} />
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      </PageShell>
    </>
  );
}
