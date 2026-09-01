import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Section } from "@/components/page";
import {
  CHART_MINIMUM,
  MIN_SCORE,
  MIXTAPE_SCORE,
  chartsFor,
  type Album,
  type Board,
  type BoardRow,
} from "@/lib/dan-fm";
import { MAX_SCORE } from "@/lib/dan-fm-summary";
import { cn } from "@/lib/utils";

/**
 * What the log adds up to: four boards of bars and one line.
 *
 * Drawn by hand rather than by a chart library. Everything here is a `div` over
 * a track and a `<polyline>`, a fraction of a kilobyte against the tens a
 * library costs on a page that is otherwise text - and a library would arrive
 * with a visual language of its own, of gridlines, legends and a palette of
 * series colours, none of which this site speaks.
 *
 * Every bar is ember, at whatever length its figure earns. Painting a poor
 * performer another colour would be a second signal for what the length already
 * says, and the site's other ink is reserved for machine output.
 */

/**
 * The box the score line is drawn in, in its own units.
 *
 * Small numbers scaled to the panel by the viewBox rather than measured: the
 * line has no layout of its own to wait for, and a chart that has to be
 * measured before it can be drawn is one that arrives at the wrong size first.
 */
const LINE_BOX = { width: 100, height: 30 };

/** Where a score sits in that box, with the top of the scale at the top. */
function heightOf(score: number): number {
  return ((MAX_SCORE - score) / (MAX_SCORE - MIN_SCORE)) * LINE_BOX.height;
}

/** Two decimals, which is finer than a pixel at any width this is drawn at. */
function trimmed(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * Every score in the log against the day it was given, oldest on the left.
 *
 * `preserveAspectRatio="none"` lets the box fill the panel at any width, which
 * distorts the geometry deliberately: neither axis is a length anybody measures
 * off the screen, and a line holding its ratio would be a stripe on a desktop.
 * `non-scaling-stroke` is what keeps the stroke a hairline through that.
 */
function ScoreLine({ scores }: { scores: number[] }) {
  // Divided by the gaps rather than the points, so the oldest score sits on the
  // left edge and the newest on the right. Floored at one, the only value that
  // could divide by zero.
  const gaps = Math.max(scores.length - 1, 1);
  const points = scores
    .map(
      (score, index) => `${trimmed((index / gaps) * LINE_BOX.width)},${trimmed(heightOf(score))}`,
    )
    .join(" ");

  const bar = heightOf(MIXTAPE_SCORE);

  return (
    <>
      <svg
        viewBox={`0 0 ${LINE_BOX.width} ${LINE_BOX.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          `Score for each of ${scores.length} albums, oldest first, on a scale of ` +
          `${MIN_SCORE} to ${MAX_SCORE}. Lowest ${Math.min(...scores)}, ` +
          `highest ${Math.max(...scores)}, newest ${scores[scores.length - 1]}.`
        }
        className="mt-5 h-32 w-full"
      >
        {/* The score the mixtape takes from, so the line is read against
            something rather than against an axis that is not drawn. */}
        <line
          x1={0}
          y1={bar}
          x2={LINE_BOX.width}
          y2={bar}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          className="stroke-border"
        />
        <polyline
          points={points}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-ember"
        />
      </svg>

      <p className="readout-dim mt-3">
        Scale {MIN_SCORE} to {MAX_SCORE} · dashed line is the mixtape's bar
      </p>
    </>
  );
}

/**
 * One board's panel, in the shape the stats board on `/vinyl` uses: a readout
 * label over whatever the board has to show.
 */
function Panel({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <div
      data-slot="chart-board"
      className={cn("bg-background p-5 sm:p-6", wide && "sm:col-span-2")}
    >
      <h3 className="readout-dim">{title}</h3>
      {children}
    </div>
  );
}

/**
 * One row: what it is called, what it scored or counted, and a bar of that
 * length.
 *
 * The figure is printed on every row rather than only drawn, so the bar is a
 * shape for reading the board at a glance instead of the only place a value
 * exists - which is also what lets the track behind it stay this quiet.
 */
function BarRow({ row, board }: { row: BoardRow; board: Board }) {
  const filled = board.top > 0 ? Math.min(row.value / board.top, 1) : 0;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-pretty">{row.name}</span>
        <span className="readout-dim shrink-0 tabular-nums">
          {board.kind === "average" ? `${row.value} from ${row.count}` : row.count}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 bg-border/60">
        <div className="h-full bg-ember" style={{ width: `${trimmed(filled * 100)}%` }} />
      </div>
    </li>
  );
}

/**
 * A board, or the line it prints in place of rows it has not earned.
 *
 * Saying so in its own panel rather than dropping out of the grid: a section
 * whose shape changes with the log leaves a returning reader looking for a
 * board that has not gone anywhere.
 */
function BoardPanel({ board }: { board: Board }) {
  return (
    <Panel title={board.title}>
      {board.rows.length > 0 ? (
        <ol className="mt-5 space-y-3">
          {board.rows.map((row) => (
            <BarRow key={row.name} row={row} board={board} />
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-muted-foreground">{board.empty}</p>
      )}

      {board.note ? <p className="readout-dim mt-4">{board.note}</p> : null}
    </Panel>
  );
}

export function DanFmCharts({ albums }: { albums: Album[] }) {
  if (albums.length < CHART_MINIMUM) {
    return (
      <Section title="Charts">
        {/* Counted down from the constant rather than named as a month, since
            the log misses days and a date would drift off the count. */}
        <EmptyState>
          {`Not enough albums to chart anything honest. ${CHART_MINIMUM - albums.length} to go.`}
        </EmptyState>
      </Section>
    );
  }

  const charts = chartsFor(albums);

  return (
    <Section
      title="Charts"
      action={
        charts.average === null ? undefined : (
          <p className="readout-dim">
            Average {charts.average} across {albums.length}
          </p>
        )
      }
    >
      {/* The hairline between panels is the gap, which is how `/vinyl` draws its
          board: one background behind a grid that leaves a pixel of it showing,
          rather than a border per panel doubling wherever two meet. */}
      <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
        <Panel title="Score, oldest first" wide>
          <ScoreLine scores={charts.line} />
        </Panel>

        {charts.boards.map((board) => (
          <BoardPanel key={board.id} board={board} />
        ))}
      </div>
    </Section>
  );
}
