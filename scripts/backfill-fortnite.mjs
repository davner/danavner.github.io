#!/usr/bin/env node
/**
 * Backfills past seasons into `src/content/fortnite.json` from Epic directly.
 *
 *   EPIC_AUTHORIZATION_CODE=... node scripts/backfill-fortnite.mjs
 *   EPIC_ACCESS_TOKEN=...       node scripts/backfill-fortnite.mjs
 *   ... node scripts/backfill-fortnite.mjs --url        # where to get a code
 *   ... node scripts/backfill-fortnite.mjs --client=android
 *
 * ## Why this exists alongside `update-fortnite.mjs`
 *
 * Fortnite-API's stats route answers for two windows and no others: `lifetime`,
 * and the season running right now. That is what makes the nightly job an
 * accumulator - it can only record what is happening today.
 *
 * Epic's own service, which Fortnite-API wraps, takes an arbitrary window:
 *
 *   GET /statsproxy/api/statsv2/account/{accountId}?startTime=<unix>&endTime=<unix>
 *
 * ## The part that is easy to get wrong, and produces plausible nonsense
 *
 * Epic does not aggregate over the window you ask for. It compacts stats into
 * buckets and returns the buckets that fall **wholly inside** the window, and
 * the big ones are per season - a season's entire history collapses into a
 * single bucket whose far edge is the instant that season rolled over.
 *
 * So a window ending at midnight on the day the next season started does not
 * contain that bucket, and you get only the stray day buckets either side of
 * it. Chapter 6 Season 1 answers 42 matches to a midnight-bounded window and
 * 443 to one ending an hour after the real rollover. It does not error. It
 * answers a smaller number that looks like a season.
 *
 * Worse, windows are not additive when they are wrong: the nine seasons tiled
 * with midnight boundaries summed to 846 against a lifetime of 3765, and one
 * season came back with 64 matches and 113 wins.
 *
 * Hence `rollover` in `src/content/fortnite-seasons.json` - the measured
 * instant each season's bucket closes, found by sweeping `endTime` and binary
 * searching each jump. They land on the published rollover times (Chapter 6
 * Season 1 at 07:00 UTC on 21 February 2025, and so on), which is the
 * cross-check that they are real and not an artefact.
 *
 * ## Run this once, by hand, and never in CI
 *
 * Epic's endpoint needs an OAuth token, and the credential that would let a
 * scheduled job mint one - a device auth - can log in as you. That is a real
 * key to the account, not a scoped read-only token. A season that has ended is
 * a fixed set of numbers, so there is nothing for a nightly job to notice. Run
 * it, commit the JSON, let the short-lived token expire.
 *
 * ## Getting a token
 *
 * Run with `--url` for the address to open once logged in at epicgames.com. The
 * code it answers with is good for minutes and for one exchange; the token it
 * becomes lasts a couple of hours. Neither is written to disk.
 *
 * Epic retires its game clients without notice - `fortniteIOSGameClient` went
 * dead after Fortnite left the App Store - so the client is a flag. A code only
 * works for the client it was issued for, so switching means a new code.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const STATS = "https://statsproxy-public-service-live.ol.epicgames.com";
const ACCOUNT = "https://account-public-service-prod.ol.epicgames.com";

/**
 * Epic's game clients, as published in
 * https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation.
 *
 * `ios` is listed and refused on purpose: it is the one already disabled, and a
 * name that used to work is worth writing down so the next person does not
 * spend an authorization code finding out.
 */
const CLIENTS = {
  pc: {
    id: "ec684b8c687f479fadea3cb2ad83f5c6",
    secret: "e1f31c211f28413186262d37a13fc84d",
  },
  android: {
    id: "3f69e56c7649492c8cc29f1af08a8a12",
    secret: "b51ee9cb12234f50a69efa67ef53812e",
  },
  launcher: {
    id: "34a02cf8f4414e29b15921876da36f9a",
    secret: "daafbccc737745039dffe53d94fc76cf",
  },
  ios: {
    id: "3446cd72694c4a4485d81b77adbb2141",
    secret: "9209d4a5e25a457fb9b07489d313b41a",
    dead: "Epic disabled this one after Fortnite left the App Store",
  },
};

const STATS_FILE = new URL("../src/content/fortnite.json", import.meta.url);
const SEASONS_FILE = new URL("../src/content/fortnite-seasons.json", import.meta.url);

const args = process.argv.slice(2);
const clientName =
  args.find((arg) => arg.startsWith("--client="))?.slice("--client=".length) ?? "pc";

const client = CLIENTS[clientName];
if (!client) {
  console.error(
    `fortnite-backfill: no client called "${clientName}" - try ${Object.keys(CLIENTS).join(", ")}`,
  );
  process.exit(1);
}
if (client.dead) {
  console.error(`fortnite-backfill: --client=${clientName} - ${client.dead}`);
  process.exit(1);
}

const redirectUrl = `https://www.epicgames.com/id/api/redirect?clientId=${client.id}&responseType=code`;

if (args.includes("--url")) {
  console.log(
    `Log in at https://www.epicgames.com, then open:\n\n${redirectUrl}\n\n` +
      `Then: EPIC_AUTHORIZATION_CODE=<authorizationCode> node scripts/backfill-fortnite.mjs --client=${clientName}`,
  );
  process.exit(0);
}

/** An access token, from one directly or by spending an authorization code. */
async function token() {
  const existing = process.env.EPIC_ACCESS_TOKEN?.trim();
  if (existing) return existing;

  const code = process.env.EPIC_AUTHORIZATION_CODE?.trim();
  if (!code) {
    throw new Error(
      "set EPIC_AUTHORIZATION_CODE (or EPIC_ACCESS_TOKEN) - run with --url for where to get one",
    );
  }

  const basic = Buffer.from(`${client.id}:${client.secret}`).toString("base64");
  const response = await fetch(`${ACCOUNT}/account/api/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const said = body?.errorMessage ?? body?.error_description ?? "(no message)";
    const advice = /disabled/i.test(said)
      ? `Epic has retired --client=${clientName}. Try ${Object.keys(CLIENTS)
          .filter((name) => name !== clientName && !CLIENTS[name].dead)
          .map((name) => `--client=${name}`)
          .join(" or ")}, with a new code from --url - a code only works for ` +
        `the client it was issued for.`
      : `Codes expire in minutes and work once - if this one was spent, get a fresh one.`;

    throw new Error(`${response.status} exchanging the authorization code: ${said}. ${advice}`);
  }
  return body.access_token;
}

const unix = (iso) => Math.floor(Date.parse(iso) / 1000);

/** Epic's raw counters for one window. Either bound may be omitted. */
async function read(accountId, bearer, start, end) {
  const query = new URLSearchParams();
  if (start != null) query.set("startTime", String(start));
  if (end != null) query.set("endTime", String(end));

  const response = await fetch(
    `${STATS}/statsproxy/api/statsv2/account/${encodeURIComponent(accountId)}?${query}`,
    { headers: { Authorization: `bearer ${bearer}` } },
  );
  const body = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new Error("401 - the token is expired or was never valid");
  }
  if (response.status === 403) {
    throw new Error(
      "403 - Epic refused the account's stats. The career leaderboard setting has to be on, " +
        "the same as it does for the nightly job.",
    );
  }
  if (!response.ok) {
    throw new Error(`${response.status} from Epic: ${body?.errorMessage ?? "(no message)"}`);
  }

  return body?.stats ?? {};
}

/**
 * Which playlist keys roll up into which tab on the page.
 *
 * Not guessed. Epic ships upwards of sixty playlist names in one account's
 * history - ranked, zero build, reload, and a fresh crop of event playlists
 * every season - and a rule based on what the names look like ("ends in squad")
 * does not reproduce what Fortnite-API answers. This list does, and it was
 * derived by taking the lifetime window, whose split Fortnite-API had already
 * given us, and finding the set of playlists that sums to it exactly.
 *
 * Two things about it are worth knowing before touching it:
 *
 * - **Trios roll up into squad, and `trio` is always null.** That is
 *   Fortnite-API's own behaviour, not a mistake here: it reports `trio: null`
 *   for an account with 1,194 trio matches and counts every one of them under
 *   squad. Matching it is the point - the nightly job writes seasons through
 *   Fortnite-API, and a season would otherwise look different depending on
 *   which of the two scripts happened to write it.
 * - **Everything not listed counts towards `overall` only.** Ranked, reload and
 *   the event playlists are real matches inside the lifetime figure, so
 *   dropping them would make the seasons add up to less than the lifetime
 *   beside them. They are simply not a playlist the page tabs.
 */
const PLAYLISTS = {
  defaultsolo: "solo",
  nobuildbr_solo: "solo",
  bots_defaultsolo: "solo",
  bots_nobuildbr_solo: "solo",

  defaultduo: "duo",
  nobuildbr_duo: "duo",
  bots_defaultduo: "duo",
  bots_nobuildbr_duo: "duo",

  defaultsquad: "squad",
  nobuildbr_squad: "squad",
  bots_defaultsquad: "squad",
  bots_nobuildbr_squad: "squad",
  trios: "squad",
  nobuildbr_trio: "squad",
  bots_trios: "squad",
  bots_nobuildbr_trio: "squad",
};

const MODES = ["solo", "duo", "trio", "squad"];

/** The counters worth keeping, mapped from Epic's name to ours. */
const COUNTERS = {
  matchesplayed: "matches",
  placetop1: "wins",
  kills: "kills",
  minutesplayed: "minutesPlayed",
  score: "score",
  playersoutlived: "playersOutlived",
  // Every tier, because a playlist only counts the two that suit its team size:
  // 100 players solo tracks top 10 and top 25, 50 duos track top 5 and top 12,
  // 25 squads track top 3 and top 6. Keeping only the solo pair is what made
  // squad read "Top 10: 0" - true, and true of every squad player alive.
  placetop3: "top3",
  placetop5: "top5",
  placetop6: "top6",
  placetop10: "top10",
  placetop12: "top12",
  placetop25: "top25",
};

const blank = () => ({
  matches: 0,
  wins: 0,
  kills: 0,
  minutesPlayed: 0,
  score: 0,
  playersOutlived: 0,
  top3: 0,
  top5: 0,
  top6: 0,
  top10: 0,
  top12: 0,
  top25: 0,
});

/**
 * Epic's flat counters, summed into the shape the page reads.
 *
 * The derived figures are computed the way Fortnite-API computes them, so a
 * backfilled season and a nightly-recorded one are the same numbers arrived at
 * the same way. In particular a death is a match that was not won - Epic does
 * not count deaths, and this is the definition that reproduces the K/D the
 * lifetime figures were built with.
 */
function shape(raw) {
  // Gathered per playlist first, because whether a playlist counts at all is a
  // fact about the playlist - see the guard below.
  const byPlaylist = new Map();

  for (const [key, value] of Object.entries(raw)) {
    const match = /^br_(\w+?)_(?:keyboardmouse|gamepad|touch)_m0_playlist_(\w+)$/.exec(key);
    if (!match) continue;

    const field = COUNTERS[match[1]];
    if (!field) continue;

    const count = Number(value);
    if (!Number.isFinite(count)) continue;

    const playlist = match[2].toLowerCase();
    if (!byPlaylist.has(playlist)) byPlaylist.set(playlist, blank());
    byPlaylist.get(playlist)[field] += count;
  }

  const totals = { overall: blank() };
  for (const mode of MODES) totals[mode] = blank();

  for (const [playlist, sums] of byPlaylist) {
    /*
     * A playlist with no matches in this window contributes nothing to it, and
     * its other counters are not to be believed. Epic does return such
     * playlists: asked for Chapter 6 Season 4 it answered
     * `forbiddenfruitnobuildbrsquad` with 108 wins, no `matchesplayed` key and
     * no kills, which summed into a season of 64 matches and 113 wins.
     */
    if (sums.matches <= 0) continue;

    for (const field of Object.keys(sums)) totals.overall[field] += sums[field];

    const mode = PLAYLISTS[playlist];
    if (mode) {
      for (const field of Object.keys(sums)) totals[mode][field] += sums[field];
    }
  }

  /*
   * No fixing up of the placement tiers across modes.
   *
   * They used to be forced so that `overall` mirrored what Fortnite-API answers
   * - solo's top 10 and top 25 carried up, zeroes everywhere else - which was
   * only ever there to keep two writers agreeing on a figure. The page no
   * longer shows placements for "all modes" at all, because a top-3 in squads
   * and a top-10 in solos are not the same achievement and summing them says
   * nothing. Each mode now carries its own tiers, straight from Epic.
   */

  const finish = (sums) => {
    if (sums.matches <= 0) return null;

    const deaths = sums.matches - sums.wins;
    return {
      matches: sums.matches,
      wins: sums.wins,
      kills: sums.kills,
      deaths,
      // A window with no deaths would divide by zero. Fortnite-API answers the
      // kill count there, the only reading that does not overstate it.
      kd: Number((deaths > 0 ? sums.kills / deaths : sums.kills).toFixed(2)),
      winRate: Number(((sums.wins / sums.matches) * 100).toFixed(1)),
      killsPerMatch: Number((sums.kills / sums.matches).toFixed(2)),
      top3: sums.top3,
      top5: sums.top5,
      top6: sums.top6,
      top10: sums.top10,
      top12: sums.top12,
      top25: sums.top25,
      minutesPlayed: sums.minutesPlayed,
      score: sums.score,
      playersOutlived: sums.playersOutlived,
    };
  };

  const overall = finish(totals.overall);
  if (!overall) return null;

  return {
    overall,
    solo: finish(totals.solo),
    duo: finish(totals.duo),
    trio: finish(totals.trio),
    squad: finish(totals.squad),
  };
}

async function main() {
  if (!existsSync(STATS_FILE)) {
    throw new Error(
      "src/content/fortnite.json does not exist yet - run update-fortnite.mjs once first, " +
        "so there is an account id to backfill against",
    );
  }

  const stats = JSON.parse(await readFile(STATS_FILE, "utf8"));
  const table = JSON.parse(await readFile(SEASONS_FILE, "utf8"));

  const accountId = stats.accountId;
  if (!accountId) throw new Error("src/content/fortnite.json has no accountId");

  const bearer = await token();
  const today = new Date().toISOString().slice(0, 10);

  const calendar = [...table.seasons].sort((a, b) => a.start.localeCompare(b.start));

  /*
   * Read cumulatively and subtract, rather than asking for each season's own
   * window.
   *
   * Both edges of a window have to clear a bucket for it to be returned, and
   * the rollover instants are only known to the hour - so a window *starting*
   * at the previous rollover can land a few minutes inside the next season's
   * bucket and miss the whole thing. That is not hypothetical: asking per
   * season this way returned 6 matches for Chapter 6 Season 3 against its real
   * 461, and 2665 of 3765 overall.
   *
   * Every window here instead runs from the beginning of time to one rollover,
   * so only the right edge can be wrong, and a season is the difference between
   * two of them. Epic's counters are plain running totals, so subtracting them
   * key by key is exact.
   */
  const cumulative = [];
  for (const season of calendar) {
    // No `endTime` on the season still running - an open window is everything.
    const to = season.rollover ? unix(season.rollover) : null;
    cumulative.push(await read(accountId, bearer, null, to));
  }

  /** `later` minus `earlier`, key by key, treating a missing counter as zero. */
  const difference = (later, earlier) => {
    const out = {};
    for (const key of new Set([...Object.keys(later), ...Object.keys(earlier)])) {
      // `lastmodified` is a timestamp rather than a counter; subtracting it is
      // meaningless, and `shape` ignores it anyway.
      if (/^br_lastmodified_/.test(key)) continue;

      const value = Number(later[key] ?? 0) - Number(earlier[key] ?? 0);
      if (value > 0) out[key] = value;
    }
    return out;
  };

  const seasons = [];

  for (const [index, season] of calendar.entries()) {
    // The first season has no predecessor, so it carries anything played before
    // the calendar starts. On this account that is a single match.
    const raw = difference(cumulative[index], cumulative[index - 1] ?? {});
    const shaped = shape(raw);
    const label = `${season.chapter} ${season.season}`;

    if (!shaped) {
      console.log(`${season.key}: no matches in ${label}, skipping`);
      continue;
    }

    seasons.push({
      key: season.key,
      // The whole season, because the window is bounded by the instants Epic
      // opened and closed its bucket. Nothing is missing, so the page prints no
      // "tracked from" caveat.
      first: season.start,
      fetched: today,
      source: "epic",
      stats: shaped,
    });

    console.log(
      `${season.key}: ${label} - ${shaped.overall.matches} matches, ` +
        `${shaped.overall.wins} wins, ${shaped.overall.kills} kills`,
    );
  }

  /*
   * The seasons have to add up to the lifetime figure, and this is the check
   * that has to pass before anything is written.
   *
   * Every failure this script has had would have been caught here. Midnight
   * window boundaries summed to 846 against 3765 - a 78% shortfall that looked
   * entirely reasonable season by season, because each individual number was
   * plausible. There is no reading of "these are the seasons" under which they
   * do not reconstruct the lifetime total.
   *
   * The tolerance is for matches played before the first season in the
   * calendar, which belong to no entry and are legitimately missing.
   */
  const lifetime = stats.lifetime?.overall?.matches ?? 0;
  const counted = seasons.reduce((sum, s) => sum + s.stats.overall.matches, 0);
  const missing = lifetime - counted;

  if (lifetime > 0 && (missing < 0 || missing > lifetime * 0.02)) {
    throw new Error(
      `the seasons account for ${counted} of ${lifetime} lifetime matches (${missing} unexplained). ` +
        `Windows are almost certainly falling on the wrong side of a season bucket - check ` +
        `\`rollover\` in src/content/fortnite-seasons.json. Nothing was written.`,
    );
  }

  const order = new Map(table.seasons.map((season, index) => [season.key, index]));
  seasons.sort((a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity));

  /*
   * Lifetime is rewritten too, from the last cumulative read - an unbounded
   * window is lifetime by definition, so it costs no extra request.
   *
   * The nightly job owns this figure and will overwrite it from Fortnite-API,
   * which is fine because the two agree: Epic reproduces all 28 of the numbers
   * Fortnite-API reports, give or take a hundredth on one K/D. It is written
   * here so the file is consistent the moment this runs rather than the next
   * time the job fires - otherwise lifetime would be the one window missing the
   * placement tiers, and the squad board would read "Top 3: 0" until morning.
   */
  const lifetimeStats = shape(cumulative[cumulative.length - 1]) ?? stats.lifetime;

  await writeFile(
    STATS_FILE,
    `${JSON.stringify({ ...stats, lifetime: lifetimeStats, seasons }, null, 2)}\n`,
  );
  console.log(
    `\nfortnite-backfill: ${seasons.length} season(s), ${counted} of ${lifetime} ` +
      `lifetime matches accounted for`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`fortnite-backfill: ${error.message}`);
  process.exit(1);
}
