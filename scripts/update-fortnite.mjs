#!/usr/bin/env node
/**
 * Refreshes the Fortnite stats in `src/content/fortnite.json`.
 *
 *   FORTNITE_API_KEY=... node scripts/update-fortnite.mjs
 *
 * Stats come from Fortnite-API (https://fortnite-api.com), which is free, has a
 * documented REST stats endpoint, and does not need an Epic login. Its stats
 * routes are the only ones behind a key; get one at https://dash.fortnite-api.com
 * and put it in the `FORTNITE_API_KEY` repository secret.
 *
 * Two things have to be true on Epic's side or the API answers 403 no matter
 * what this script does:
 *   1. The account name below exists.
 *   2. Its career stats are public - Fortnite > Settings > Account and Privacy >
 *      "Show on Career Leaderboard" on. Epic defaults this OFF.
 *
 * ## Why this accumulates rather than backfills
 *
 * The stats endpoint answers for two time windows: `lifetime`, and `season`
 * meaning *the season running right now*. There is no way to ask it for a
 * season that has already ended, so this job cannot reach into the past - a
 * season's numbers are gone from this API the moment it rolls over.
 *
 * So the archive is built rather than fetched. Every night this reads the
 * current season and writes it into `seasons` - and it files by identity, not
 * by date. A second, keyless endpoint says which season is live right now,
 * down to Epic's own sequential season number (`detectSeason` below), and that
 * number picks the calendar entry the snapshot is written under. Dates used to
 * decide, and the 2026-08 rollover showed why they cannot: the calendar had
 * not heard of the new season yet, so a night of Season 4 numbers was filed
 * over the finished Season 3 archive. When detection cannot say what season it
 * is, the job writes the lifetime numbers only and leaves every season bucket
 * alone - "not sure" never files.
 *
 * Seasons that ended before this job existed came from Epic's own service,
 * which does take an arbitrary window, via `scripts/backfill-fortnite.mjs`.
 * That one is run by hand and never by CI - see its header for why, and for the
 * bucket alignment that makes it much less obvious than passing two dates.
 * `source` on each entry records which of the two produced it.
 *
 * A failed or empty read writes NOTHING. The committed file is the durable
 * last-known-good value, so a bad night leaves yesterday's numbers showing
 * rather than blanking the page, and the workflow only commits when something
 * actually moved.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/** The Epic display name to read. */
const ACCOUNT = "danwiththeyams";

const ENDPOINT = "https://fortnite-api.com/v2/stats/br/v2";
const NEW_COSMETICS = "https://fortnite-api.com/v2/cosmetics/new";
const FILE = new URL("../src/content/fortnite.json", import.meta.url);

/**
 * The season calendar, in `src/content/fortnite-seasons.json`.
 *
 * It lives there rather than here because the page needs it too - the names,
 * date ranges and main outfits are what the season browser is built out of,
 * and two copies of a calendar is one copy too many. This job matches
 * tonight's detected season against it by `backendValue` (Epic's sequential
 * season number), falling back to the `ch<chapter>-s<season>` key for entries
 * that predate the stamp.
 *
 * ## Rollovers append their own entry
 *
 * When detection reports a season the calendar has never heard of, this job
 * prepends a bare entry - key, chapter, season, start, backendValue, no name
 * and no end - and closes the previous newest entry's `end`. A human fills in
 * the name and the main outfit later; `key` and `backendValue` are the
 * identity the stats are filed under and never change. For the first two days
 * of a new season the job also holds off writing season stats at all, because
 * the stats vendor was observed still serving the OLD season's window 25+
 * hours after the 2026-08 rollover - exactly the mix-up that corrupted the
 * ch7-s3 archive.
 */
const SEASONS_FILE = new URL("../src/content/fortnite-seasons.json", import.meta.url);

const key = process.env.FORTNITE_API_KEY;

/**
 * One time window from the API.
 *
 * Errors are thrown with the API's own message attached. The two that actually
 * happen are worth telling apart by hand: 403 is nearly always the privacy
 * setting rather than a bad key, and 404 is a name that does not exist.
 */
async function read(timeWindow) {
  const url = `${ENDPOINT}?name=${encodeURIComponent(ACCOUNT)}&accountType=epic&timeWindow=${timeWindow}`;
  const response = await fetch(url, { headers: { Authorization: key } });
  const body = await response.json().catch(() => null);

  if (response.status === 403) {
    throw new Error(
      `403 for "${ACCOUNT}". Either the API key is wrong, or the account's career stats are private - ` +
        `turn on "Show on Career Leaderboard" in Fortnite's account and privacy settings. ` +
        `API said: ${body?.error ?? "(no message)"}`,
    );
  }
  if (response.status === 404) {
    throw new Error(`404 - Fortnite-API has no account called "${ACCOUNT}"`);
  }
  if (!response.ok) {
    throw new Error(`${response.status} from Fortnite-API: ${body?.error ?? "(no message)"}`);
  }

  return body?.data ?? null;
}

/**
 * Which season is live right now, from Epic's own metadata rather than a
 * calendar.
 *
 * `/v2/cosmetics/new` is keyless and carries two independent statements of the
 * current season. Each new item's `introduction` names the chapter, the
 * season, and Epic's sequential season number (`backendValue`); the game build
 * the drop shipped in (`"++Fortnite+Release-42.00-CL-..."`) carries that same
 * sequential number as its major. The newest introduction is the season; the
 * build major is only corroboration, and the one thing it corroborates is
 * `date` - the drop's timestamp is the season's first day only while the drop
 * IS the season's opening drop, which is what major === backendValue attests.
 *
 * Returns `{ chapter, season, backendValue, buildDate }` - `chapter` and
 * `season` as digit strings, `buildDate` an ISO timestamp or null when the
 * build could not corroborate it. Returns null on ANY anomaly: a failed or
 * non-200 fetch, unparsable JSON, no `items.br` array, no usable
 * introductions, non-digit chapter or season strings, or a parsed build major
 * that CONTRADICTS the introductions - two signals disagreeing means neither
 * is trusted. This feeds a nightly job, so "not sure" is a value here, never a
 * throw.
 */
export async function detectSeason() {
  let payload;
  try {
    const response = await fetch(NEW_COSMETICS);
    if (!response.ok) return null;
    payload = await response.json();
  } catch {
    return null;
  }

  const items = payload?.data?.items?.br;
  if (!Array.isArray(items) || items.length === 0) return null;

  let top = null;
  for (const item of items) {
    const intro = item?.introduction;
    const value = Number(intro?.backendValue);
    if (!Number.isInteger(value) || value <= 0) continue;
    if (!top || value > Number(top.backendValue)) top = intro;
  }
  if (!top) return null;

  const chapter = String(top.chapter ?? "");
  const season = String(top.season ?? "");
  if (!/^\d+$/.test(chapter) || !/^\d+$/.test(season)) return null;
  const backendValue = Number(top.backendValue);

  let buildDate = null;
  const major = /Release-(\d+)/.exec(String(payload?.data?.build ?? ""))?.[1];
  if (major != null) {
    if (Number(major) !== backendValue) return null;
    const date = payload?.data?.date;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) buildDate = date;
  }

  return { chapter, season, backendValue, buildDate };
}

/** `isoDate` plus `days`, as a plain `YYYY-MM-DD` string. */
function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Which calendar entry tonight's season numbers belong to - matching the
 * detected season by identity, appending a calendar entry at a rollover, and
 * deciding whether the write is inside the rollover cool-down.
 *
 * Pure calendar logic, factored out of `main` so it can be exercised without
 * the stats API. Mutates `seasons` in place when it appends an entry or closes
 * the previous newest entry's `end`; `calendarChanged` on the result says the
 * file needs writing. `detection` must be non-null; `today` is `YYYY-MM-DD`.
 */
export function fileSeason(seasons, detection, today) {
  // A detection BEHIND the calendar is an API glitch, not a rollover - Epic's
  // season numbers only count up. Refuse to file rather than resurrect a
  // finished season's bucket.
  const maxStamp = seasons.reduce(
    (max, entry) =>
      Number.isInteger(entry.backendValue) ? Math.max(max, entry.backendValue) : max,
    0,
  );
  if (maxStamp > 0 && detection.backendValue < maxStamp) {
    return { outcome: "regressed", maxStamp };
  }

  let outcome = "matched";
  let stampHint = false;
  let entry = seasons.find((season) => season.backendValue === detection.backendValue);
  if (!entry) {
    entry = seasons.find((season) => season.key === `ch${detection.chapter}-s${detection.season}`);
    if (entry) stampHint = true;
  }

  let calendarChanged = false;
  let prevEndReplaced = null;
  let prevEndConflict = null;
  if (!entry) {
    // A season the calendar has never heard of: a rollover. Append the bare
    // facts and leave the name and outfit for a human - the page renders an
    // unnamed season fine, and mis-guessing a name would stick.
    const start = detection.buildDate ? detection.buildDate.slice(0, 10) : today;
    const previous = seasons.reduce(
      (newest, season) => (!newest || season.start > newest.start ? season : newest),
      null,
    );

    entry = {
      key: `ch${detection.chapter}-s${detection.season}`,
      chapter: `Chapter ${detection.chapter}`,
      season: `Season ${detection.season}`,
      start,
      backendValue: detection.backendValue,
      main: null,
    };
    seasons.unshift(entry);
    calendarChanged = true;
    outcome = "created";

    if (previous) {
      if (detection.buildDate) {
        // The build date is Epic's own statement of when the season began, so
        // it outranks a hand-scheduled `end` - this is the auto-correction.
        if (previous.end !== start) {
          if (previous.end != null) {
            prevEndReplaced = { key: previous.key, from: previous.end, to: start };
          }
          previous.end = start;
        }
      } else if (previous.end == null) {
        previous.end = start;
      } else if (previous.end !== start) {
        // Today is a guess and the hand-set end is a decision; a guess does
        // not overwrite a decision, it asks.
        prevEndConflict = { key: previous.key, end: previous.end, start };
      }
    }
  }

  /*
   * Rollover cool-down: for the first two days of a season, do not write
   * season stats at all. The window covers the observed +25h lag from the
   * 2026-08 incident, when the stats vendor kept serving the OLD season's
   * window after detection already said the new one. It is anchored to the
   * season's start, not the build date, because build dates move with every
   * mid-season patch. A hand-mistyped EARLY start can let one night of lagged
   * old-season numbers land in the new bucket; that self-heals the next night,
   * because every write replaces the whole cumulative bucket.
   */
  const cooldown = entry.start <= today && today < addDays(entry.start, 2);
  const futureStart = today < entry.start;

  return {
    outcome,
    entry,
    stampHint,
    calendarChanged,
    prevEndReplaced,
    prevEndConflict,
    cooldown,
    futureStart,
  };
}

const asNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * One playlist's numbers, trimmed to what the page shows.
 *
 * A mode the account has never played comes back as null rather than as zeroes,
 * and stays null here - "no duos this season" and "nothing but losses in duos"
 * are different facts and the page draws them differently.
 */
function mode(raw) {
  if (!raw || typeof raw !== "object") return null;

  const matches = asNumber(raw.matches);
  if (matches <= 0) return null;

  return {
    matches,
    wins: asNumber(raw.wins),
    kills: asNumber(raw.kills),
    deaths: asNumber(raw.deaths),
    // Rounded here rather than in the page so the committed file is the thing
    // being read, not a starting point for arithmetic in three components.
    kd: Number(asNumber(raw.kd).toFixed(2)),
    winRate: Number(asNumber(raw.winRate).toFixed(1)),
    killsPerMatch: Number(asNumber(raw.killsPerMatch).toFixed(2)),
    /*
     * Every placement tier, because each playlist size only tracks its own two
     * and the page shows whichever pair belongs to the playlist on screen.
     * Squad is 25 teams, so it counts top 3 and top 6 and reports a flat 0 for
     * top 10 - which read as "never once finished top ten in squads" on a page
     * that only knew about top10 and top25.
     */
    top3: asNumber(raw.top3),
    top5: asNumber(raw.top5),
    top6: asNumber(raw.top6),
    top10: asNumber(raw.top10),
    top12: asNumber(raw.top12),
    top25: asNumber(raw.top25),
    minutesPlayed: asNumber(raw.minutesPlayed),
    score: asNumber(raw.score),
    playersOutlived: asNumber(raw.playersOutlived),
  };
}

/** Every playlist for one time window, keyed the way the page tabs them. */
function snapshot(data) {
  const all = data?.stats?.all;
  if (!all) return null;

  const overall = mode(all.overall);
  if (!overall) return null;

  return {
    overall,
    solo: mode(all.solo),
    duo: mode(all.duo),
    trio: mode(all.trio),
    squad: mode(all.squad),
  };
}

async function main() {
  if (!key) {
    console.error("fortnite: FORTNITE_API_KEY is not set");
    process.exit(1);
  }

  const calendar = JSON.parse(await readFile(SEASONS_FILE, "utf8"));
  if (!Array.isArray(calendar.seasons) || calendar.seasons.length === 0) {
    throw new Error("src/content/fortnite-seasons.json lists no seasons");
  }

  const [lifetimeData, seasonData, detection] = await Promise.all([
    read("lifetime"),
    read("season"),
    detectSeason(),
  ]);

  const lifetime = snapshot(lifetimeData);
  if (!lifetime) {
    console.log("fortnite: no usable lifetime stats, keeping the committed value");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const previous = existsSync(FILE) ? JSON.parse(await readFile(FILE, "utf8")) : {};
  const seasons = Array.isArray(previous.seasons) ? [...previous.seasons] : [];

  // Where tonight's season numbers go - or that they go nowhere. Both refusals
  // still fall through to the lifetime write below, because stale season
  // buckets with fresh lifetime numbers beats a night with nothing.
  let filed = null;
  if (!detection) {
    console.log("fortnite: season detection unavailable, wrote lifetime stats only");
  } else {
    filed = fileSeason(calendar.seasons, detection, today);
    if (filed.outcome === "regressed") {
      console.error(
        `fortnite: detection reports season ${detection.backendValue} but the calendar has already ` +
          `seen ${filed.maxStamp} - an API glitch, not a rollover. Wrote lifetime stats only.`,
      );
      filed = null;
    }
  }

  if (filed) {
    const { entry } = filed;
    const label = `${entry.chapter} ${entry.season}`;

    if (filed.stampHint) {
      console.log(
        `fortnite: matched ${entry.key} by key - add "backendValue": ${detection.backendValue} ` +
          `to its calendar entry so the match is by identity`,
      );
    }
    if (filed.calendarChanged) {
      if (filed.prevEndReplaced) {
        const { key: prevKey, from, to } = filed.prevEndReplaced;
        console.log(`fortnite: corrected ${prevKey}'s scheduled end ${from} to ${to}`);
      }
      if (filed.prevEndConflict) {
        const { key: prevKey, end } = filed.prevEndConflict;
        console.warn(
          `fortnite: ${prevKey} has end ${end} but ${entry.key} started without a build date to ` +
            `confirm it - reconcile the two by hand`,
        );
      }
      await writeFile(SEASONS_FILE, `${JSON.stringify(calendar, null, 2)}\n`);
      console.log(
        `fortnite: new season - appended ${entry.key} (${label}, from ${entry.start}) to the calendar`,
      );
    }

    if (filed.futureStart) {
      console.warn(
        `fortnite: ${entry.key} starts ${entry.start}, which is after today - check the calendar`,
      );
    }
    if (filed.cooldown) {
      console.log(
        `fortnite: ${label} started ${entry.start} - holding its stats back until the vendor's ` +
          `season window has definitely rolled over`,
      );
    } else {
      const seasonStats = snapshot(seasonData);
      if (seasonStats) {
        const existing = seasons.findIndex((season) => season.key === entry.key);
        const record = {
          key: entry.key,
          // The season window is cumulative from the season's first day, so a
          // new bucket covers the season from its start - `first: today` would
          // print a false "Tracked from" caveat on the page. Existing buckets
          // keep the `first` they were created with.
          first: existing >= 0 ? seasons[existing].first : entry.start,
          fetched: today,
          source: existing >= 0 ? (seasons[existing].source ?? "fortnite-api") : "fortnite-api",
          stats: seasonStats,
        };
        if (existing >= 0) seasons[existing] = record;
        else seasons.push(record);
      } else {
        console.log(`fortnite: no matches yet in ${label}, leaving its entry alone`);
      }
    }
  }

  // Newest first, in the order the calendar declares rather than by date, so
  // the file reads the same way the page does.
  const order = new Map(calendar.seasons.map((season, index) => [season.key, index]));
  seasons.sort((a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity));

  const payload = {
    name: lifetimeData?.account?.name || ACCOUNT,
    accountId: lifetimeData?.account?.id || "",
    fetched: today,
    lifetime,
    seasons,
  };

  await writeFile(FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `fortnite: ${payload.name} - ${lifetime.overall.matches} lifetime matches, ` +
      `${seasons.length} season(s) on record`,
  );
}

// Guarded so `fileSeason` and `detectSeason` can be imported without a run -
// which is also how the rollover logic gets exercised, since it only fires on
// the one night a season actually turns over.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    // Loud, and a non-zero exit, so a broken key or a flipped privacy setting
    // shows up as a red workflow run rather than a page quietly going stale.
    console.error(`fortnite: ${error.message}`);
    process.exit(1);
  }
}
