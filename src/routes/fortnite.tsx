import { useSearchParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import { ScrollingText } from "@/components/scrolling-text";
import { SelectControl } from "@/components/select-control";
import {
  count,
  coverage,
  dateRange,
  delta,
  formatFetched,
  fortnite,
  isWindowKey,
  LIFETIME,
  MODES,
  placements,
  playedModes,
  playtime,
  seasons,
  windows,
  type Delta,
  type ModeId,
  type Main,
  type ModeStats,
  type SeasonEntry,
} from "@/lib/fortnite";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/use-document-meta";

/*
 * Two names, deliberately. The tab and the nav say "Fortnite", because that is
 * what someone is looking for in a list of links and what `site.ts` calls it -
 * `tests/site.spec.ts` holds the two together. The headline on the page is free
 * to be the joke.
 */
const TITLE = "Fortnite";
/** Solid, then outlined, the way every page title on the site is set. */
const HEADING = (
  <>
    <span className="block">Where we</span>
    <span className="display-outline-ember block">droppin’?</span>
  </>
);
const DESCRIPTION = "Wins, kills, and how good I am. Very. 1v1 me lol jk.";

/**
 * The four numbers worth reading first, in the order they answer "how is he
 * doing": did you win, how often, how many did you take, and how hard did you
 * have to work for it.
 *
 * `against` is the lifetime snapshot when a season is on screen, and the point
 * of the page: 42% is a number, and 42% against a lifetime 27% is a season.
 * Only the rates carry it. A season's win *count* is smaller than the lifetime
 * count by arithmetic rather than by form, and printing "-941 vs lifetime"
 * under it would be true and say nothing.
 */
function headline(stats: ModeStats, against: ModeStats | null) {
  return [
    { label: "Wins", value: count(stats.wins), delta: null },
    {
      label: "Win rate",
      value: `${stats.winRate.toFixed(1)}%`,
      delta: against ? delta(stats.winRate, against.winRate, 1, "pt") : null,
    },
    { label: "Kills", value: count(stats.kills), delta: null },
    {
      label: "K/D",
      value: stats.kd.toFixed(2),
      delta: against ? delta(stats.kd, against.kd, 2) : null,
    },
  ];
}

/**
 * The supporting numbers, which are context rather than headline.
 *
 * The placement tiles depend on the playlist, because the tiers do - see
 * `placements`. "All modes" gets none of them and shows four tiles instead of
 * six, which is the honest shape: there is no placement that means the same
 * thing across a 100-player solo and a 25-team squad lobby.
 */
function details(stats: ModeStats, against: ModeStats | null, mode: ModeId) {
  return [
    { label: "Matches", value: count(stats.matches), delta: null },
    {
      label: "Kills per match",
      value: stats.killsPerMatch.toFixed(2),
      delta: against ? delta(stats.killsPerMatch, against.killsPerMatch, 2) : null,
    },
    ...placements(mode).map((tier) => ({
      label: tier.label,
      value: count(stats[tier.field]),
      delta: null,
    })),
    {
      label: "Players outlived",
      value: count(stats.playersOutlived),
      delta: null,
    },
    { label: "Time played", value: playtime(stats.minutesPlayed), delta: null },
  ];
}

/**
 * One figure in the board. Same `dl` idiom the shows and vinyl stat tiles use -
 * a term and its number, hairlines drawn by the grid behind it.
 */
function Stat({
  label,
  value,
  against,
  big = false,
}: {
  label: string;
  value: string;
  against?: Delta | null;
  big?: boolean;
}) {
  return (
    <dl
      data-slot="stat"
      className="bg-background p-5 shadow-[0_0_0_1px_var(--color-border)] sm:p-6"
    >
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
      {against ? (
        <dd
          className={cn(
            "readout-dim mt-2",
            // Ember for better than lifetime, plain muted for worse. Colour is
            // not the only carrier - the sign is right there in the text - so
            // this stays readable with no colour vision at all.
            against.direction === "up" && "text-ember",
          )}
        >
          {against.text}
        </dd>
      ) : null}
    </dl>
  );
}

/**
 * The outfit as worn: its name, plus the style when that is a different look.
 *
 * "Jade" and "Voidburn Jade" are the same character and not the same picture,
 * and the render on the tile is the style rather than the default - so naming
 * only the outfit would caption the wrong thing.
 */
function mainLabel(main: Main): string {
  return main.style ? `${main.name}, ${main.style}` : main.name;
}

/** The outfit render, or the space one would take, at a given size. */
function MainPortrait({ season, className }: { season: SeasonEntry; className?: string }) {
  if (!season.main?.image) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted/40 p-4 text-center", className)}
      >
        <span className="readout-dim text-pretty">
          {season.main ? season.main.name : "No main on record"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={season.main.image}
      alt={`${season.main.name}, the outfit worn through ${season.label}`}
      loading="lazy"
      decoding="async"
      className={cn("bg-muted/40 object-contain", className)}
    />
  );
}

/**
 * Every season at once, as the outfit it got played in.
 *
 * The select above switches one season at a time, which is the right control
 * for reading a stat board and the wrong one for seeing the shape of two years.
 * This is the other half: the whole run in one view, each card a way back into
 * the board above it.
 */
function SeasonHistory({ active, onSelect }: { active: string; onSelect: (key: string) => void }) {
  return (
    <section aria-labelledby="mains" className="mt-16">
      <h2 id="mains" className="display text-2xl sm:text-3xl">
        Season by season
      </h2>
      <p className="readout-dim mt-2">The outfit I mained each season, oldest at the end.</p>

      {/*
        No `bg-border` behind this grid. Nine seasons in a four-wide grid leaves
        three empty cells on the last row, and a grid container is as tall and
        wide as its rows whether or not anything is in them - so the seam colour
        showing through `gap-px` painted a grey rectangle over the gap where the
        tenth, eleventh and twelfth cards would have been. The seams are drawn
        per card instead, by a 1px spread shadow that takes no layout space and
        lands on the same pixel its neighbour's does.
      */}
      <ul className="mt-6 grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-4">
        {seasons.map((season) => {
          const current = season.key === active;

          return (
            <li key={season.key} className="bg-background shadow-[0_0_0_1px_var(--color-border)]">
              <button
                type="button"
                onClick={() => onSelect(season.key)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex h-full w-full cursor-pointer flex-col text-left",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
                  current && "bg-ember/10",
                )}
              >
                {/* A fixed height rather than a square that fills the column.
                    Fortnite-API only publishes a style's render at 128px, so a
                    full-width square upscaled it about two and a half times and
                    every card looked soft. At `h-40` nothing is enlarged by
                    more than a quarter, and the outfits with no style variant
                    come down from 256 or 512 instead of up. */}
                <MainPortrait season={season} className="h-40 w-full" />

                <div className="flex flex-1 flex-col p-4">
                  <p className={cn("readout-dim", current && "text-ember")}>{season.label}</p>
                  <p className="display mt-1 text-lg text-balance">{season.name}</p>

                  {/* The outfit, in ember, pinned to the bottom so the line
                      sits level across a row however long the season's name
                      ran. It scrolls rather than truncating, because the half
                      that overflows is the half that varies - "Jade, Voidburn
                      Jade" and "Jade, Cursed Jade" are the same for sixteen
                      characters. Same treatment the record pressings and comic
                      publishers get. */}
                  {season.main ? (
                    <ScrollingText className="readout mt-auto pt-3 text-ember">
                      {mainLabel(season.main)}
                    </ScrollingText>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
  const activeKey = isWindowKey(requested) ? requested! : (windows[0]?.key ?? LIFETIME);
  const active = windows.find((window) => window.key === activeKey);

  const modes = active?.stats ? playedModes(active.stats) : [];
  const requestedMode = params.get("mode");
  const activeMode: ModeId =
    modes.find((mode) => mode.id === requestedMode)?.id ?? modes[0]?.id ?? "overall";

  const stats = active?.stats?.[activeMode] ?? null;

  /*
   * The lifetime figure for the same playlist, which is what a season's rates
   * are read against. Null on the lifetime tab itself, where the comparison
   * would be with itself, and null for a playlist lifetime has never seen -
   * that cannot happen while a season is a subset of lifetime, but it is one
   * `?mode=` away from being asked for.
   */
  const against =
    active?.season && fortnite.lifetime ? (fortnite.lifetime[activeMode] ?? null) : null;

  const update = (next: { season?: string; mode?: string }) => {
    const query = new URLSearchParams(params);
    for (const [name, value] of Object.entries(next)) {
      if (value) query.set(name, value);
      else query.delete(name);
    }
    setParams(query, { replace: false });
  };

  const selectSeason = (key: string) =>
    // The playlist is dropped on the way, because it belongs to the season it
    // was chosen in. Landing on a season that never played duos with `?mode=duo`
    // still in the URL would show the empty board rather than the season.
    update({ season: key === windows[0]?.key ? "" : key, mode: "" });

  const note = active?.season ? coverage(active.season) : null;

  return (
    <PageShell>
      <PageHeader
        title={HEADING}
        lede={DESCRIPTION}
        aside={
          fortnite.name ? (
            <div className="border border-border p-6">
              <p className="readout-dim">Epic name</p>
              <p className="display mt-2 text-3xl break-all sm:text-4xl">{fortnite.name}</p>
            </div>
          ) : undefined
        }
      />

      {/* Season first, then playlist. They are one control stack rather than
          two, and the season is the outer choice - it decides which playlists
          there are anything to show for. */}
      {windows.length > 1 ? (
        <SelectControl
          label="Season"
          value={activeKey}
          onChange={selectSeason}
          options={windows.map((window) => ({
            value: window.key,
            label: window.season ? `${window.label}: ${window.season.name}` : window.label,
          }))}
          className="mb-8 w-full sm:w-72"
        />
      ) : null}

      {/* What the numbers below cover. A line rather than the panel that used
          to appear and disappear as seasons were picked: it is always here, it
          always says something, and it does not move the page around. */}
      {active ? (
        <p data-slot="window-dates" className="readout-dim mb-6">
          {active.season ? dateRange(active.season) : "All time"}
        </p>
      ) : null}

      {!active || !stats ? (
        <EmptyState>
          {active?.season
            ? `No numbers on file for ${active.season.label} - nothing played, or nothing Epic ` +
              `still has. It is here for the run of dates and the outfit.`
            : `No stats yet. They arrive the first time the nightly job runs with an API key, and ` +
              `the account's career stats have to be public for Epic to hand them over at all.`}
        </EmptyState>
      ) : (
        <>
          {modes.length > 1 ? (
            <FilterToggle
              label="Playlist"
              value={activeMode}
              onChange={(value) => update({ mode: value === modes[0].id ? "" : value })}
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

          <section aria-label={`${MODES.find((mode) => mode.id === activeMode)?.label} stats`}>
            {/* Seams per tile rather than a `bg-border` behind the grid - a
                row that is not full would otherwise paint the gap grey, which
                is exactly what "All modes" does now that it shows four tiles
                instead of six. Same idiom as the season grid below. */}
            <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
              {headline(stats, against).map((tile) => (
                <Stat
                  key={tile.label}
                  label={tile.label}
                  value={tile.value}
                  against={tile.delta}
                  big
                />
              ))}
            </div>

            <div className="mt-px grid grid-cols-2 gap-px sm:grid-cols-3">
              {details(stats, against, activeMode).map((tile) => (
                <Stat key={tile.label} label={tile.label} value={tile.value} against={tile.delta} />
              ))}
            </div>
          </section>
        </>
      )}

      {seasons.length > 0 ? <SeasonHistory active={activeKey} onSelect={selectSeason} /> : null}

      {/* Where the numbers come from, and what each half of the archive can and
          cannot say. Small print, but the page is numbers and numbers without a
          provenance line invite more trust than they have earned. */}
      <p className="mt-16 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
        Read nightly from{" "}
        <a
          href="https://fortnite-api.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ember underline decoration-ember/40 underline-offset-4 hover:decoration-ember"
        >
          Fortnite-API
        </a>
        , which answers for lifetime and for the season running right now. The seasons behind it
        were filled in once from Epic's own stats service, which does take a date range, and they
        reconcile exactly: every one of the {count(fortnite.lifetime?.overall.matches ?? 0)}{" "}
        lifetime matches lands in one of them.
        {fortnite.fetched ? ` Read ${formatFetched(fortnite.fetched)}.` : ""}
      </p>
    </PageShell>
  );
}
