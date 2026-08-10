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
 * The endpoint answers for two time windows: `lifetime`, and `season` meaning
 * *the season running right now*. There is no way to ask it for a season that
 * has already ended, so this job cannot reach into the past - a season's
 * numbers are gone from this API the moment it rolls over.
 *
 * So the archive is built rather than fetched. Every night this reads the
 * current season, and writes it into `seasons` under the key for whichever
 * season covers today. Seasons already in the file are carried through
 * untouched.
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

/** The Epic display name to read. */
const ACCOUNT = "danwiththeyams";

const ENDPOINT = "https://fortnite-api.com/v2/stats/br/v2";
const FILE = new URL("../src/content/fortnite.json", import.meta.url);

/**
 * The season calendar, hand-kept in `src/content/fortnite-seasons.json`.
 *
 * It lives there rather than here because the page needs it too - the names,
 * date ranges and main outfits are what the season browser is built out of, and
 * two copies of a calendar is one copy too many. This job needs it because the
 * stats endpoint does not say what season it just answered for: it returns
 * numbers and no label, so the snapshot is filed under whichever entry covers
 * the day it was taken.
 *
 * ## Add an entry there when a new season starts
 *
 * Miss one and nothing breaks or corrupts: the new season's matches keep
 * accruing into the previous entry until the line is added, because that is
 * still the newest season the calendar knows about. Fix it whenever you notice.
 */
const SEASONS_FILE = new URL(
  "../src/content/fortnite-seasons.json",
  import.meta.url,
);

const key = process.env.FORTNITE_API_KEY;
if (!key) {
  console.error("fortnite: FORTNITE_API_KEY is not set");
  process.exit(1);
}

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
    throw new Error(
      `${response.status} from Fortnite-API: ${body?.error ?? "(no message)"}`,
    );
  }

  return body?.data ?? null;
}

const asNumber = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

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

/** The season covering `today`, or the newest declared one if today is past it. */
function seasonFor(seasons, today) {
  const ordered = [...seasons].sort((a, b) => b.start.localeCompare(a.start));
  return ordered.find((season) => today >= season.start) ?? ordered[0];
}

async function main() {
  const calendar = JSON.parse(await readFile(SEASONS_FILE, "utf8"));
  if (!Array.isArray(calendar.seasons) || calendar.seasons.length === 0) {
    throw new Error("src/content/fortnite-seasons.json lists no seasons");
  }

  const [lifetimeData, seasonData] = await Promise.all([
    read("lifetime"),
    read("season"),
  ]);

  const lifetime = snapshot(lifetimeData);
  if (!lifetime) {
    console.log(
      "fortnite: no usable lifetime stats, keeping the committed value",
    );
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const current = seasonFor(calendar.seasons, today);
  const label = `${current.chapter} ${current.season}`;

  const previous = existsSync(FILE)
    ? JSON.parse(await readFile(FILE, "utf8"))
    : {};
  const seasons = Array.isArray(previous.seasons) ? [...previous.seasons] : [];

  const seasonStats = snapshot(seasonData);
  if (seasonStats) {
    const existing = seasons.findIndex((entry) => entry.key === current.key);
    const entry = {
      key: current.key,
      // Kept from the first sighting, so the page can say how much of a season
      // this history actually covers rather than implying it saw all of it.
      first: existing >= 0 ? seasons[existing].first : today,
      fetched: today,
      source:
        existing >= 0
          ? (seasons[existing].source ?? "fortnite-api")
          : "fortnite-api",
      stats: seasonStats,
    };
    if (existing >= 0) seasons[existing] = entry;
    else seasons.push(entry);
  } else {
    console.log(
      `fortnite: no matches yet in ${label}, leaving its entry alone`,
    );
  }

  // Newest first, in the order the calendar declares rather than by date, so
  // the file reads the same way the page does.
  const order = new Map(
    calendar.seasons.map((season, index) => [season.key, index]),
  );
  seasons.sort(
    (a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity),
  );

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

try {
  await main();
} catch (error) {
  // Loud, and a non-zero exit, so a broken key or a flipped privacy setting
  // shows up as a red workflow run rather than a page quietly going stale.
  console.error(`fortnite: ${error.message}`);
  process.exit(1);
}
