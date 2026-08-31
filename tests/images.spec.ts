import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { SOURCE_IMAGE, checkSourceImages, contentPlugin } from "../vite-plugin-content";

/**
 * The build's guard on a picture the source names and `public/` does not have.
 *
 * The suite runs against a site that already built, so the guard is reached by
 * calling the same function the build calls over a throwaway source tree -
 * `tests/share.spec.ts` reaches `readNow`'s guard the same way, for the same
 * reason. What is filed in each case is a file the site plausibly has: the
 * cases below are the shapes `src/` and `index.html` already write, not
 * strings invented to exercise a regex.
 *
 * Both directions cost, and they do not cost the same. A miss ships a broken
 * image with its alt text showing. A false positive fails everybody's build
 * over a sentence in a comment, and cannot be worked around without deleting
 * the sentence - so the second half of this file is the longer one.
 */

/** What the throwaway `public/` holds, named after the pictures the site ships. */
const SHIPPED = ["img/me1.jpg", "img/me1.webp", "img/me1-768.webp", "img/vinyl/33861543.webp"];

/**
 * Files a source tree and hands it to `run`.
 *
 * Keys are paths under `src/`, except `index.html`, which the gate reads from
 * the project root the way Vite does.
 */
function inProject<T>(
  sources: Record<string, string>,
  run: (project: { root: string; publicDir: string }) => T,
): T {
  const root = mkdtempSync(path.join(tmpdir(), "source-images-"));
  try {
    const publicDir = path.join(root, "public");
    for (const image of SHIPPED) {
      mkdirSync(path.join(publicDir, path.dirname(image)), { recursive: true });
      writeFileSync(path.join(publicDir, image), "");
    }

    // Both roots exist even when the case files nothing into them: a project
    // with no `src/` or no `index.html` is not a thing Vite builds, and a
    // failure to read either would look like the gate firing.
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "index.html"), sources["index.html"] ?? "");

    for (const [file, body] of Object.entries(sources)) {
      if (file === "index.html") continue;
      mkdirSync(path.join(root, "src", path.dirname(file)), { recursive: true });
      writeFileSync(path.join(root, "src", file), body);
    }

    return run({ root, publicDir });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The build error the sources would fail with, or `""` if the build goes through. */
function buildError(sources: Record<string, string>): string {
  return inProject(sources, ({ root, publicDir }) => {
    try {
      checkSourceImages(root, publicDir);
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  });
}

test.describe("a picture the source names and the site does not ship", () => {
  test("a source naming a picture that is there builds", () => {
    /*
     * The control, and it comes first because without it every assertion below
     * would be satisfied by an unrelated failure - an unreadable folder, a
     * path joined wrongly - and would prove nothing about the guard.
     */
    expect(buildError({ "routes/home.tsx": `<img src="/img/me1.webp" />` })).toBe("");
  });

  test("a picture that is not there fails the build", () => {
    expect(buildError({ "routes/home.tsx": `<img src="/img/gone.webp" />` })).toMatch(
      /does not exist/,
    );
  });

  test("the check runs when the build starts", () => {
    /*
     * The wiring, without which every other case here tests a function nobody
     * calls. `index.html` and `about.tsx` are imported by no virtual module,
     * so there is no `load` the check could ride in on - it hangs off
     * `buildStart` or it does not happen.
     *
     * Typed by hand because Vite describes a hook as either a function or an
     * object wrapping one, and this plugin writes the first.
     */
    const plugin = contentPlugin() as unknown as {
      configResolved: (config: { root: string; publicDir: string; command: string }) => void;
      buildStart: () => void;
    };

    inProject({ "routes/home.tsx": `<img src="/img/gone.webp" />` }, ({ root, publicDir }) => {
      plugin.configResolved({ root, publicDir, command: "build" });
      expect(() => plugin.buildStart()).toThrow(/does not exist/);
    });
  });

  test("a picture named from index.html fails the build", () => {
    // The hero's preload lives there rather than in a component, which is half
    // the reason this check exists at all.
    expect(buildError({ "index.html": `<link rel="preload" href="/img/gone.webp" />` })).toMatch(
      /does not exist/,
    );
  });

  test("a picture named from a folder deep under src/ fails the build", () => {
    // Every route that names a picture is nested. A walk that read only the
    // top of `src/` would pass this whole file and catch nothing real.
    expect(buildError({ "routes/deep/page.tsx": `<img src="/img/gone.webp" />` })).toMatch(
      /does not exist/,
    );
  });

  test("a picture named from a .ts module fails the build", () => {
    // The share cards are constants in `src/lib/site.ts`, not JSX.
    expect(buildError({ "lib/site.ts": `export const CARD = "/img/gone.jpg";` })).toMatch(
      /does not exist/,
    );
  });

  test("a srcSet candidate that is missing fails the build even when the first one is there", () => {
    /*
     * A `srcSet` candidate that 404s does not fall back to `src` - it leaves
     * the picture blank at exactly the widths that ask for it, which is the
     * failure nobody sees on their own screen.
     */
    const message = buildError({
      "routes/home.tsx": `srcSet="/img/me1-768.webp 768w, /img/gone.webp 1067w"`,
    });

    expect(message).toMatch(/gone\.webp/);
  });

  test("a folder the site does not have fails the build", () => {
    // A grid names its folder and fills in the rest at runtime, so a folder
    // that is not there is every cover in that grid, not one.
    expect(buildError({ "lib/covers.ts": `{ dir: "/img/nope/" }` })).toMatch(/does not exist/);
  });

  test("the folder a template literal interpolates into is still checked", () => {
    /*
     * The other half of "a template names its folder and nothing more". Giving
     * up on the whole path the moment an id appears in it would be the quiet
     * failure: a renamed folder takes every cover in the grid with it, and a
     * grid of blank tiles is what nobody notices in review.
     */
    expect(buildError({ "lib/covers.ts": "const src = `/img/nope/${id}.webp`;" })).toMatch(
      /does not exist/,
    );
  });

  test("a picture named at the end of a sentence is still checked", () => {
    /*
     * The other half of "a full stop is not part of the name it follows", and
     * the half that can fail. Its pair in the next block says a sentence does
     * not break the build; only this says the reference inside that sentence
     * was read at all. Dropping the run instead of the stop would satisfy the
     * pair on its own and leave a comment naming a deleted picture unchecked.
     */
    expect(buildError({ "routes/home.tsx": `// The hero is /img/gone.webp.` })).toContain(
      "public/img/gone.webp",
    );
  });

  test("a sentence ending inside a real folder is checked by name, not by folder", () => {
    /*
     * The same sentence one folder down, and the worse of the two. Giving up on
     * the name and keeping `/img/vinyl/` answers yes - the folder is there -
     * so the build goes green having checked nothing that could have been
     * wrong. A gate that reports a pass it did not earn is worse than no gate,
     * because the next person reads the green and stops looking.
     *
     * So the assertion is the filename rather than the fact of an error: only
     * a check that got as far as the name can produce it.
     */
    expect(buildError({ "lib/covers.ts": `// The sleeve is /img/vinyl/gone.webp.` })).toContain(
      "public/img/vinyl/gone.webp",
    );
  });

  test("the failure names the file to open and the path it looked for", () => {
    // A build error that says neither is a hunt through `src/`.
    const message = buildError({ "routes/home.tsx": `<img src="/img/gone.webp" />` });

    expect(message).toContain(path.join("src", "routes", "home.tsx"));
    expect(message).toContain("public/img/gone.webp");
  });
});

test.describe("what the gate has to leave alone", () => {
  test("a path at the end of a sentence keeps the full stop out of the filename", () => {
    /*
     * Otherwise the build goes looking for `me1.webp.`, which cannot exist, and
     * the only way out is to rewrite the sentence.
     *
     * This says the sentence builds. It cannot say the picture in it was
     * looked for, because a gate that skipped the reference would build too -
     * so it is half of a pair, and the half above that names a missing file is
     * what makes the two of them mean "checked, and found".
     */
    expect(buildError({ "routes/home.tsx": `// The hero is /img/me1.webp.` })).toBe("");
  });

  test("a path under public/ written as a file on disk is not a URL", () => {
    /*
     * `public/img/...` is where the file sits; `/img/...` is what the browser
     * asks for. Reading the first as the second hunts for `public/public/img`.
     *
     * The picture named here is deliberately one the fixture does not have. A
     * gate that stopped requiring the delimiter would read `/img/...` out of
     * the middle of the word and go looking for it, and with a file that does
     * exist that mistake would land on a real picture and pass.
     */
    expect(
      buildError({ "lib/covers.ts": "// The suffix form `public/img/gone-768.webp` uses." }),
    ).toBe("");
  });

  test("a picture on another host is not this site's file to ship", () => {
    expect(
      buildError({ "lib/site.ts": `export const CARD = "https://danavner.com/img/gone.jpg";` }),
    ).toBe("");
  });

  test("a template literal is checked as far as the folder it interpolates into", () => {
    // The id is not knowable here, so the folder is the whole of what can be
    // checked - and it is worth checking, because a renamed folder is every
    // cover in the grid.
    expect(buildError({ "lib/covers.ts": "const src = `/img/vinyl/${id}.webp`;" })).toBe("");
  });

  test("`/img/` named as a folder in prose is not a reference", () => {
    expect(buildError({ "lib/covers.ts": "// Everything under /img/ is optimised first." })).toBe(
      "",
    );
  });

  test("a filename whose width is interpolated is not a reference to half of it", () => {
    /*
     * The responsive-image shape, one step on from the case above: the hero
     * ships `/img/me1-768.webp` and `/img/me1.webp` as literals today, and a
     * component that picks a width writes the same two files as one template.
     *
     * `/img/vinyl/${id}.webp` is safe only because the fixed part of it ends
     * at a folder. Here the fixed part ends mid-name, and the gate has to stop
     * at a name it can check rather than at whatever the truncation left -
     * `/img/me1` is not a file anybody wrote, so no build can be failed for
     * not having it.
     */
    expect(buildError({ "routes/home.tsx": "const src = `/img/me1-${width}.webp`;" })).toBe("");
  });

  test("a filename cut short by a join is not a reference to half of it either", () => {
    /*
     * The same path, spelled the way it was spelled before template literals.
     * What makes `/img/me1-${width}.webp` safe is not the `${` - it is that the
     * run stops mid-filename, and a partial name is not the name of anything.
     * A run stopping at a `"` says exactly the same thing, since no picture on
     * disk is called `me1-`.
     */
    expect(buildError({ "routes/home.tsx": `const src = "/img/me1-" + width + ".webp";` })).toBe(
      "",
    );
  });
});

/**
 * The other end of the same question, asked of the build rather than the source.
 *
 * The gate answers `existsSync`, and on a case-insensitive filesystem - which
 * is what macOS gives every author of this repo by default - that says yes to
 * `/img/ME1.webp`. Pages serves from Linux, where it is a 404, so the one
 * spelling mistake the gate cannot see is the one that only breaks in
 * production. This reads the files the build actually wrote and compares them
 * against the directory listing character for character.
 */
const DIST = path.resolve("dist");

/** Everything the build wrote that a `/img/` path could be spelled in. */
function builtFiles(): string[] {
  return readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(html|js|css)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** Every path under `dist/img/`, spelled the way the filesystem spells it. */
function shippedImages(): Set<string> {
  const root = path.join(DIST, "img");
  const paths = new Set<string>();

  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    const url = `/img/${path.relative(root, path.join(entry.parentPath, entry.name))}`;
    paths.add(url);
    // A reference can name the folder rather than a file in it, which is how
    // every cover grid is written.
    if (entry.isDirectory()) paths.add(`${url}/`);
  }

  return paths;
}

test("every picture the built files ask for is one the build shipped", () => {
  const shipped = shippedImages();
  const missing = new Set<string>();
  let references = 0;

  for (const file of builtFiles()) {
    for (const [image] of readFileSync(file, "utf8").matchAll(SOURCE_IMAGE)) {
      references++;
      if (shipped.has(image)) continue;
      missing.add(`${path.relative(DIST, file)} asks for ${image}`);
    }
  }

  expect(references, "no image path anywhere in dist - run the build first").toBeGreaterThan(0);
  expect(
    [...missing],
    "these are requested and not shipped - a name differing only in case answers on macOS and 404s on Pages",
  ).toEqual([]);
});
