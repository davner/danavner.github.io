/**
 * Refreshes the comics in `src/content/comics.json` from League of Comic Geeks,
 * and the covers in `public/img/comics/`.
 *
 * Same shape and the same reasoning as `scripts/update-vinyl.mjs`: the site's
 * one standing promise is that nothing phones home except the visitor counter,
 * asserted in `tests/links.spec.ts`, so this job is the only thing that talks to
 * League of Comic Geeks. It runs nightly in CI and commits what it read.
 *
 * ## Why this parses HTML rather than using a library
 *
 * League of Comic Geeks has no public API - not a documented one, not an
 * undocumented-but-stable one, nothing. Every option is somebody scraping the
 * site. The most recently maintained of those, `comicgeeks` on npm, was tried
 * first and is broken for two of the three lists this page needs: its parser
 * looks for `.comic-cover-art` and `.publisher.color-offset`, and the collection
 * and wish list pages stopped using either. It throws outright on both, and its
 * series parser returns an empty publisher.
 *
 * So this talks to the same endpoint the site's own front end does and parses
 * what comes back. That is not a smaller commitment than a library - it is the
 * same commitment, minus a dependency that has already drifted once and would
 * take the page down without warning when it drifts again.
 *
 * ## What is being read
 *
 * One endpoint, `/comic/get_comics`, which returns a JSON envelope with a `list`
 * of HTML. It serves two different markups and the difference is not signposted:
 *
 *   - `list=2` (collection) and `list=3` (wish list) return series cards, with
 *     the publisher in `.copy-really-small` and the cover under `.cover`.
 *   - `list=1` (pull list) returns issue rows, with the publisher in
 *     `.comic-details .publisher` and the cover under `.comic-cover-art`.
 *
 * Both are parsed defensively: every field is optional as far as this script is
 * concerned, because the one thing that is certain about scraped markup is that
 * it changes. A card missing its title is dropped; a card missing its price is
 * kept without one.
 *
 * ## Failure
 *
 * Quiet, on purpose, exactly like the vinyl job. A failed read writes NOTHING,
 * so the previously committed payload stays and the page keeps showing the
 * comics it showed yesterday. This matters more here than it does for Discogs,
 * because a scraper does not fail politely - it will one day return a page of
 * markup this file does not recognise, and the right outcome is a stale page and
 * a noisy log rather than an empty one.
 *
 * Run it locally the same way CI does:
 *
 *   node scripts/update-comics.mjs
 *
 * No token, no login. It reads a public profile, so the lists have to be public
 * in League of Comic Geeks' privacy settings or they come back empty.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import * as cheerio from "cheerio";
import { Impit } from "impit";
import sharp from "sharp";

const BASE = "https://leagueofcomicgeeks.com";
const LIST_ENDPOINT = `${BASE}/comic/get_comics`;

/** Covers render in a grid tile, so they never need to be large. Comics are 2:3. */
const COVER_W = 400;
const COVER_H = 600;

const ACCOUNTS = new URL("../src/content/accounts.json", import.meta.url);
const OUT_JSON = new URL("../src/content/comics.json", import.meta.url);
const COVER_DIR = new URL("../public/img/comics/", import.meta.url);
/** Where the site serves what `COVER_DIR` holds. */
const COVER_PATH = "/img/comics";

/*
 * League of Comic Geeks returns a Cloudflare challenge to anything that looks
 * like a script, so requests go out impersonating Chrome. This is the same
 * mechanism the `comicgeeks` package adopted in its 2026 release, and without it
 * every request here comes back as an interstitial rather than data.
 */
const impit = new Impit({ browser: "chrome" });

/** The list ids the endpoint uses. Not documented anywhere; read off the site. */
const LISTS = { pulls: 1, collection: 2, wishList: 3 };

/**
 * How many entries one response can hold, from `list_mode_limit` in the
 * endpoint's own echoed configuration.
 *
 * Nothing here is near it - the collection is tens of items - but a shelf that
 * passes it would otherwise come back silently truncated, which is the failure
 * this file cares most about avoiding. `list_mode_offset` is the only paging
 * control that actually works: `page`, `per_page`, `limit` and `offset` are all
 * accepted and ignored, so they are not worth reaching for.
 */
const PAGE_SIZE = 300;

/**
 * Long enough to be a well-behaved guest. There is no published rate limit
 * because there is no published anything, and the whole run is a background job
 * where a few extra seconds costs nothing.
 */
const REQUEST_GAP_MS = 1200;

let lastRequest = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const wait = REQUEST_GAP_MS - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  try {
    const response = await impit.fetch(url);
    if (!response.ok) {
      console.warn(`comics: ${response.status} on ${url}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`comics: request failed on ${url}`, error);
    return null;
  }
}

/**
 * The numeric id behind a username, which every list endpoint wants and no page
 * shows you. It sits on `#comic-list-block[data-user]` on the public profile.
 *
 * Resolved on every run rather than committed, so changing the username in
 * `src/content/accounts.json` is the only edit a rename needs.
 */
async function resolveUserId(username) {
  try {
    const response = await impit.fetch(`${BASE}/profile/${username.toLowerCase()}/pull-list`);
    if (!response.ok) {
      console.warn(`comics: ${response.status} looking up "${username}"`);
      return null;
    }

    const $ = cheerio.load(await response.text());
    const id = Number($("#comic-list-block").first().attr("data-user"));

    if (!Number.isInteger(id) || id <= 0) {
      console.warn(`comics: no user id on the profile page for "${username}"`);
      return null;
    }

    return id;
  } catch (error) {
    console.warn(`comics: could not resolve "${username}"`, error);
    return null;
  }
}

/** Collapses the whitespace that the server's templating leaves everywhere. */
function text(node) {
  return node.text().replace(/\s+/g, " ").trim();
}

/**
 * The Wednesday whose books are the current ones.
 *
 * New comic day is Wednesday, and `date_type=week` does not snap the date it is
 * given to a week - it treats it as the week's first day. Handing it today's
 * date therefore returns an empty list on six days out of seven, which looks
 * exactly like an empty pull list. Wind back to the most recent Wednesday
 * instead, so Thursday through Tuesday all report the week that is on the shelf.
 */
/*
 * A note on what "pull list" means here, because it means two things.
 *
 * `list=1` is the weekly pull: the issues shipping in one release week that are
 * pulled for you. It is what this reads, and it needs a date - without one it
 * returns nothing at all rather than everything.
 *
 * The other sense, the standing list of series you are subscribed to, lives at
 * `/profile/<user>/pull-list-subscriptions`. That page is not public: it comes
 * back as a 7KB stub for an anonymous request where `/collection` and
 * `/pull-list` both return ~100KB of real content. Reading it would mean
 * putting League of Comic Geeks credentials in CI, which is a much larger ask
 * than this page is worth, so the site says "This week" and means it.
 */
function releaseWeek(today = new Date()) {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // 3 is Wednesday; `+ 7) % 7` keeps the step forward-only on Sun, Mon and Tue.
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - 3 + 7) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Covers are served at several sizes under the same name. The list markup asks
 * for `medium-`; the grid wants the `large-` one. The cache-busting query is
 * dropped so the same cover does not download again every time it changes.
 */
function coverSource(raw) {
  if (!raw) return "";
  return raw.replace("/medium-", "/large-").split("?")[0];
}

/**
 * A series card, used by the collection and the wish list.
 *
 * `.copy-really-small` holds the publisher and the years as two sibling spans
 * separated by a `·`, which is why the years are taken positionally rather than
 * by a class - neither span has one.
 */
function parseSeriesCard($, el) {
  const element = $(el);
  const link = element.find(".cover a").first();

  const id = Number(link.attr("data-id"));
  const name = text(element.find(".title.color-primary"));
  if (!Number.isInteger(id) || !name) return null;

  const meta = element.find(".copy-really-small span");
  const href = link.attr("href") ?? "";
  const issues = Number(text(element.find(".details.count-issues")));

  return {
    id,
    name,
    publisher: text(meta.eq(0)),
    // "2026" or "2026 - Present", with the separator dot stripped off the front.
    years: text(meta.eq(1)).replace(/^·\s*/, ""),
    issues: Number.isInteger(issues) && issues > 0 ? issues : null,
    url: href ? `${BASE}${href}` : "",
    coverSource: coverSource(element.find(".cover img").attr("data-src")),
  };
}

/**
 * An issue row, used by the pull list. Different markup from a series card, and
 * the endpoint does not tell you which one it is about to send.
 */
function parseIssueRow($, el) {
  const element = $(el);

  const id = Number(element.attr("data-comic"));
  const title = element.find(".title.color-primary");
  const name = text(title);
  if (!Number.isInteger(id) || !name) return null;

  const details = element.find(".comic-details");
  const href = title.find("a").attr("href") ?? "";

  // A unix timestamp in an attribute, which is the only machine-readable date
  // on the row - the text beside it is "Aug 5th, 2026".
  const released = Number(details.find(".date").attr("data-date"));

  return {
    id,
    name,
    publisher: text(details.find(".publisher")),
    price: text(details.find(".price")),
    released: Number.isInteger(released)
      ? new Date(released * 1000).toISOString().slice(0, 10)
      : "",
    url: href ? `${BASE}${href}` : "",
    coverSource: coverSource(element.find(".comic-cover-art img").attr("data-src")),
  };
}

/**
 * Publisher totals, lifted from the filter dropdown the same response carries.
 *
 * Worth taking rather than counting the cards, because these are weighted by
 * issues owned while the cards are one per run - the endpoint says DC 24,
 * Marvel 10, IDW 7 against sixteen series. "Most of" means most comics, not
 * most runs, and only one of those two numbers is honest about that.
 */
function parsePublishers(html) {
  if (typeof html !== "string" || !html) return [];

  const $ = cheerio.load(html);

  return $("li.filter-options-publisher.option")
    .map((_, el) => {
      const element = $(el);
      const name = text(element.find(".option-name"));
      const count = Number(text(element.find(".badge")));
      if (!name || !Number.isInteger(count) || count <= 0) return null;
      return { name, count };
    })
    .get()
    .filter(Boolean)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Reads one list and parses it. Returns null on a failed read so the caller can
 * tell "nothing there" apart from "could not look", which decides whether the
 * committed payload gets replaced.
 *
 * Two things guard the parse rather than just the fetch:
 *
 *   - `count` says how many entries the response holds, so comparing it to what
 *     came out of the parser catches the markup moving under us. A request that
 *     succeeds and yields half a shelf is the failure mode a scraper actually
 *     has, and without this it would commit quietly.
 *   - A full page means there may be more behind it, so it pages on
 *     `list_mode_offset` until a short one comes back. Costs nothing until the
 *     shelf passes 300, at which point it is the difference between the whole
 *     collection and the first 300 of it.
 */
async function fetchList(label, params, parse) {
  const items = [];
  let publishers = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({ ...params, list_mode_offset: String(offset) });
    const data = await getJson(`${LIST_ENDPOINT}?${query}`);

    if (!data || typeof data.list !== "string") {
      console.warn(`comics: no list came back for ${label}`);
      return null;
    }

    const $ = cheerio.load(data.list);
    const parsed = $("li")
      .map((_, element) => parse($, element))
      .get()
      .filter(Boolean);

    // `count` is what this response holds, not the whole list - it drops to
    // match when an offset is in play - so it is checked per page.
    const claimed = Number(data.count);
    if (Number.isInteger(claimed) && parsed.length !== claimed) {
      console.warn(
        `comics: ${label} - parsed ${parsed.length} of the ${claimed} the response claims. ` +
          "The markup has moved; keeping the committed payload.",
      );
      return null;
    }

    if (offset === 0) publishers = parsePublishers(data.filters_publishers);
    items.push(...parsed);

    if (parsed.length < PAGE_SIZE) break;
    console.log(`comics: ${label} - full page at offset ${offset}, reading the next`);
  }

  console.log(`comics: ${label} - ${items.length} items`);
  return { items, publishers };
}

/**
 * Downloads a cover and writes it as WebP. Existing files are left alone, so a
 * nightly run only fetches art for comics added since the last one.
 */
async function saveCover(key, url) {
  const name = `${key}.webp`;
  const file = new URL(name, COVER_DIR);
  if (existsSync(file)) return `${COVER_PATH}/${name}`;
  if (!url) return "";

  try {
    const response = await impit.fetch(url);
    if (!response.ok) {
      console.warn(`comics: cover ${response.status} for ${key}`);
      return "";
    }

    const source = Buffer.from(await response.arrayBuffer());
    await sharp(source)
      // Comic covers are a consistent portrait ratio, so cropping to one keeps
      // the grid even without cutting into the art.
      .resize(COVER_W, COVER_H, { fit: "cover", position: "top" })
      .webp({ quality: 82 })
      .toFile(fileURLToPath(file));

    return `${COVER_PATH}/${name}`;
  } catch (error) {
    console.warn(`comics: cover failed for ${key}`, error);
    return "";
  }
}

/** Covers for comics that have left every list are no longer ours to keep. */
async function pruneCovers(keys) {
  const wanted = new Set([...keys].map((key) => `${key}.webp`));
  const present = await readdir(COVER_DIR);

  for (const name of present) {
    if (name.endsWith(".webp") && !wanted.has(name)) {
      await unlink(new URL(name, COVER_DIR));
      console.log(`comics: pruned ${name}`);
    }
  }
}

async function main() {
  const accounts = JSON.parse(await readFile(ACCOUNTS, "utf8"));
  const username = accounts.leagueOfComicGeeks?.trim();

  if (!username) {
    console.warn("comics: no `leagueOfComicGeeks` in accounts.json. Writing nothing.");
    return;
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    console.warn("comics: could not resolve the user, keeping the committed payload");
    return;
  }

  await mkdir(COVER_DIR, { recursive: true });

  const base = { user_id: userId, view: "list" };

  /*
   * Serial rather than concurrent, and paced. Three requests either way, but
   * firing them together is how a scraper announces itself, and this job has all
   * night to be polite.
   */
  const collection = await fetchList(
    "collection",
    { ...base, list: LISTS.collection, list_option: "series" },
    parseSeriesCard,
  );
  const wishList = await fetchList(
    "wish list",
    { ...base, list: LISTS.wishList, list_option: "series" },
    parseSeriesCard,
  );
  const pulls = await fetchList(
    "pull list",
    { ...base, list: LISTS.pulls, list_option: "thumbs", date: releaseWeek(), date_type: "week" },
    parseIssueRow,
  );

  /*
   * The collection is the page. Losing it means the read failed rather than the
   * shelf being empty, so nothing is written and yesterday's payload stands. The
   * other two are allowed to come back empty - an empty pull list is a real
   * state most weeks, and so is an empty wish list.
   */
  if (!collection) {
    console.warn("comics: could not read the collection, keeping the committed payload");
    return;
  }

  const series = collection.items.map((entry) => ({ ...entry, key: `series-${entry.id}` }));
  const wants = (wishList?.items ?? []).map((entry) => ({ ...entry, key: `want-${entry.id}` }));
  const pullList = (pulls?.items ?? []).map((entry) => ({ ...entry, key: `issue-${entry.id}` }));

  for (const entry of [...series, ...wants, ...pullList]) {
    entry.cover = await saveCover(entry.key, entry.coverSource);
    delete entry.coverSource;
  }

  const missing = [...series, ...wants, ...pullList].filter((entry) => !entry.cover).length;
  if (missing > 0) console.warn(`comics: ${missing} entries have no cover`);

  const payload = {
    user: username,
    url: `${BASE}/profile/${username}`,
    /** UTC, so the line reads the same for everyone who sees it. */
    fetched: new Date().toISOString().slice(0, 10),
    /** Weighted by issues owned, straight from the collection response. */
    publishers: collection.publishers,
    series,
    pullList,
    wants,
  };

  await pruneCovers(new Set([...series, ...wants, ...pullList].map((entry) => entry.key)));
  await writeFile(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `comics: wrote ${series.length} series, ${pullList.length} pulls, ${wants.length} wants`,
  );
}

await main();
