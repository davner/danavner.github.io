import { useSearchParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import { SelectControl } from "@/components/select-control";
import {
  coverage,
  count,
  formatFetched,
  fortnite,
  isWindowKey,
  LIFETIME,
  MODES,
  playedModes,
  playtime,
  windows,
  type ModeId,
  type ModeStats,
} from "@/lib/fortnite";
import { useDocumentMeta } from "@/lib/use-document-meta";

const TITLE = "Fortnite";
const DESCRIPTION =
  "Wins, kills and the rate I actually land them, read from Fortnite-API nightly and kept season by season.";

/**
 * The four numbers worth reading first, in the order they answer "how is he
 * doing": did you win, how often, how many did you take, and how hard did you
 * have to work for it.
 */
function headline(stats: ModeStats) {
  return [
    { label: "Wins", value: count(stats.wins) },
    { label: "Win rate", value: `${stats.winRate.toFixed(1)}%` },
    { label: "Kills", value: count(stats.kills) },
    { label: "K/D", value: stats.kd.toFixed(2) },
  ];
}

/** The supporting numbers, which are context rather than headline. */
function details(stats: ModeStats) {
  return [
    { label: "Matches", value: count(stats.matches) },
    { label: "Kills per match", value: stats.killsPerMatch.toFixed(2) },
    { label: "Top 10", value: count(stats.top10) },
    { label: "Top 25", value: count(stats.top25) },
    { label: "Players outlived", value: count(stats.playersOutlived) },
    { label: "Time played", value: playtime(stats.minutesPlayed) },
  ];
}

/**
 * One figure in the board. Same `dl` idiom the shows and vinyl stat tiles use -
 * a term and its number, hairlines drawn by the grid behind it.
 */
function Stat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <dl data-slot="stat" className="bg-background p-5 sm:p-6">
      <dt className="readout-dim">{label}</dt>
      <dd
        className={
          big
            ? "display mt-2 text-3xl text-balance sm:text-5xl"
            : "display mt-2 text-2xl text-balance sm:text-3xl"
        }
      >
        {value}
      </dd>
    </dl>
  );
}

export function Fortnite() {
  useDocumentMeta(TITLE, DESCRIPTION);

  const [params, setParams] = useSearchParams();

  /*
   * Both selections live in the URL, the way the blog category and the vinyl
   * filters do, so a particular season and playlist is a link someone can send.
   * An unknown or stale key falls back rather than rendering nothing - a season
   * tab that has not been recorded yet is a link that used to work.
   */
  const requested = params.get("season");
  const activeKey = isWindowKey(requested)
    ? requested!
    : (windows[0]?.key ?? LIFETIME);
  const active = windows.find((window) => window.key === activeKey);

  const modes = active ? playedModes(active.stats) : [];
  const requestedMode = params.get("mode");
  const activeMode: ModeId =
    modes.find((mode) => mode.id === requestedMode)?.id ??
    modes[0]?.id ??
    "overall";

  const stats = active?.stats[activeMode] ?? null;

  const update = (next: { season?: string; mode?: string }) => {
    const query = new URLSearchParams(params);
    for (const [name, value] of Object.entries(next)) {
      if (value) query.set(name, value);
      else query.delete(name);
    }
    setParams(query, { replace: false });
  };

  const note = active?.season ? coverage(active.season) : null;

  return (
    <PageShell>
      <PageHeader
        title={TITLE}
        lede={DESCRIPTION}
        aside={
          fortnite.name ? (
            <div className="border border-border p-6">
              <p className="readout-dim">Epic name</p>
              <p className="display mt-2 text-3xl break-all sm:text-4xl">
                {fortnite.name}
              </p>
              {fortnite.fetched ? (
                <p className="readout-dim mt-4">
                  Read {formatFetched(fortnite.fetched)}
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {windows.length > 1 ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SelectControl
              label="Season"
              value={activeKey}
              onChange={(value) =>
                update({ season: value === windows[0].key ? "" : value })
              }
              options={windows.map((window) => ({
                value: window.key,
                label: window.label,
              }))}
              className="w-full sm:w-64"
            />
          </div>
        ) : null}
      </PageHeader>

      {!active || !stats ? (
        <EmptyState>
          No stats yet. They arrive the first time the nightly job runs with an
          API key, and the account's career stats have to be public for Epic to
          hand them over at all.
        </EmptyState>
      ) : (
        <>
          {modes.length > 1 ? (
            <FilterToggle
              label="Playlist"
              value={activeMode}
              onChange={(value) =>
                update({ mode: value === modes[0].id ? "" : value })
              }
              options={modes.map((mode) => ({
                value: mode.id,
                label: mode.label,
              }))}
              className="mb-8"
            />
          ) : null}

          {/* The caveat sits above the numbers rather than under them. A season
              this site started watching late is not a smaller season, and a
              reader who meets that fact after reading the board has already
              formed the wrong impression of it. */}
          {note ? <p className="readout-dim mb-6 text-ember">{note}</p> : null}

          <section
            aria-label={`${MODES.find((mode) => mode.id === activeMode)?.label} stats`}
          >
            <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
              {headline(stats).map((tile) => (
                <Stat
                  key={tile.label}
                  label={tile.label}
                  value={tile.value}
                  big
                />
              ))}
            </div>

            <div className="mt-px grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
              {details(stats).map((tile) => (
                <Stat key={tile.label} label={tile.label} value={tile.value} />
              ))}
            </div>
          </section>

          {/* Where the numbers come from, and what the season list can and
              cannot say. Small print, but the page is numbers and numbers
              without a provenance line invite more trust than they have earned. */}
          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
            Read nightly from{" "}
            <a
              href="https://fortnite-api.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ember underline decoration-ember/40 underline-offset-4 hover:decoration-ember"
            >
              Fortnite-API
            </a>
            . Its stats endpoint answers for lifetime and for the season running
            right now, and a season's numbers are gone from it once that season
            ends - so the seasons listed here go back as far as this site has
            been watching, and no further.
          </p>
        </>
      )}
    </PageShell>
  );
}
