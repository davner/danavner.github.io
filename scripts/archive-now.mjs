/**
 * Files the previous now entry into `src/content/now/` when a new one replaces
 * it, so writing a now update stays one file and one commit.
 *
 * ## The rule
 *
 * You only ever edit `src/content/now.md`. What happens on push depends on one
 * thing: whether its `updated` date changed.
 *
 *   - Date changed  -> the text that was there is a finished entry. It gets
 *                      written to `src/content/now/<its own date>.md`.
 *   - Date the same -> you were fixing a sentence. Nothing is archived, because
 *                      a typo correction is not a second entry saying the same
 *                      thing as the first.
 *
 * That is the whole design. The date is the signal you already have to touch to
 * keep the page honest, so nothing new is asked of the person writing.
 *
 * ## Why the previous version comes from git
 *
 * Because it is the only place it exists. `now.md` holds the new text by the
 * time this runs, so the old text has to be read back out of history - the last
 * commit that touched the file before this one.
 *
 * ## Failure
 *
 * Loud, unlike the fetch jobs. Those keep yesterday's data when a read fails,
 * because a stale page beats an empty one. This is the opposite case: if it
 * cannot work out what to archive, the safe move is to write nothing, say why,
 * and leave the entry in git where it already is. Nothing is lost either way -
 * the history is the backstop.
 *
 * Run it locally the same way CI does:
 *
 *   node scripts/archive-now.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const NOW_FILE = "src/content/now.md";
const ARCHIVE_DIR = new URL("../src/content/now/", import.meta.url);
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const UPDATED = /^updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m;

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

/**
 * `git` where failing is an answer rather than a crash.
 *
 * Used for reading a past version of the page, which is not always there: the
 * commit before this one may be the one that *deleted* `now.md`, and `git show`
 * exits non-zero on a path that does not exist at that revision. That is a real
 * state - the page was empty, so there is nothing behind this entry to file -
 * and it should not take the job down.
 */
function gitOrNull(...args) {
  try {
    // stderr is discarded rather than inherited: git writes "fatal: path does
    // not exist" here for what is an ordinary outcome, and a `fatal:` in the log
    // of a job that succeeded reads like something went wrong.
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * The `updated` date out of a raw entry.
 *
 * Read with a regex rather than a YAML parser because this script is the one
 * thing in the repo that runs before the build, and pulling js-yaml in to read a
 * single line would make it depend on an install it does not otherwise need.
 */
function updatedDate(raw) {
  const block = FRONTMATTER.exec(raw);
  if (!block) return "";
  return UPDATED.exec(block[1])?.[1] ?? "";
}

async function main() {
  const currentRaw = await readFile(new URL(`../${NOW_FILE}`, import.meta.url), "utf8");
  const current = updatedDate(currentRaw);

  /*
   * A malformed page rather than nothing to do. Every other early return here is
   * a legitimate no-op - a revision, an entry already filed - and logs as one;
   * this one means the file is wrong and the build will reject it too.
   */
  if (!current) {
    throw new Error(`${NOW_FILE} has no \`updated\` date, so nothing can be filed`);
  }

  /*
   * The two most recent commits that touched the file. The first is the one that
   * just landed; the second holds the text being replaced. One entry means the
   * file has only ever been written once, so there is nothing behind it yet.
   */
  const commits = git("log", "-2", "--format=%H", "--", NOW_FILE).split("\n").filter(Boolean);

  if (commits.length < 2) {
    console.log("now-archive: no previous version of the page yet, nothing to file");
    return;
  }

  const previousRaw = gitOrNull("show", `${commits[1]}:${NOW_FILE}`);

  if (previousRaw === null) {
    console.log("now-archive: the page did not exist before this, nothing to file");
    return;
  }

  const previous = updatedDate(previousRaw);

  /*
   * A warning rather than a failure, unlike the missing date on the current
   * page. This one is about a commit that already happened: the text cannot be
   * filed and nobody can go back and fix it, so failing every push from here on
   * would be a red run with no action behind it. The entry is lost either way;
   * saying so once is the most this can usefully do.
   */
  if (!previous) {
    console.warn("now-archive: the previous version had no `updated` date, so it cannot be filed");
    return;
  }

  if (previous === current) {
    console.log(`now-archive: still dated ${current}, so this was a revision. Nothing to file.`);
    return;
  }

  const target = new URL(`${previous}.md`, ARCHIVE_DIR);

  // Already filed - the job ran twice for the same push, or someone wrote the
  // entry by hand. Overwriting would silently rewrite history either way.
  if (existsSync(target)) {
    console.log(`now-archive: ${previous}.md is already filed, leaving it alone`);
    return;
  }

  await mkdir(ARCHIVE_DIR, { recursive: true });
  await writeFile(target, previousRaw.endsWith("\n") ? previousRaw : `${previousRaw}\n`);

  console.log(`now-archive: filed the ${previous} entry, replaced by ${current}`);
}

try {
  await main();
} catch (error) {
  console.error(`now-archive: ${error.message}`);
  process.exit(1);
}
