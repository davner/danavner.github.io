#!/usr/bin/env node
/**
 * Downloads the character render for each season's main outfit.
 *
 *   node scripts/fetch-fortnite-skins.mjs
 *
 * Reads `main.name` from every season in `src/content/fortnite-seasons.json`,
 * resolves it against Fortnite-API's cosmetics catalogue, and writes the render
 * to `public/img/fortnite/`. The resolved cosmetic id and the image path are
 * written back into the season file, so the committed content records exactly
 * which outfit a name resolved to rather than leaving it to be guessed later.
 *
 * The cosmetics routes are the free half of Fortnite-API - no key, unlike the
 * stats routes - so this needs nothing configured to run.
 *
 * ## Run it when a season's main changes, not on a schedule
 *
 * The renders are committed. Nothing on the site fetches them at runtime, which
 * is the same rule the record sleeves and comic covers follow: the page must
 * render with no third party reachable. A season's main outfit is also a fact
 * that stops changing the moment the season ends, so there is nothing for a
 * nightly job to notice.
 *
 * ## Why this does not go through `optimize-photos.mjs`
 *
 * That script exists to strip EXIF off phone photos and re-encode them as JPEG.
 * Neither applies. These come from an API with no metadata to leak, and JPEG has
 * no alpha channel - a character render is a cutout on transparency, and
 * flattening it would put a white box behind every outfit on the page.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

const SEASONS = new URL(
  "../src/content/fortnite-seasons.json",
  import.meta.url,
);
const OUT_DIR = new URL("../public/img/fortnite/", import.meta.url);

/**
 * Long edge, in pixels. The render is shown at roughly 200px on the page and
 * twice that on a retina screen; the rest is weight for nothing.
 */
const MAX_EDGE = 512;

const API = "https://fortnite-api.com/v2/cosmetics/br";

function slug(name) {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function get(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `${response.status} from ${url}: ${body?.error ?? "(no message)"}`,
    );
  }
  return body?.data ?? null;
}

/**
 * The cosmetic for one season's main.
 *
 * A recorded id wins over the name. Names are not unique in Fortnite's
 * catalogue - Epic reuses them across collaborations and remixes - so once a
 * name has been resolved by hand the id is the thing worth trusting.
 */
async function resolve(main) {
  if (main.id) return get(`${API}/${encodeURIComponent(main.id)}`);

  // `type=outfit` keeps the match off the emote, wrap and loading screen that
  // usually ship under the same name as the skin.
  const found = await get(
    `${API}/search?name=${encodeURIComponent(main.name)}&matchMethod=full&type=outfit`,
  );
  if (!found) throw new Error(`no outfit called "${main.name}"`);
  return found;
}

/**
 * The render for the styles actually worn, rather than the default.
 *
 * An outfit is a set of independent channels - style, super level, glow, an
 * accessory or two - and Epic gives one flat image per option rather than
 * anything that can be composited. So one has to win, and the rule is: the
 * super level if there is one, then the style, then whatever else matched.
 *
 * Super level first because it is the most visually distinct thing about a
 * skin - Voidburn Jade is not a recolour of Jade. But an "off" option is a
 * choice not to have one, so it never wins: Lady Windfrost with super level
 * off falls through to her Dark style, which is the point of picking her.
 *
 * A selection that matches nothing is reported rather than skipped. It means
 * the name is wrong, or Epic renamed the option, and quietly falling back to
 * the default render is how a page ends up showing an outfit nobody wore.
 */
const NOT_A_LOOK = /^(off|none|default)$/i;

function chooseVariant(cosmetic, wanted, key) {
  const problems = [];
  const matched = [];

  for (const want of wanted ?? []) {
    const channel = (cosmetic.variants ?? []).find(
      (variant) =>
        variant.type?.toLowerCase() === want.type.toLowerCase() ||
        variant.channel?.toLowerCase() === want.type.toLowerCase(),
    );
    if (!channel) {
      problems.push(
        `no "${want.type}" channel (has: ${(cosmetic.variants ?? []).map((v) => v.type ?? v.channel).join(", ") || "none"})`,
      );
      continue;
    }

    const option = (channel.options ?? []).find(
      (candidate) =>
        candidate.name?.toLowerCase() === want.option.toLowerCase(),
    );
    if (!option) {
      problems.push(
        `"${want.type}" has no "${want.option}" (options: ${(channel.options ?? []).map((o) => o.name).join(" | ")})`,
      );
      continue;
    }

    matched.push({ type: channel.type ?? channel.channel, option });
  }

  for (const problem of problems) {
    console.warn(`  ! ${key}: ${problem}`);
  }

  const pick = (test) =>
    matched.find(
      (entry) =>
        test.test(entry.type ?? "") &&
        entry.option.image &&
        !NOT_A_LOOK.test(entry.option.name),
    );

  const chosen =
    pick(/super\s*level/i) ??
    pick(/style/i) ??
    matched.find((entry) => entry.option.image);

  return { chosen, matched, problems: problems.length };
}

async function main() {
  const file = JSON.parse(await readFile(SEASONS, "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  let problems = 0;

  for (const season of file.seasons) {
    if (!season.main?.name) continue;

    const cosmetic = await resolve(season.main);
    const {
      chosen,
      matched,
      problems: bad,
    } = chooseVariant(cosmetic, season.main.variants, season.key);
    problems += bad;

    /*
     * The variant render if one was picked, otherwise the square icon.
     *
     * Never `featured`, even though it is the largest image on offer. It is the
     * tall full-body shot Epic uses in the item shop, framed nothing like the
     * head-and-shoulders icon, so the two cannot sit in the same grid: Guff had
     * it and stood out as the one card that was a different picture rather than
     * a different character. Only a couple of outfits have one at all, which
     * makes it a rule that applies to a minority and disfigures the set.
     */
    const source = chosen?.option.image ?? cosmetic.images?.icon;
    if (!source) throw new Error(`"${season.main.name}" has no render`);

    const name = `${slug(season.main.name)}.png`;
    const out = new URL(name, OUT_DIR);

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`${response.status} downloading ${source}`);
    }

    const { width, height } = await sharp(
      Buffer.from(await response.arrayBuffer()),
    )
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toFile(out.pathname);

    // Written back so the content file records what the name resolved to, and
    // so a second run goes straight to the id.
    season.main.id = cosmetic.id;
    season.main.image = `/img/fortnite/${name}`;

    /*
     * The name of the look on screen, when it is worth saying.
     *
     * Only the style and super-level channels produce one, because those are
     * the ones with names a person would use: "Dark Lady Windfrost" means
     * something, and the glow channel's "on" does not. Dropped when it just
     * repeats the outfit's own name, which is what the default style is called.
     */
    const style =
      chosen && /style|super\s*level/i.test(chosen.type ?? "")
        ? chosen.option.name
        : null;
    if (style && style.toLowerCase() !== cosmetic.name.toLowerCase()) {
      season.main.style = style;
    } else {
      delete season.main.style;
    }

    written += 1;
    console.log(
      `${season.key}: ${cosmetic.name}` +
        (chosen ? ` [${chosen.option.name}]` : " [default render]") +
        ` -> ${season.main.image}  ${width}x${height}`,
    );
  }

  await writeFile(SEASONS, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`\n${written} render(s) written, season file updated`);
  if (problems > 0) {
    console.warn(
      `${problems} style selection(s) did not match - see the warnings above. ` +
        `Those outfits fell back to a render nobody picked.`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(`fortnite-skins: ${error.message}`);
  process.exit(1);
}
