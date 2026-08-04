import { ArrowLeft, Check, Users, Utensils, X } from "lucide-react";
import Markdown from "react-markdown";
import { Link, Navigate, useParams } from "react-router";
import remarkGfm from "remark-gfm";

import { DuoBadge } from "@/components/duo-badge";
import { FactLine } from "@/components/fact-line";
import { PageHeader, PageShell, Section } from "@/components/page";
import { PhotoCarousel } from "@/components/photo-carousel";
import { SoloBadge } from "@/components/solo-badge";
import { Badge } from "@/components/ui/badge";
import {
  TRIP_LABEL,
  cityOf,
  countryList,
  formatTripDate,
  isDuo,
  nightsAway,
  trips,
} from "@/lib/trips";
import { useDocumentMeta } from "@/lib/use-document-meta";

/** One trip, on its own page. */
export function TripDetail() {
  const { slug } = useParams();
  const trip = trips.find((entry) => entry.slug === slug);

  // An unknown slug is a dead trip link, not a dead site - send it to the log.
  if (!trip) return <Navigate to="/trips" replace />;

  // Split so the not-found branch can return before any hook runs.
  return <TripBody trip={trip} />;
}

function summarise(trip: (typeof trips)[number]): string {
  const where = countryList(trip);
  return [`${formatTripDate(trip)}.`, where ? `${trip.stops.map(cityOf).join(", ")}.` : ""]
    .filter(Boolean)
    .join(" ");
}

function TripBody({ trip }: { trip: (typeof trips)[number] }) {
  useDocumentMeta(trip.title, summarise(trip));

  const nights = nightsAway(trip);

  // When it was and where it reached. The stops get their own section, so this
  // line names countries rather than repeating the whole itinerary.
  const facts = [formatTripDate(trip), countryList(trip)].filter(Boolean);

  let sectionIndex = 0;
  const nextIndex = () => String(++sectionIndex).padStart(2, "0");

  return (
    <PageShell>
      <PageHeader title={trip.title}>
        <FactLine items={facts} className="mt-6" />

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="ion">{TRIP_LABEL[trip.type]}</Badge>
          {nights ? (
            <Badge variant="outline" className="rounded-none border-border">
              {nights} {nights === 1 ? "night" : "nights"}
            </Badge>
          ) : null}
          {/* Only rendered once it has been decided. `null` is undecided, and
              printing "would not go back" for a trip you have not thought about
              yet would put words in your mouth. */}
          {trip.wouldGoBack != null ? (
            <Badge variant={trip.wouldGoBack ? "ember" : "outline"}>
              {trip.wouldGoBack ? <Check /> : <X />}
              {trip.wouldGoBack ? "Would go back" : "Been, done"}
            </Badge>
          ) : null}
        </div>

        {trip.solo ? (
          <p className="mt-7">
            <SoloBadge />
          </p>
        ) : isDuo(trip) ? (
          <p className="mt-7">
            <DuoBadge partner={trip.companions[0]} />
          </p>
        ) : trip.companions.length > 0 ? (
          <p className="mt-7 flex items-center gap-2 text-muted-foreground">
            <Users className="size-4 shrink-0 text-ember" aria-hidden />
            <span>
              <span className="sr-only">Went with </span>
              {trip.companions.join(", ")}
            </span>
          </p>
        ) : null}
      </PageHeader>

      <Section title="Where we went" index={nextIndex()}>
        {/* An ordered list, because the order is the route. The arrow is
            decorative - the numbering already carries the sequence for anyone
            not looking at it. */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 text-lg">
          {trip.stops.map((stop, index) => (
            <li key={stop} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-ember" aria-hidden>
                  →
                </span>
              ) : null}
              <span className="whitespace-nowrap">{cityOf(stop)}</span>
            </li>
          ))}
        </ol>
      </Section>

      {trip.highlights.length > 0 ? (
        <Section title="Highlights" index={nextIndex()}>
          <ul className="max-w-prose space-y-3">
            {trip.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-3 text-muted-foreground">
                <span className="mt-2.5 size-1.5 shrink-0 bg-ember" aria-hidden />
                <span className="text-pretty">{highlight}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {trip.oneThing || trip.bestMeal ? (
        <Section title="Worth saying" index={nextIndex()}>
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
            {trip.oneThing ? (
              <div className="bg-background p-6 sm:p-8">
                <p className="readout text-ember">The one thing</p>
                <p className="mt-3 text-lg leading-relaxed text-pretty">{trip.oneThing}</p>
              </div>
            ) : null}
            {trip.bestMeal ? (
              <div className="bg-background p-6 sm:p-8">
                <p className="readout flex items-center gap-2 text-ember">
                  <Utensils className="size-3.5" aria-hidden />
                  Best meal
                </p>
                <p className="mt-3 text-lg leading-relaxed text-pretty">{trip.bestMeal}</p>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {trip.body ? (
        <Section>
          <div className="prose-dan max-w-prose border-l-2 border-ember/40 pl-5 leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{trip.body}</Markdown>
          </div>
        </Section>
      ) : null}

      {trip.photos.length > 0 ? (
        <Section>
          <PhotoCarousel photos={trip.photos} label={trip.title} />
        </Section>
      ) : null}

      <Section>
        <Link
          to="/trips"
          className="readout group inline-flex items-center gap-2 border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-ember hover:bg-ember/10 hover:text-ember"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          All trips
        </Link>
      </Section>
    </PageShell>
  );
}
