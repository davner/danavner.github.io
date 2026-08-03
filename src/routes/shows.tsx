import { Flame } from "lucide-react";

import { Marquee } from "@/components/marquee";
import { PageHeader, PageShell, Section } from "@/components/page";
import { formatShowDate, showsByYear, showStats, standouts, type Show } from "@/lib/shows";
import { useDocumentMeta } from "@/lib/use-document-meta";
import { cn } from "@/lib/utils";

function ShowRow({ show }: { show: Show }) {
  return (
    <li
      className={cn(
        "cut-corners group grid gap-x-6 gap-y-2 border-b border-border px-3 py-6 transition-colors hover:bg-card/60",
        "sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,16rem)] sm:items-baseline",
      )}
    >
      <p className="readout-dim tabular-nums">{formatShowDate(show.date)}</p>

      <div>
        <h3 className="display flex items-center gap-3 text-2xl transition-colors group-hover:text-ember sm:text-3xl">
          {show.headliner}
          {show.standout ? (
            <Flame className="size-4 shrink-0 text-ember" aria-label="Standout" />
          ) : null}
        </h3>

        {show.support?.length ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="text-ember">w/</span> {show.support.join(" · ")}
          </p>
        ) : null}

        {show.tour ? <p className="readout-dim mt-2">{show.tour}</p> : null}

        {show.note ? (
          <p className="mt-3 max-w-prose border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground italic text-pretty">
            {show.note}
          </p>
        ) : null}
      </div>

      <div className="sm:text-right">
        <p className="font-mono text-sm">{show.venue}</p>
        <p className="readout-dim mt-1">{show.city}</p>
      </div>
    </li>
  );
}

export function Shows() {
  useDocumentMeta(
    "Shows",
    "A running log of every gig I have been to — headliners, openers, venues, and how loud it got.",
  );

  const stats = [
    { label: "Shows", value: String(showStats.total) },
    { label: "Bands seen", value: String(showStats.bands) },
    { label: "Venues", value: String(showStats.venues) },
    showStats.mostSeen
      ? { label: `Most seen (${showStats.mostSeen.count}×)`, value: showStats.mostSeen.name }
      : { label: "Cities", value: String(showStats.cities) },
  ];

  if (showStats.total === 0) {
    return (
      <PageShell>
        <PageHeader eyebrow="Shows" title="Shows" lede="Nothing logged yet. Give it a weekend." />
      </PageShell>
    );
  }

  return (
    <>
      <PageShell className="pb-0">
        <PageHeader
          eyebrow="Shows"
          title="Shows"
          meta={[
            `${showStats.total} logged`,
            showStats.firstYear ? `Since ${showStats.firstYear}` : "",
            "Ears: negotiable",
          ].filter(Boolean)}
          lede="I keep a list. Mostly metalcore, occasionally something with clean vocals, always somewhere near the front. Openers count — half the best sets I have seen went on at 7:15 to forty people."
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
            items={standouts.map((show) => `${show.headliner} — ${show.venue}`)}
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
                {group.shows.length} {group.shows.length === 1 ? "show" : "shows"}
              </span>
            }
          >
            <ul className="border-t border-border">
              {group.shows.map((show) => (
                <ShowRow key={`${show.date}-${show.headliner}`} show={show} />
              ))}
            </ul>
          </Section>
        ))}

        <p className="readout-dim mt-16 border-t border-border pt-6">
          Log kept by hand in <span className="text-ember">src/content/shows.ts</span>
        </p>
      </PageShell>
    </>
  );
}
