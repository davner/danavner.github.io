/**
 * Refreshes the record collection in `src/content/vinyl.json` from Discogs, and
 * the cover art in `public/img/vinyl/`.
 *
 * The site never talks to Discogs from the browser. Three reasons, in order of
 * how binding they are:
 *
 *   1. The folder split (whose record is it) and the collection value are both
 *      authenticated reads. Unauthenticated, `/collection/folders` returns only
 *      "All" and `/collection/value` returns nothing at all. A token cannot ship
 *      in a client bundle, so the interesting half of this page is impossible
 *      to build any other way.
 *   2. The site's one standing promise is that nothing phones home except the
 *      visitor counter - asserted in `tests/links.spec.ts`, claimed in the
 *      README. A live Discogs call from the page breaks both.
 *   3. Discogs rate-limits per IP and the cover CDN is theirs, not ours.
 *
 * So this runs nightly in CI (`.github/workflows/vinyl.yml`), the same shape as
 * `update-comics.mjs` and `update-fortnite.mjs`, and commits what it read.
 *
 * Failure is quiet on purpose. A failed collection read writes NOTHING, so the
 * previously committed payload stays and the page keeps showing the collection
 * it showed yesterday. The file only changes when the read actually succeeded,
 * which also means the nightly job commits only when something moved.
 *
 * Run it locally the same way CI does:
 *
 *   DISCOGS_TOKEN=... node scripts/update-vinyl.mjs
 *
 * Get a token at https://www.discogs.com/settings/developers ("Generate new
 * token"). It is a read of a public collection plus its private folder names -
 * no marketplace scope needed.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

/** The Discogs account whose collection this is. */
const USER = "dnafam";

/**
 * Discogs asks for a User-Agent that identifies the application and gives them
 * somewhere to look if it misbehaves. Requests without one are rejected.
 */
const USER_AGENT = "DanAvnerDotCom/1.0 +https://danavner.com";

/**
 * Authenticated requests are limited to 60 a minute. One a second stays well
 * under it without needing to think about bursts, and the whole run is a
 * background job where a couple of extra minutes costs nothing.
 */
const REQUEST_GAP_MS = 1100;

/** Cover art is rendered in a grid tile, so it never needs to be large. */
const COVER_PX = 500;

const OUT_JSON = new URL("../src/content/vinyl.json", import.meta.url);
const COVER_DIR = new URL("../public/img/vinyl/", import.meta.url);
/** Where the site serves what `COVER_DIR` holds. */
const COVER_PATH = "/img/vinyl";

const token = process.env.DISCOGS_TOKEN?.trim();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequest = 0;

/**
 * One Discogs request, paced and authenticated. Returns null rather than
 * throwing on anything that is not a clean 200 - every caller has a sensible
 * answer for "this piece is missing", and none of them should take down the
 * whole run.
 */
async function discogs(path) {
  const wait = REQUEST_GAP_MS - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
  if (token) headers.Authorization = `Discogs token=${token}`;

  try {
    const response = await fetch(`https://api.discogs.com${path}`, { headers });

    // 429 means the pacing above was not enough - back off once and retry,
    // rather than dropping a page out of the middle of the collection.
    if (response.status === 429) {
      console.warn(`vinyl: rate-limited on ${path}, waiting 60s`);
      await sleep(60_000);
      return discogs(path);
    }

    if (!response.ok) {
      console.warn(`vinyl: ${response.status} on ${path}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`vinyl: request failed on ${path}`, error);
    return null;
  }
}

/** Walks a paginated Discogs endpoint and returns every item under `key`. */
async function discogsPages(path, key) {
  const items = [];

  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await discogs(`${path}${separator}page=${page}&per_page=100`);
    if (!data) return null;

    items.push(...(data[key] ?? []));
    if (page >= (data.pagination?.pages ?? 1)) break;
  }

  return items;
}

/**
 * "Dan" out of the folder named "Dan", and a stable id to key the filter on.
 * Folder 0 is the built-in "All" and folder 1 the built-in "Uncategorized";
 * neither is a person, so neither becomes an owner.
 */
function asOwnerId(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Discogs disambiguates same-named artists with a numeric suffix - "Nirvana
 * (2)". That is a database detail and does not belong on a record sleeve.
 */
function cleanArtist(name) {
  return name.replace(/\s*\(\d+\)$/, "").trim();
}

/**
 * The credited artist, joined the way Discogs credits it: `join` carries the
 * literal connector between two names ("&", "Featuring", ","), so a split
 * release reads "Bilmuri & Kaonashi" rather than losing half its billing.
 */
function creditArtists(artists = []) {
  if (artists.length === 0) return "Unknown Artist";

  return artists
    .map((artist, index) => {
      const name = cleanArtist(artist.anv?.trim() || artist.name || "");
      if (index === artists.length - 1) return name;

      const join = (artist.join ?? "").trim();
      // A bare comma hugs the name before it; a word needs air on both sides.
      return join === "," || join === "" ? `${name},` : `${name} ${join}`;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How the record reads on a shelf: "LP", "2×LP", `7"`. Discogs splits this
 * across a format name, a quantity, and a pile of descriptors, and the size is
 * the only one of those anyone says out loud.
 */
function describeFormat(format) {
  if (!format) return "";

  const descriptions = format.descriptions ?? [];
  const size = descriptions.find((entry) => /^(LP|12"|10"|7"|Box Set)$/.test(entry));
  const base = size ?? format.name ?? "";

  const qty = Number(format.qty ?? 1);
  return qty > 1 ? `${qty}×${base}` : base;
}

/**
 * Downloads a cover, squares it off, and writes it as WebP. Existing files are
 * left alone, so the nightly run only fetches sleeves for records bought since
 * the last one.
 */
async function saveCover(releaseId, url) {
  const name = `${releaseId}.webp`;
  const file = new URL(name, COVER_DIR);
  if (existsSync(file)) return `${COVER_PATH}/${name}`;
  if (!url) return "";

  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      console.warn(`vinyl: cover ${response.status} for ${releaseId}`);
      return "";
    }

    const source = Buffer.from(await response.arrayBuffer());
    await sharp(source)
      // Sleeves are square, but Discogs scans are not always exactly so.
      // `cover` crops rather than letterboxing, which keeps the grid even.
      .resize(COVER_PX, COVER_PX, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toFile(fileURLToPath(file));

    return `${COVER_PATH}/${name}`;
  } catch (error) {
    console.warn(`vinyl: cover failed for ${releaseId}`, error);
    return "";
  }
}

/** Covers for records that have left the collection are no longer ours to keep. */
async function pruneCovers(keep) {
  const wanted = new Set(keep.map((record) => `${record.id}.webp`));
  const present = await readdir(COVER_DIR);

  for (const name of present) {
    if (name.endsWith(".webp") && !wanted.has(name)) {
      await unlink(new URL(name, COVER_DIR));
      console.log(`vinyl: pruned ${name}`);
    }
  }
}

async function main() {
  if (!token) {
    console.warn(
      "vinyl: no DISCOGS_TOKEN - the folder split and the value stats need one. Writing nothing.",
    );
    return;
  }

  await mkdir(COVER_DIR, { recursive: true });

  const folders = await discogs(`/users/${USER}/collection/folders`);
  if (!folders?.folders?.length) {
    throw new Error(
      "could not read the folder list. The committed collection stands, so the page is " +
        "showing whatever it last read.",
    );
  }

  // A collection instance lives in exactly one folder, so walking every folder
  // but the built-in "All" covers the collection once and tells us whose each
  // record is at the same time. Reading folder 0 instead would need a second
  // lookup to answer that.
  const owned = folders.folders.filter((folder) => folder.id !== 0);

  const owners = [];
  const records = [];

  for (const folder of owned) {
    const releases = await discogsPages(
      `/users/${USER}/collection/folders/${folder.id}/releases`,
      "releases",
    );
    if (!releases) {
      console.warn(
        `vinyl: could not read folder "${folder.name}", keeping the committed collection`,
      );
      return;
    }

    // "Uncategorized" is Discogs' inbox, not a person. Its records still count
    // as part of the collection, they just have no one to attribute them to.
    const isPerson = folder.id !== 1 && releases.length > 0;
    if (isPerson) {
      owners.push({ id: asOwnerId(folder.name), name: folder.name, count: releases.length });
    }

    for (const release of releases) {
      const info = release.basic_information ?? {};
      const format = info.formats?.[0];

      records.push({
        id: release.id,
        instanceId: release.instance_id,
        owner: isPerson ? asOwnerId(folder.name) : null,
        artist: creditArtists(info.artists),
        title: (info.title ?? "").trim(),
        year: Number(info.year) || null,
        label: (info.labels?.[0]?.name ?? "").replace(/\s*\(\d+\)$/, "").trim(),
        catno: (info.labels?.[0]?.catno ?? "").trim(),
        format: describeFormat(format),
        // The colour of the wax, when it is not black. Half the reason a
        // pressing is worth owning, and Discogs buries it in free text.
        variant: (format?.text ?? "").trim(),
        genres: info.genres ?? [],
        styles: info.styles ?? [],
        added: (release.date_added ?? "").slice(0, 10),
        rating: Number(release.rating) || 0,
        url: `https://www.discogs.com/release/${release.id}`,
        coverSource: info.cover_image ?? info.thumb ?? "",
      });
    }
  }

  /*
   * An empty read is a failed read, not an empty shelf. Discogs answering with
   * nothing for an account that has records means the request did not work, and
   * writing that out would replace the collection with an empty one.
   */
  if (records.length === 0) {
    throw new Error(
      "the collection came back empty. The committed collection stands, so the page is " +
        "showing whatever it last read.",
    );
  }

  console.log(`vinyl: ${records.length} records across ${owned.length} folders`);

  // Newest addition first, and the release id breaks ties so two records added
  // in the same batch keep a stable order between runs. Without that the JSON
  // would reshuffle nightly and every run would look like a change.
  records.sort((a, b) => b.added.localeCompare(a.added) || b.id - a.id);

  for (const record of records) {
    record.cover = await saveCover(record.id, record.coverSource);
    delete record.coverSource;
  }

  const missingCovers = records.filter((record) => !record.cover).length;
  if (missingCovers > 0) console.warn(`vinyl: ${missingCovers} records have no cover`);

  /*
   * What the shelf is worth, as Discogs values it. This is the only valuation
   * available: the per-release `/marketplace/price_suggestions` endpoint is
   * gated behind seller privileges and returns nothing for a buyer's account,
   * so there is no way to value one record, and therefore no way to value one
   * person's folder. The figures below cover the whole collection, and the page
   * has to say so rather than let them sit next to a filtered record count.
   *
   * Discogs returns them pre-formatted with a currency symbol ("$1,737.04"), so
   * they are carried through as strings rather than parsed into numbers and
   * formatted again - the account's own currency is already baked in.
   */
  const collectionValue = await discogs(`/users/${USER}/collection/value`);
  const value = {
    minimum: collectionValue?.minimum ?? "",
    median: collectionValue?.median ?? "",
    maximum: collectionValue?.maximum ?? "",
  };

  if (!value.median) console.warn("vinyl: no collection valuation came back");
  else console.log(`vinyl: valued at ${value.median} (${value.minimum} - ${value.maximum})`);

  const payload = {
    user: USER,
    url: `https://www.discogs.com/user/${USER}/collection`,
    /** UTC, so the line reads the same for everyone who sees it. */
    fetched: new Date().toISOString().slice(0, 10),
    value,
    owners: owners.sort((a, b) => b.count - a.count),
    records,
  };

  await pruneCovers(records);
  await writeFile(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`vinyl: wrote ${records.length} records to src/content/vinyl.json`);
}

try {
  await main();
} catch (error) {
  /*
   * Loud, and a non-zero exit, the same way the comics and Fortnite jobs fail.
   *
   * Warning and returning 0 makes a run that read nothing look exactly like a
   * run where the shelf had not changed: a green tick, no commit, and a page
   * quietly getting older. Committing the data is what makes staleness visible,
   * and it is not visible if the job reports success either way.
   */
  console.error(`vinyl: ${error.message}`);
  process.exit(1);
}
