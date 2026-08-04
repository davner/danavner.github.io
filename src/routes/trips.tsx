import { ArrowUpRight, MapPin, Quote, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { DuoBadge } from "@/components/duo-badge";
import { PageHeader, PageShell, Section } from "@/components/page";
import { SoloBadge } from "@/components/solo-badge";
import { Badge } from "@/components/ui/badge";
import {
  TRIP_LABEL,
  cityOf,
  countryList,
  formatTripDate,
  isDuo,
  nightsAway,
  tripStats,
  tripsByYear,
  type Trip,
} from "@/lib/trips";
import { useDocumentMeta } from "@/lib/use-document-meta";

function TripRow({ trip }: { trip: Trip }) {
  const nights = nightsAway(trip);

  // Says what is behind the click, so a row is honest about having more rather
  // than just ending. Same contract as a show row.
  const inside = [
    trip.photos.length > 0
      ? `${trip.photos.length} ${trip.photos.length === 1 ? "photo" : "photos"}`
      : "",
    trip.highlights.length > 0 ? "Highlights" : "",
    trip.body ? "Notes" : "",
  ].filter(Boolean);

  return (
    <li
      data-slot="trip"
      className="cut-corners group relative grid gap-x-6 gap-y-3 border-b border-border px-3 py-7 transition-colors hover:bg-card/60 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,13rem)]"
    >
      <p className="readout-dim">{formatTripDate(trip)}</p>

      <div>
        <h3 className="display flex items-center gap-3 text-2xl sm:text-3xl">
          <Link
            to={`/trips/${trip.slug}`}
            className="inline-flex items-center gap-2 transition-colors group-hover:text-ember after:absolute after:inset-0"
          >
            {trip.title}
            <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </Link>
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="ion">{TRIP_LABEL[trip.type]}</Badge>
          {nights ? (
            <Badge variant="outline" className="rounded-none border-border">
              {nights} {nights === 1 ? "night" : "nights"}
            </Badge>
          ) : null}
        </div>

        {/* `items-start` rather than centred - the one thing is a sentence and
            wraps to three lines on a phone, which would leave the icon floating
            beside the middle of the paragraph. */}
        {trip.oneThing ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <Quote className="mt-0.5 size-3.5 shrink-0 text-ember" aria-hidden />
            <span>
              <span className="readout-dim">The one thing</span> {trip.oneThing}
            </span>
          </p>
        ) : null}

        {trip.solo ? (
          <p className="mt-3">
            <SoloBadge />
          </p>
        ) : isDuo(trip) ? (
          <p className="mt-3">
            <DuoBadge partner={trip.companions[0]} />
          </p>
        ) : trip.companions.length > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-3.5 shrink-0 text-ember" aria-hidden />
            <span>
              <span className="sr-only">Went with </span>
              {trip.companions.join(", ")}
            </span>
          </p>
        ) : null}

        {inside.length > 0 ? <p className="readout-dim mt-4">{inside.join(" · ")}</p> : null}
      </div>

      <div className="space-y-1.5 sm:text-right">
        {/* Cities rather than the full "City, Country" strings - the countries
            are named right under them, and repeating them reads as stutter. */}
        <p className="font-mono text-sm">{trip.stops.map(cityOf).join(" → ")}</p>
        <p className="readout-dim flex items-center gap-1.5 sm:justify-end">
          <MapPin className="size-3.5 shrink-0 text-ember" aria-hidden />
          {countryList(trip)}
        </p>
      </div>
    </li>
  );
}

export function Trips() {
  useDocumentMeta(
    "Trips",
    "Where I have been and who I went with - photos, highlights, and the one thing worth telling someone about each trip.",
  );

  if (tripStats.total === 0) {
    return (
      <PageShell>
        <PageHeader
          title={
            <>
              <span className="block">Been</span>
              <span className="display-outline-ember block">places</span>
            </>
          }
          lede="Nothing logged yet. Give it a long weekend."
        />
      </PageShell>
    );
  }

  // Candidates in priority order; a stat only shows once it has something to
  // say, so a log of one trip never renders "COUNTRIES - 0".
  const stats: { label: string; value: ReactNode; show: boolean }[] = [
    { label: "Trips", value: String(tripStats.total), show: true },
    { label: "Countries", value: String(tripStats.countries), show: tripStats.countries > 0 },
    { label: "Cities", value: String(tripStats.cities), show: tripStats.cities > 0 },
    { label: "Nights away", value: String(tripStats.nights), show: tripStats.nights > 0 },
    { label: "Solo runs", value: String(tripStats.solo), show: tripStats.solo > 0 },
    { label: "Since", value: tripStats.firstYear ?? "", show: Boolean(tripStats.firstYear) },
  ]
    .filter((stat) => stat.show)
    .slice(0, 4);

  return (
    <>
      <PageShell className="pb-0">
        <PageHeader
          title={
            <>
              <span className="block">Been</span>
              <span className="display-outline-ember block">places</span>
            </>
          }
          lede="Somewhere new when we can, somewhere warm when we cannot. No ratings here - a trip is not the kind of thing you score. Just where we went, who came, and what stuck."
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

      <PageShell className="pt-16">
        {tripsByYear.map((group, groupIndex) => (
          <Section
            key={group.year}
            title={group.year}
            index={String(groupIndex + 1).padStart(2, "0")}
            className={groupIndex === 0 ? "mt-0" : undefined}
            action={
              <span className="readout-dim">
                {group.trips.length} {group.trips.length === 1 ? "trip" : "trips"}
              </span>
            }
          >
            <ul className="border-t border-border">
              {group.trips.map((trip) => (
                <TripRow key={trip.slug} trip={trip} />
              ))}
            </ul>
          </Section>
        ))}
      </PageShell>
    </>
  );
}
