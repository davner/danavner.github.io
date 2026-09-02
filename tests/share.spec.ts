import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { type Locator, type Page, expect, test } from "@playwright/test";
import * as cheerio from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { longDate } from "../src/lib/dates";
import { nowParagraphs, nowSummary } from "../src/lib/now-summary";
import { readNow } from "../vite-plugin-content";
import { type LoggedAlbum, albumsOnDisk } from "./dan-fm";
import { PHOTO_GAP, nowEntriesWithPhotos } from "./now-photos";

const SHOWS_DIR = path.resolve("src/content/shows");
const NOW_DIR = path.resolve("src/content/now");
const DIST = path.resolve("dist");

/** The slugs the content plugin will publish - the filenames, minus `_` notes. */
const SLUGS = readdirSync(SHOWS_DIR)
  .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
  .map((file) => file.replace(/\.md$/, ""));

/** Now entry dates, the same way - the filename is the date is the address. */
const NOW_DATES = readdirSync(NOW_DIR)
  .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
  .map((file) => file.replace(/\.md$/, ""))
  .sort();

/** One entry's markdown, the frontmatter block taken off - what the page renders. */
function bodyOf(date: string): string {
  return readFileSync(path.join(NOW_DIR, `${date}.md`), "utf8").replace(
    /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
    "",
  );
}

/** index.html wraps some meta tags across lines, so match loosely on whitespace. */
function metaFrom(html: string) {
  return (name: string) =>
    new RegExp(`<meta\\s+(?:name|property)="${name}"[^>]*content="([^"]*)"`).exec(html)?.[1];
}

/**
 * The site is client-rendered, so a link preview is built from the served HTML
 * and nothing the router does after it. These assertions are what stand between
 * a shared show and a generic site card in someone's messages.
 */
test.describe("link previews", () => {
  test("every show ships its own HTML with its own meta", () => {
    expect(SLUGS.length).toBeGreaterThan(0);
    const titles = new Set<string>();

    for (const slug of SLUGS) {
      const html = readFileSync(path.join(DIST, "shows", `${slug}.html`), "utf8");

      const meta = metaFrom(html);

      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      const description = meta("description");
      const ogUrl = meta("og:url");
      const ogImage = meta("og:image");

      expect(title, `${slug} has no title`).toBeTruthy();
      expect(description, `${slug} has no description`).toBeTruthy();
      expect(ogUrl).toBe(`https://danavner.com/shows/${slug}`);
      // An image path that 404s previews as a blank card, which is worse than
      // no image at all.
      expect(ogImage).toMatch(/^https:\/\/danavner\.com\//);
      // A show with no photos takes the dedicated fallback rather than the site
      // portrait: a festival link previewing as a headshot reads as the wrong
      // link entirely.
      expect(ogImage, `${slug} previews as the portrait`).not.toContain("/img/me1.jpg");

      titles.add(title!);
    }

    // Distinct titles is the whole point; a copied template would pass every
    // assertion above and still preview identically for every show.
    expect(titles.size).toBe(SLUGS.length);
  });

  test("a show page still boots the app", async ({ page }) => {
    await page.goto(`/shows/${SLUGS[0]}`);
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  });
});

/**
 * The same guarantee for now entries. Every entry gets a file, including the
 * current one whose URL redirects: the crawler reads the HTML and never runs
 * the router, so the file is what makes the preview right.
 */
test.describe("now link previews", () => {
  test("every now entry ships its own HTML with its own meta", () => {
    expect(NOW_DATES.length).toBeGreaterThan(0);
    const titles = new Set<string>();

    for (const date of NOW_DATES) {
      const html = readFileSync(path.join(DIST, "now", `${date}.html`), "utf8");
      const meta = metaFrom(html);

      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];

      /*
       * The date format is pinned here because nothing else in the suite pins
       * it. The only other long-date reference in `tests/` is a comment in
       * `site.spec.ts`, and the assertions under it check for a four-digit year
       * and a comma - which `"8/27/2026"` satisfies. This one line gates
       * `longDate`'s output, the `·` separator, and the way the emitted title is
       * composed, so do not loosen it.
       *
       * Read out of the built file rather than by navigating: `/now/<current>`
       * redirects to `/now`, where the tab reads `Now · Dan Avner`, and a
       * navigating test would fail on correct behaviour.
       */
      expect(title, `${date} has the wrong title`).toMatch(
        /^Now · [A-Z][a-z]+ \d{1,2}, \d{4} · Dan Avner$/,
      );

      expect(meta("description"), `${date} has no description`).toBeTruthy();
      expect(meta("og:url")).toBe(`https://danavner.com/now/${date}`);
      /*
       * Absolute, not which branch produced it. Every entry takes the
       * `DEFAULT_SHARE_IMAGE` fallback while none has photos, so asserting the
       * first-photo branch would be asserting a path that cannot run - and
       * would be wrong the day it does.
       */
      expect(meta("og:image")).toMatch(/^https:\/\/danavner\.com\//);

      titles.add(title!);
    }

    // Distinct titles is the whole point; a copied template would pass
    // everything above and still preview identically for every entry.
    expect(titles.size).toBe(NOW_DATES.length);
  });

  test("the emitted description is the one the page sets", async ({ page }) => {
    /*
     * `nowParagraphs` runs twice over the same entry - in Node for this file,
     * and in the browser for the tab and the card - and nothing else checks the
     * two agree. A divergent reading means a link preview that quotes
     * different words than the page it points at.
     *
     * An archived entry, because the current one's permalink redirects to
     * `/now`, which sets the page's own undated description.
     */
    const archived = NOW_DATES.slice(0, -1);
    test.skip(archived.length === 0, "only one now entry filed - none is archived yet");

    const date = archived[archived.length - 1];
    const html = readFileSync(path.join(DIST, "now", `${date}.html`), "utf8");
    const emitted = metaFrom(html)("description");

    await page.goto(`/now/${date}`);
    await page.getByRole("heading", { level: 1 }).waitFor();

    await expect
      .poll(() => page.locator('meta[name="description"]').getAttribute("content"))
      .toBe(emitted);
  });

  test("a now permalink still boots the app", async ({ page }) => {
    await page.goto(`/now/${NOW_DATES[0]}`);
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  });

  test("an entry with photos previews as its own first photo", () => {
    /*
     * The branch the sweep above deliberately leaves alone. It asserts only
     * that `og:image` is absolute, because every entry takes the
     * `DEFAULT_SHARE_IMAGE` fallback while none has photos - so this is the
     * other half, skipped until there is an entry that reaches it. A preview
     * showing the site portrait for an entry that came with pictures is the
     * failure it guards, and it is invisible until someone shares the link.
     */
    const withPhotos = nowEntriesWithPhotos();
    test.skip(withPhotos.length === 0, PHOTO_GAP);

    for (const date of withPhotos) {
      const first = /^\s*-\s+src:\s*(\S+)/m.exec(
        readFileSync(path.join(NOW_DIR, `${date}.md`), "utf8"),
      )?.[1];
      expect(first, `${date} has no readable first photo`).toBeTruthy();

      const html = readFileSync(path.join(DIST, "now", `${date}.html`), "utf8");
      expect(metaFrom(html)("og:image"), `${date} does not preview as its own photo`).toBe(
        `https://danavner.com${first}`,
      );
    }
  });
});

/**
 * `nowParagraphs` on its own, imported rather than driven through a page.
 *
 * Everything above reaches it only through whatever the filed entries happen to
 * contain, and both of them are plain prose with one ordinary link - so a
 * heading, an image, a list, a reference link or a parenthesised URL meets
 * nothing that would notice it came out mangled. Its output is the meta
 * description baked into every `dist/now/<date>.html`, the tab
 * description, and the poster's excerpt, which is three surfaces where the
 * mistake is only visible after it has been sent.
 *
 * These pin behaviour, not implementation. The cases below are three ways a
 * hand-rolled markdown stripper corrupts an entry, and whatever reads the
 * markdown has to keep getting them right.
 *
 * Playwright as the unit runner because the repo has no other one, and because
 * `links.spec.ts` and `site.spec.ts` already import out of `src/lib/` exactly
 * this way. These need no browser at all.
 *
 * The alternative is a fixture now entry carrying the awkward markdown, read
 * back out of its emitted description. That publishes a made-up entry to the
 * live site in order to test a function, and it can only ever see the first
 * paragraph.
 */
test.describe("reading a now entry's prose", () => {
  test("an inline link unwraps to its text, whatever the URL holds", () => {
    /*
     * A `\([^)]*\)` destination stops at the first `)`, which drops the label
     * and leaves the tail of the address in the prose. `…/Now_(album)` is what
     * Wikipedia and GitHub hand you, so this is the ordinary case rather than
     * the exotic one.
     */
    expect(nowParagraphs("Check out [this link](http://example.com/a_(b)) for more.")).toEqual([
      "Check out this link for more.",
    ]);

    expect(
      nowParagraphs("See [it](https://en.wikipedia.org/wiki/Now_(album)_(disambiguation)) here."),
    ).toEqual(["See it here."]);

    expect(nowParagraphs("Read [the post](https://danavner.com/blog/x) today.")).toEqual([
      "Read the post today.",
    ]);

    // A label may hold brackets of its own, which no amount of counting the
    // outer pair gets right on its own.
    expect(nowParagraphs("Read [a [b] c](https://example.com) today.")).toEqual([
      "Read a [b] c today.",
    ]);
  });

  test("an unclosed bracket does not swallow the next link", () => {
    /*
     * Scanning for `[` and then for the next `]` pairs the stray bracket with
     * the real link's label, so the destination is eaten and the link's text
     * goes with it: "Bought a new phone online."
     *
     * What is correct is what the page renders. The stray `[` is a character
     * the author typed and the reader sees, and the link after it is still a
     * link.
     */
    expect(
      nowParagraphs(
        "Bought a new phone [finally and here's [the review](https://example.com) online.",
      ),
    ).toEqual(["Bought a new phone [finally and here's the review online."]);
  });

  test("a reference link unwraps and its definition does not become a paragraph", () => {
    // Both are hazards for a hand-rolled stripper: `[text][ref]` keeps its
    // brackets, and the definition line reads as prose - which ships
    // `[1]: https://…` as an entry's description.
    expect(
      nowParagraphs("Read [the post][1] today.\n\n[1]: https://example.com/a_(b) 'Title'\n"),
    ).toEqual(["Read the post today."]);

    expect(nowParagraphs("[1]: https://example.com\n[2]: https://example.org\n")).toEqual([]);

    // Brackets with nothing after them are prose, and stay prose.
    expect(nowParagraphs("It was [sic] fine.")).toEqual(["It was [sic] fine."]);
  });

  test("a paragraph opening in brackets is prose, not a definition", () => {
    /*
     * The worst of the three: `^\[[^\]]+\]:` deletes the whole line, so an entry
     * opening `[Update]:` loses its first paragraph and, if that is the only
     * one, previews with an empty description. `[Update]`, `[Edit]` and `[Note]`
     * are ordinary things to write at the head of a journal paragraph. A
     * reference definition is a line whose target is a link destination; this
     * one's is a sentence.
     */
    expect(
      nowParagraphs("[Update]: I finished the project a day early, which felt great.\n\nMore."),
    ).toEqual(["[Update]: I finished the project a day early, which felt great.", "More."]);
  });

  test("headings and fenced code are not prose", () => {
    // A heading is the entry's label, not its opening words, so it is not a
    // candidate for the description - and a code block read as a sentence is
    // noise.
    expect(nowParagraphs("## A heading\n\nBody text.")).toEqual(["Body text."]);
    expect(nowParagraphs("```\nnpm run build\n```\n\nBody text.")).toEqual(["Body text."]);
  });

  test("prose written as a list or a quote still counts", () => {
    // One line per item rather than one run-on line, and rather than nothing:
    // an entry written as a list would otherwise have no description at all.
    expect(nowParagraphs("- Magic\n- Fortnite\n\nAnd a paragraph.")).toEqual([
      "Magic",
      "Fortnite",
      "And a paragraph.",
    ]);

    expect(nowParagraphs("> Quoted prose.\n\nAfter.")).toEqual(["Quoted prose.", "After."]);
  });

  test("an image prints nothing and emphasis prints its text", () => {
    /*
     * A description that says "Before a cat after." narrates a picture the
     * reader was never shown. Alt text stands in for an image in place; it does
     * not read as prose anywhere else, so images leave nothing behind.
     */
    expect(nowParagraphs("Before ![a cat](/img/cat.png) after.")).toEqual(["Before after."]);
    expect(nowParagraphs("Before ![a cat][cat] after.\n\n[cat]: /img/cat.png")).toEqual([
      "Before after.",
    ]);
    // With no definition to resolve, that same reference is not an image at
    // all - it is the text the page itself renders, brackets and all.
    expect(nowParagraphs("Before ![a cat][cat] after.")).toEqual(["Before ![a cat][cat] after."]);

    expect(nowParagraphs("This is *bold* and _italic_ and `code`.")).toEqual([
      "This is bold and italic and code.",
    ]);
  });

  test("a footnote's definition is never spliced into the prose", () => {
    /*
     * The fabricated-paragraph class arriving by a second door, and the reason
     * `collectParagraphs` skips one node by name. A footnote prints in a
     * section at the foot of the page wherever in the source it was written, so
     * reading it in document order puts a clean-looking sentence in the middle
     * of an entry that the reader never meets there. Without GFM registered at
     * all it is not a footnote either - it is an ordinary paragraph, which
     * fabricates it twice over.
     */
    expect(nowParagraphs("See this[^1].\n\n[^1]: A note.")).toEqual(["See this."]);

    // Mid-entry is where it does the damage, so that is where it is checked:
    // the phantom lands between two real paragraphs rather than after them.
    const paragraphs = nowParagraphs(
      "First thing.\n\nSecond thing[^a].\n\n[^a]: An aside printed at the foot.\n\nThird thing.",
    );
    expect(paragraphs).toEqual(["First thing.", "Second thing.", "Third thing."]);
    expect(paragraphs.join(" "), "the footnote surfaced as prose").not.toContain("aside");

    // A definition nothing refers to is still not prose, and an entry made of
    // one has nothing to describe it - which is what the build guard below is.
    expect(nowParagraphs("[^1]: A note.")).toEqual([]);
  });

  test("a task list reads as its items, not as its checkboxes", () => {
    // Without the GFM extension `- [ ] Buy milk` is an ordinary list item whose
    // text opens "[ ] Buy milk", so the description quotes a checkbox at the
    // reader.
    expect(nowParagraphs("- [ ] Buy milk\n- [x] Ship it")).toEqual(["Buy milk", "Ship it"]);

    expect(nowParagraphs("Here is the plan.\n\n- [ ] Buy milk\n- [x] Ship it")).toEqual([
      "Here is the plan.",
      "Buy milk",
      "Ship it",
    ]);
  });

  test("strikethrough prints what it struck through, without the tildes", () => {
    expect(nowParagraphs("This is ~~struck~~ text.")).toEqual(["This is struck text."]);
  });

  test("a table is not read out as a run of pipes", () => {
    // A grid read aloud as a sentence is noise, and without GFM it is not a
    // table at all - it is one paragraph of pipes and dashes.
    expect(nowParagraphs("| Deck | Wins |\n| - | - |\n| Miku | 2 |\n\nAfter.")).toEqual(["After."]);
  });

  test("an autolinked address prints exactly as it was written", () => {
    expect(nowParagraphs("Mail me at www.example.com or dan@example.com.")).toEqual([
      "Mail me at www.example.com or dan@example.com.",
    ]);
  });

  test("an entry with nothing to say describes itself as nothing", () => {
    // Not a curiosity: `parseNowEntry` fails the build on exactly this, so what
    // an empty reading is has to be pinned before the guard over it means
    // anything.
    expect(nowParagraphs("")).toEqual([]);
    expect(nowParagraphs("   \n\n  \n")).toEqual([]);
    expect(nowParagraphs("# A title and nothing under it")).toEqual([]);
    expect(nowParagraphs("![the whole entry](/img/me1.jpg)")).toEqual([]);
  });

  test("a hard line break keeps the space between the two lines", () => {
    /*
     * Two trailing spaces is markdown's hard break, and it is what an editor or
     * a CMS textarea leaves behind routinely. The page renders
     * "Line one<br>line two", which a reader reads as two lines, but
     * `mdast-util-to-string` prints nothing at all for a `break` node - so the
     * description ran them together as "oneline", a word appearing nowhere on
     * the page. `phrasingText` in `now-summary.ts` is what gives the break the
     * space its rendering stands for.
     */
    expect(nowParagraphs("Line one  \nline two.")).toEqual(["Line one line two."]);
  });
});

/**
 * The description against the page, from one markdown source.
 *
 * `now-summary.ts` reads an entry with `mdast-util-from-markdown`; `NowProse`
 * renders it with `react-markdown`. Two parsers, kept in step by hand, and
 * nothing stops them drifting - so what is asserted here is the property rather
 * than a table of outputs: the paragraphs the description is built from are the
 * paragraphs a reader sees, in order, in the same words. A hand-written
 * expectation for each construct would go on
 * passing through a drift that changed both sides' meaning; this cannot.
 *
 * The page side is rendered rather than fetched, because a fixture only reaches
 * the browser by being published as a real now entry - a made-up entry on the
 * live site in order to test a function. `renderToStaticMarkup` runs the same
 * `react-markdown` the bundle carries, and the test below reading the built
 * page is what ties that back to the component as it actually ships.
 */
test.describe("the description and the page read the same markdown", () => {
  /** `NowProse`'s markdown, rendered. Its JSX cannot be imported here - see below. */
  function renderProse(body: string): string {
    return renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [remarkGfm] }, body));
  }

  /**
   * The prose a reader sees, read off rendered markup in document order.
   *
   * `p` and `li`, because those are the two elements markdown prose arrives in -
   * a heading, a table cell and a code block are not prose here for the same
   * reasons `collectParagraphs` does not collect them. Two removals, and both
   * are the point rather than a convenience:
   *
   * - The footnotes section, because it prints at the foot of the page whatever
   *   position it was written at. Reading it in document order is the phantom
   *   paragraph, so a description that included one would show up here as an
   *   extra entry.
   * - `sup`, the marker a footnote reference prints. It is an affordance, not a
   *   word of the entry.
   *
   * A hard break needs no third rule, which is worth writing down because it
   * looks like it should. `.text()` concatenates across a `<br>` with nothing
   * between - but `mdast-util-to-hast` emits a `\n` text node directly after
   * every `br` it writes, so the collapse below turns the pair into the one
   * space the reader sees. Checked in
   * `node_modules/mdast-util-to-hast/lib/handlers/break.js` rather than assumed.
   * If that ever stops being true this reports a disagreement over a hard break,
   * and this side is the half to fix.
   */
  function readParagraphs(html: string): string[] {
    const $ = cheerio.load(html);
    $("section[data-footnotes]").remove();
    $("sup").remove();

    const found: string[] = [];
    $("p, li").each((_, element) => {
      const node = $(element);
      // A loose list item wraps its prose in a `p`, which is read on its own
      // turn; reading the `li` too would count it twice.
      if (node.is("li") && node.children("p").length > 0) return;

      // A nested list's items are read on their own turns for the same reason.
      const own = node.clone();
      own.find("ul, ol").remove();

      const text = own.text().replace(/\s+/g, " ").trim();
      if (text) found.push(text);
    });
    return found;
  }

  /*
   * One entry per construct, named so a failure says which one drifted. Every
   * one of these is markdown a person might reasonably write in a now entry,
   * and each is a place the two readers could disagree.
   */
  const CONSTRUCTS: [string, string][] = [
    ["a plain paragraph", "Just a sentence about the month."],
    ["two paragraphs", "First thing.\n\nSecond thing."],
    ["an inline link", "Read [the post](https://example.com/a_(b)) today."],
    ["a reference link", "Read [the post][1] today.\n\n[1]: https://example.com"],
    ["emphasis and code", "This is *bold* and _italic_ and `code`."],
    ["a heading over prose", "## A heading\n\nBody text."],
    ["a fenced code block", "```\nnpm run build\n```\n\nBody text."],
    ["a tight list", "- Magic\n- Fortnite"],
    ["a loose list", "- Magic\n\n- Fortnite"],
    ["a nested list", "- Outer\n  - Inner"],
    ["an ordered list", "1. First\n2. Second"],
    ["a blockquote", "> Quoted prose.\n\nAfter."],
    ["a blockquote holding a heading", "> Quote\n>\n> ## Head\n>\n> More"],
    ["an image in a sentence", "Before ![a cat](/img/cat.png) after."],
    ["strikethrough", "This is ~~struck~~ text."],
    ["a task list", "Here is the plan.\n\n- [ ] Buy milk\n- [x] Ship it"],
    ["a footnote", "See this[^1].\n\n[^1]: A note printed at the foot."],
    ["a table", "| Deck | Wins |\n| - | - |\n| Miku | 2 |\n\nAfter."],
    ["autolinked addresses", "Mail me at www.example.com or dan@example.com."],
    ["a stray bracket", "Bought a phone [finally and here's [the review](https://e.com) online."],
  ];

  for (const [name, body] of CONSTRUCTS) {
    test(`the two readings agree about ${name}`, () => {
      expect(nowParagraphs(body), JSON.stringify(body)).toEqual(readParagraphs(renderProse(body)));
    });
  }

  for (const date of NOW_DATES) {
    test(`the two readings agree about the entry filed on ${date}`, () => {
      // The filed entries, not just the constructs above: whatever is written
      // in `src/content/now/` is what actually reaches both readers, and a new
      // entry brings its own markdown with it.
      const body = bodyOf(date);
      expect(nowParagraphs(body)).toEqual(readParagraphs(renderProse(body)));
    });
  }

  test("the prose on the built page is the prose the description was read from", async ({
    page,
  }) => {
    /*
     * The same property against the component as it ships, rather than against
     * a stand-in for it. Everything above models `NowProse` as
     * `react-markdown` plus `remarkGfm`; this is the one that would notice if
     * the component in the bundle were doing something else.
     *
     * An archived entry, because `/now/<current>` redirects to `/now`, where
     * the timeline renders every other entry's prose into the same page.
     */
    const archived = NOW_DATES.slice(0, -1);
    test.skip(archived.length === 0, "only one now entry filed - none is archived yet");

    const date = archived[archived.length - 1];
    await page.goto(`/now/${date}`);
    const prose = page.locator(".prose-dan").first();
    await prose.waitFor();

    expect(nowParagraphs(bodyOf(date))).toEqual(readParagraphs(await prose.innerHTML()));
  });

  test("the page adds no markdown plugin the description does not", () => {
    /*
     * The invariant both modules document, checked rather than hoped for:
     * whatever is in `NowProse`'s `remarkPlugins` has to be represented by the
     * `GFM` constant in `now-summary.ts`, or the two read one entry as two
     * syntaxes. A plugin added to the component would not fail anything above
     * until an entry happened to use the syntax it enables.
     *
     * Read out of the source because that list lives in JSX, and Playwright
     * transforms JSX for its own component runner - so importing `NowProse`
     * here renders nothing that React will accept.
     */
    const source = readFileSync(path.resolve("src/components/now-prose.tsx"), "utf8");
    const declared = /remarkPlugins=\{\[([^\]]*)\]\}/.exec(source)?.[1];
    expect(declared, "NowProse no longer declares remarkPlugins inline - update this test").toBe(
      "remarkGfm",
    );
  });
});

/**
 * The one line a shared link previews with.
 *
 * `nowSummary` is what every `dist/now/<date>.html` carries as its
 * description and what the tab shows, and nothing exercised its cut: the two
 * filed entries both open with a paragraph short enough to survive whole.
 */
test.describe("describing an entry in one line", () => {
  test("a paragraph inside the limit is left whole", () => {
    expect(nowSummary({ body: "A short entry about the month." })).toBe(
      "A short entry about the month.",
    );
  });

  test("a paragraph exactly at the limit is not cut", () => {
    const body = `${"a".repeat(159)}.`;
    expect(body).toHaveLength(160);
    expect(nowSummary({ body })).toBe(body);
  });

  test("a longer paragraph stops at a word boundary and says it was cut", () => {
    const body = "word ".repeat(60).trim();
    const summary = nowSummary({ body });

    expect(summary.endsWith("…"), "nothing said the description was cut").toBe(true);

    // No half word left behind: what was kept is a whole-word prefix of the
    // paragraph, which is the difference between an excerpt and a typo.
    const kept = summary.slice(0, -1);
    expect(body.startsWith(kept)).toBe(true);
    expect(body[kept.length]).toBe(" ");
    expect(kept.length).toBeLessThanOrEqual(160);
  });

  test("one long word with nowhere to cut is cut at the limit", () => {
    // No space to fall back to, and dropping the paragraph whole would leave
    // the entry with no description at all.
    expect(nowSummary({ body: "x".repeat(400) })).toBe(`${"x".repeat(160)}…`);
  });

  test("only the opening paragraph becomes the description", () => {
    expect(nowSummary({ body: "First thing.\n\nSecond thing." })).toBe("First thing.");
  });

  test("an entry with no prose describes itself as nothing", () => {
    expect(nowSummary({ body: "" })).toBe("");
    expect(nowSummary({ body: "# A title and nothing under it" })).toBe("");
  });
});

/**
 * `longDate`, which is what `nowDate` and `nowTitle` print and what the emitted
 * `<title>` is composed from.
 */
test.describe("spelling a date out", () => {
  test("a date prints its month in words", () => {
    expect(longDate("2026-08-27")).toBe("August 27, 2026");
    expect(longDate("2026-01-01")).toBe("January 1, 2026");
    expect(longDate("2026-12-09")).toBe("December 9, 2026");
  });

  test("a date this cannot read prints nothing, never Invalid Date", () => {
    /*
     * The deliberate divergence from `formatDate` in `lib/blog.ts`, which
     * renders the string "Invalid Date". This one is reachable from the Node
     * build, where that string would be written into a shipped HTML file and
     * served as a page title - so a broken date costs the entry its date rather
     * than announcing the fault in everyone's tab.
     */
    for (const date of ["", "not a date", "2026-8-7", "2026/08/27", "2026-08-27T09:00:00Z"]) {
      expect(longDate(date), JSON.stringify(date)).toBe("");
    }
  });

  test("a month outside the calendar prints nothing", () => {
    expect(longDate("2026-00-10")).toBe("");
    expect(longDate("2026-13-10")).toBe("");
  });
});

/**
 * The build's guard on an entry that has a body and no prose.
 *
 * `parseNowEntry` fails the build on one, and the suite runs against a site
 * that already built - so the guard is reached by calling `readNow` over a
 * temporary content folder rather than by trying to observe a build that never
 * finished. That is the same function the build calls, on the same input shape,
 * which is as close to the real thing as this harness can stand.
 *
 * Why it matters enough to test: the description, the tab and the share card
 * are all read from the entry's paragraphs, so an entry with none of them does
 * not ship a degraded preview - it ships the entry with nothing said about it.
 */
test.describe("an entry with a body and no prose", () => {
  /** Files one entry in a throwaway content folder and reads the folder back. */
  function buildError(body: string): string {
    const root = mkdtempSync(path.join(tmpdir(), "now-content-"));
    try {
      mkdirSync(path.join(root, "src/content/now"), { recursive: true });
      writeFileSync(
        path.join(root, "src/content/now/2026-01-01.md"),
        `---\nupdated: 2026-01-01\n---\n\n${body}\n`,
      );

      try {
        readNow(root, path.resolve("public"));
        return "";
      } catch (error) {
        return (error as Error).message;
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  test("an entry with a paragraph builds", () => {
    /*
     * The control, and it comes first because without it every assertion below
     * would be satisfied by an unrelated failure - a date the parser rejected,
     * a folder it could not read - and would prove nothing about the prose
     * guard.
     */
    expect(buildError("A sentence about the month.")).toBe("");
  });

  test("an entry that is only a heading fails the build", () => {
    expect(buildError("## Just a heading")).toMatch(/no prose/);
  });

  test("an entry that is only a picture fails the build", () => {
    // Alt text stands in for a picture in place. It is not the entry's opening
    // words, so an entry made of one has nothing to say about itself.
    expect(buildError("![the whole entry](/img/me1.jpg)")).toMatch(/no prose/);
  });

  test("an entry that is only a code block fails the build", () => {
    expect(buildError("```\nnpm run build\n```")).toMatch(/no prose/);
  });

  test("an entry that is only a footnote definition fails the build", () => {
    // The skip in `collectParagraphs` is what leaves this entry empty, so the
    // two behaviours have to be right together: the phantom is not printed,
    // and an entry made of nothing but the phantom does not ship.
    expect(buildError("[^1]: A note nobody wrote a body around.")).toMatch(/no prose/);
  });

  test("the failure names the file to open", () => {
    // A build error that does not say which file it read is a hunt through the
    // folder.
    expect(buildError("## Just a heading")).toContain("src/content/now/2026-01-01.md");
  });
});

test.describe("share", () => {
  test("builds a card and offers the link", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // The panel is always the first stop now. Handing the OS the card and the
    // link in one payload made Messages stack the poster, the lineup, and the
    // URL on top of each other.
    await page.getByRole("button", { name: /^Share/ }).click();

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });

    // A blank canvas would still produce a valid PNG, so check it has size.
    const size = await card.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth * (img as HTMLImageElement).naturalHeight,
    );
    expect(size).toBeGreaterThan(0);

    await expect(page.getByRole("link", { name: /Save the card/ })).toHaveAttribute(
      "download",
      "bruno-mars-madrid-2026.png",
    );
    // The URL is not printed in the panel - the buttons carry it. Nothing
    // should be showing it as text.
    await expect(page.getByText("danavner.com/shows/", { exact: false })).toHaveCount(0);
  });

  test("the card and the link are separate actions", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");

    // Stand in for a phone: a share sheet that takes files as well as links.
    await page.addInitScript(() => {
      const shared: unknown[] = [];
      (window as unknown as { __shared: unknown[] }).__shared = shared;
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: unknown) => void shared.push(data),
      });
      Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    });
    await page.reload();

    await page.getByRole("button", { name: /^Share/ }).click();
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Share the card/ }).click();
    // On a phone the panel is taller than the viewport and scrolls, so the
    // second action can sit below the fold.
    const sendLink = page.getByRole("button", { name: /Send the link/ });
    await sendLink.scrollIntoViewIfNeeded();
    await sendLink.click();

    const payloads = await page.evaluate(
      () => (window as unknown as { __shared: Record<string, unknown>[] }).__shared,
    );
    expect(payloads).toHaveLength(2);

    // The card goes out on its own, with no URL riding along.
    expect(payloads[0].files).toBeTruthy();
    expect(payloads[0].url).toBeUndefined();

    // The link goes out on its own, with no file and no pasted lineup.
    expect(payloads[1].url).toBe("https://danavner.com/shows/bruno-mars-madrid-2026");
    expect(payloads[1].files).toBeUndefined();
    expect(payloads[1].text).toBeUndefined();
  });

  test("a card that cannot be drawn still offers the link", async ({ page }) => {
    /*
     * The failed branch is hard to reach on purpose: `loadImage` resolves null
     * on error so a missing photo costs the card its picture rather than the
     * whole share, and the render only rejects when `toBlob` hands back nothing.
     * So force exactly that, the same way the share test above stands in for a
     * phone's `navigator.share`.
     */
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
        callback(null);
      };

      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });

    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("button", { name: /^Share/ }).click();

    const panel = page.getByRole("dialog", { name: /^Share / });
    await expect(panel.getByText("Could not build the card.")).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole("button", { name: /Try again/ })).toBeVisible();
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);

    // The whole point: the page is still worth sending even though its poster
    // is not, so the link actions have to survive the failure.
    const copy = panel.getByRole("button", { name: /Copy the link/ });
    await copy.scrollIntoViewIfNeeded();
    await copy.click();

    await expect(panel.getByRole("button", { name: /Link copied/ })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied),
    ).toEqual(["https://danavner.com/shows/bruno-mars-madrid-2026"]);
  });

  test("a card still being drawn does not withhold the link", async ({ page }) => {
    /*
     * The state a slow render actually spends its time in. The failure test
     * above never observably sits in `working` - its stub calls back at once,
     * so the panel goes straight to `failed` - which leaves this state
     * unasserted otherwise.
     *
     * Hold the callback rather than delaying it. A timer would make this a race
     * against the render on whatever machine is running it; parking the
     * callback keeps the panel mid-build for exactly as long as the test wants,
     * and handing it back afterwards is what proves the build was pending and
     * not wedged.
     */
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ) {
        (window as unknown as { __finishCard?: () => void }).__finishCard = () =>
          original.call(this, callback, type, quality);
      };

      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });

    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("button", { name: /^Share/ }).click();

    const panel = page.getByRole("dialog", { name: /^Share / });
    await expect(panel.getByText("Building the card")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);

    const copy = panel.getByRole("button", { name: /Copy the link/ });
    await copy.scrollIntoViewIfNeeded();
    await copy.click();

    await expect(panel.getByRole("button", { name: /Link copied/ })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied),
    ).toEqual(["https://danavner.com/shows/bruno-mars-madrid-2026"]);

    // Let the render finish. The card arriving is what says the panel was
    // waiting on a build rather than stuck in a state it could not leave.
    // Waited for rather than assumed: the panel says "Building the card" from
    // the moment the render starts, which is before it reaches the canvas.
    await page.waitForFunction(() =>
      Boolean((window as unknown as { __finishCard?: () => void }).__finishCard),
    );
    await page.evaluate(() => (window as unknown as { __finishCard: () => void }).__finishCard());
    await expect(page.locator("img[alt^='Share card']")).toBeVisible({ timeout: 15_000 });
  });

  test("a show whose photo will not load keeps its card", async ({ page }) => {
    /*
     * The half of `loadImage`'s null path that belongs to a show, and the
     * baseline for the now entry's opposite behaviour further down. `loadImage`
     * resolves null rather than throwing, so a photo that cannot be fetched or
     * decoded costs the card its picture and nothing else - a show still has a
     * name, a lineup, a rating, a venue and a date to fill the canvas.
     *
     * Aborting the requests rather than pointing at a missing file: the build
     * already refuses a photo path that does not exist, so the only way this
     * happens in production is the browser failing to fetch something that is
     * in the deploy.
     */
    await page.route("**/img/**", (route) => route.abort());

    await page.goto("/shows/bruno-mars-madrid-2026");
    await page.getByRole("button", { name: /^Share/ }).click();

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("dialog", { name: /^Share / }).getByText("Could not build the card."),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Save the card/ })).toBeVisible();
  });

  test("escape closes the panel and hands focus back", async ({ page }) => {
    await page.goto("/shows/bruno-mars-madrid-2026");
    const trigger = page.getByRole("button", { name: /^Share/ });
    await trigger.click();

    // Opening moves focus into the panel, which is also when Escape is armed.
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("picking a different cover redraws the card", async ({ page }) => {
    // Hashing the PNG rather than watching the object URL: a fresh URL is
    // handed out on every render whether or not the pixels changed, so it
    // would pass even if the chosen photo never reached the canvas.
    const cardHash = () =>
      page.evaluate(async () => {
        const img = document.querySelector<HTMLImageElement>("img[alt^='Share card']")!;
        const bytes = await (await fetch(img.src)).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      });

    await page.goto("/shows/warped-tour-long-beach-2026-day-2");
    await page.getByRole("button", { name: /^Share/ }).click();
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible({ timeout: 15_000 });

    const covers = page.getByRole("radio");
    // The picker only appears once the first card has rendered, so wait on it.
    await expect(covers.first()).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    expect(await covers.count()).toBeGreaterThan(1);

    const before = await cardHash();

    await covers.nth(2).click();
    await expect(covers.nth(2)).toHaveAttribute("aria-checked", "true");
    await expect.poll(cardHash, { timeout: 15_000 }).not.toBe(before);

    // The panel survives the redraw: rendered only in the "ready" state it
    // would vanish mid-render when the cover is switched.
    await expect(page.getByRole("radiogroup", { name: /Photo on the card/ })).toBeVisible();

    // And focus stays on the cover you pressed rather than being yanked back
    // to the panel, which is what re-running the open effect would do.
    await expect(covers.nth(2)).toBeFocused();
  });

  test("every logged show links to its own page", async ({ page }) => {
    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();

    for (const slug of SLUGS) {
      await expect(page.locator(`a[href="/shows/${slug}"]`).first()).toBeAttached();
    }
  });

  test("the repeat boards count what the files say", async ({ page }) => {
    // Derived from the markdown rather than hard-coded, so the numbers cannot
    // drift as entries are added.
    const read = (slug: string) => readFileSync(path.join(SHOWS_DIR, `${slug}.md`), "utf8");

    const bands = SLUGS.flatMap(
      (slug) =>
        /lineup:\n((?:\s+-\s.*\n)+)/
          .exec(read(slug))?.[1]
          .trim()
          .split("\n")
          .map((line) => line.replace(/^\s*-\s*/, "").trim()) ?? [],
    );
    const venues = SLUGS.map(
      (slug) => /^venue:\s*(.+)$/m.exec(read(slug))?.[1].trim() ?? "",
    ).filter(Boolean);

    /** Top five by count, repeats only, ties alphabetical - the board's rule. */
    const ranked = (values: string[]) => {
      const tally = new Map<string, number>();
      for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
      return [...tally]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5);
    };

    await page.goto("/shows");
    await page.getByRole("heading", { level: 1 }).waitFor();

    for (const [slot, expected, unit] of [
      ["seen-most", ranked(bands), "time"],
      ["been-most", ranked(venues), "night"],
    ] as const) {
      const rows = page.locator(`[data-slot=${slot}] li`);
      await expect(rows, `${slot} row count`).toHaveCount(expected.length);

      for (const [index, [name, count]] of expected.entries()) {
        // `readout-dim` uppercases the count, so compare case-insensitively.
        const text = (await rows.nth(index).innerText()).replace(/\s+/g, " ").toLowerCase();
        expect(text, `${slot} row ${index}`).toContain(name.toLowerCase());
        expect(text, `${slot} row ${index}`).toContain(
          `${count} ${unit}${count === 1 ? "" : "s"}`.toLowerCase(),
        );
      }
    }

    // The whole point is repeats; a board padded out with one-offs is the log
    // again in a different order.
    expect(ranked(venues).length, "no venue repeats to check").toBeGreaterThan(0);
  });

  test("an unknown show slug falls back to the log", async ({ page }) => {
    await page.goto("/shows/not-a-show");
    await page.waitForURL("**/shows");
  });
});

/**
 * The now sheet. Three of these have no subject until an entry has photos, so
 * they are written and skipped with a reason rather than left out - a skip
 * prints on every run, where an absent test just leaves the suite green over a
 * path nothing entered. `nowEntriesWithPhotos` is the one predicate behind all
 * of them, so they lift together and nothing here is edited when they do.
 */
test.describe("share a now entry", () => {
  /** The prose an entry carries, near enough - the frontmatter block dropped. */
  const proseLength = (date: string) =>
    readFileSync(path.join(NOW_DIR, `${date}.md`), "utf8")
      .replace(/^---[\s\S]*?---/, "")
      .trim().length;

  /*
   * Bounds on the excerpt band, not predictions of it. The layout is built to
   * roughly ten 40px lines at ~44 characters, so ~440 characters - and every
   * number behind that is arithmetic over estimated type metrics, which is the
   * whole reason these two tests exist. An entry of 700 characters has to
   * overflow any band close to the designed one; an entry of 150 has to fit
   * inside any band that holds even four lines. Widen the band far enough for
   * either to stop holding and these fail and say so.
   */
  const LONG = 700;
  const SHORT = 150;

  const withPhotos = nowEntriesWithPhotos();
  const longEntry = withPhotos.find((date) => proseLength(date) >= LONG);
  const shortEntry = withPhotos.find((date) => proseLength(date) <= SHORT);

  /*
   * An entry long enough to overflow the band in its *first* paragraph, which
   * is a different subject from `longEntry`: a long entry written in short
   * paragraphs cuts at a paragraph boundary and never enters the fallback.
   * Measured on the paragraphs the card is actually built from rather than on
   * the file, so frontmatter, a heading, or a photo block cannot pad it into
   * qualifying.
   */
  const overflowing = withPhotos.find(
    (date) => (nowParagraphs(bodyOf(date))[0] ?? "").length >= LONG,
  );

  /** Opens the sheet on one entry's permalink and hands back its panel. */
  async function openSheet(page: import("@playwright/test").Page, path: string) {
    await page.goto(path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("button", { name: /^Share/ }).click();
    return page.getByRole("dialog", { name: /^Share Now / });
  }

  test("the sheet opens and offers both link actions", async ({ page }) => {
    const panel = await openSheet(page, "/now");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await expect(panel.getByRole("button", { name: /Copy the link/ })).toBeVisible();
    // The URL belongs to the buttons, not to the panel's text.
    await expect(page.getByText("danavner.com/now/", { exact: false })).toHaveCount(0);
  });

  test("an entry without photos offers the link and no card", async ({ page }) => {
    /*
     * Not skipped: this is every entry today, and it is the first thing to enter
     * `renderCard`'s optional branch. It is also what keeps the photoless
     * fallback from quietly growing a poster later.
     */
    const withoutPhotos = NOW_DATES.filter((date) => !withPhotos.includes(date));
    test.skip(withoutPhotos.length === 0, "every now entry has photos - none takes the link path");

    const panel = await openSheet(page, `/now/${withoutPhotos[0]}`);
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);
    await expect(panel.getByRole("link", { name: /Save the card/ })).toHaveCount(0);
    // No build to sit through either - there is nothing to build.
    await expect(panel.getByText("Building the card")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /Copy the link/ })).toBeVisible();
  });

  test("an entry with photos builds a card", async ({ page }) => {
    test.skip(withPhotos.length === 0, PHOTO_GAP);

    const date = withPhotos[0];
    await openSheet(page, `/now/${date}`);

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });

    // A blank canvas is still a valid PNG, so check it has size.
    const size = await card.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth * (img as HTMLImageElement).naturalHeight,
    );
    expect(size).toBeGreaterThan(0);

    await expect(page.getByRole("link", { name: /Save the card/ })).toHaveAttribute(
      "download",
      `${date}.png`,
    );
  });

  test("an entry with two photos offers the cover picker", async ({ page }) => {
    const withTwo = nowEntriesWithPhotos(2);
    test.skip(withTwo.length === 0, "no now entry has two photos yet - cover picker unverified");

    // Hashing the PNG rather than watching the object URL: a fresh URL is handed
    // out on every render whether or not the pixels changed.
    const cardHash = () =>
      page.evaluate(async () => {
        const img = document.querySelector<HTMLImageElement>("img[alt^='Share card']")!;
        const bytes = await (await fetch(img.src)).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      });

    await openSheet(page, `/now/${withTwo[0]}`);

    const covers = page.getByRole("radio");
    await expect(covers.first()).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    expect(await covers.count()).toBeGreaterThan(1);

    const before = await cardHash();
    await covers.nth(1).click();
    await expect(covers.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect.poll(cardHash, { timeout: 15_000 }).not.toBe(before);
  });

  test("a long entry's card says where the rest is", async ({ page }) => {
    /*
     * The gate on the excerpt band's real capacity, replacing the manual
     * eyeball this would otherwise need - a step that fails open. `truncated`
     * is what turns the footer line into READ THE REST AT rather than READ IT
     * AT, so a card that silently presents part of an entry as the entry fails
     * here instead of shipping.
     */
    test.skip(
      longEntry === undefined,
      `no now entry of ${LONG}+ characters has photos yet - truncation unverified`,
    );

    await openSheet(page, `/now/${longEntry}`);
    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-truncated", "true");
  });

  test("a short entry's card carries the whole thing", async ({ page }) => {
    // The other half. Without it a renderer that flagged everything truncated
    // would pass the test above and put READ THE REST AT on a complete entry.
    test.skip(
      shortEntry === undefined,
      `no now entry under ${SHORT} characters has photos yet - the whole-entry card is unverified`,
    );

    await openSheet(page, `/now/${shortEntry}`);
    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-truncated", "false");
  });

  test("an entry whose photo will not load offers the link instead of a card", async ({ page }) => {
    /*
     * `renderNowCard` rejects when its photo cannot be decoded, deliberately
     * unlike `renderShowCard` above: strip the picture from a now card and what
     * is left is a date set large on an empty canvas, which is a screenshot of
     * a calendar rather than something worth sending. So the panel is expected
     * to degrade all the way to the link - which is why the link actions live
     * outside the `card` branch.
     */
    test.skip(withPhotos.length === 0, PHOTO_GAP);

    await page.addInitScript(() => {
      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });
    await page.route("**/img/**", (route) => route.abort());

    const date = withPhotos[0];
    const panel = await openSheet(page, `/now/${date}`);

    await expect(panel.getByText("Could not build the card.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);
    await expect(panel.getByRole("link", { name: /Save the card/ })).toHaveCount(0);

    // The page is still worth sending even though its poster is not.
    const copy = panel.getByRole("button", { name: /Copy the link/ });
    await copy.scrollIntoViewIfNeeded();
    await copy.click();

    await expect(panel.getByRole("button", { name: /Link copied/ })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied),
    ).toEqual([`https://danavner.com/now/${date}`]);
  });

  test("an entry whose opening paragraph alone overflows the band still draws", async ({
    page,
  }) => {
    /*
     * The excerpt's other path, and the one neither fixture above reaches. Both
     * of those take whole paragraphs while the next one fits; this is what runs
     * when even the first paragraph is taller than the band, so there is no
     * paragraph boundary to cut at - it wraps, keeps the lines that fit, and
     * cuts back to the last sentence-ending punctuation among them, or to the
     * last whole word.
     *
     * A person writing about their month without stopping for a paragraph break
     * is an ordinary way for an entry to arrive, and the path has never run: an
     * exception in it, or a cut that came back empty, currently shows the reader
     * "Could not build the card." So what is asserted is that the card is drawn
     * at all and still says where the rest is. The words on it are pixels, and
     * pinning those would mean reading a canvas.
     */
    test.skip(
      overflowing === undefined,
      `no now entry has photos and an opening paragraph of ${LONG}+ characters - the overflow fallback is unverified`,
    );

    await openSheet(page, `/now/${overflowing}`);
    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("data-truncated", "true");
  });
});

test.describe("the card's palette", () => {
  /**
   * The show whose card is measured. Any show with a photo would do; this one
   * is already the suite's share fixture.
   */
  const SHOW = "/shows/bruno-mars-madrid-2026";

  async function openCard(page: Page) {
    await page.goto(SHOW);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("button", { name: /^Share/ }).click();

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });
    return card;
  }

  test("the bloom is painted in the site's ember, not a copy of it", async ({ page }) => {
    /*
     * Read off the PNG rather than off the source, because a constant standing
     * in for a token is invisible to every check of the code: it compiles, it
     * paints, and it goes on painting the colour the site has stopped using.
     * The pixels are the only place that shows.
     *
     * The bloom's centre is the one pixel on a photo card whose colour is
     * arithmetic rather than photograph: the picture stops where the show
     * card's band ends, the fade with it, and the heading is set below and to
     * the left - so this is the glow at full strength over the card's own
     * black. The expectation is composited in the page from the token, so this
     * compares the card against the site rather than against a number written
     * down here. The coordinate tracks the band: move the photo and this fails
     * on the ground it lands in, which is the point.
     */
    const card = await openCard(page);

    const sample = await card.evaluate(async (img) => {
      const bitmap = new Image();
      bitmap.src = (img as HTMLImageElement).src;
      await bitmap.decode();

      const sheet = document.createElement("canvas");
      sheet.width = bitmap.naturalWidth;
      sheet.height = bitmap.naturalHeight;
      const context = sheet.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);
      const at = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);

      const probe = document.createElement("div");
      probe.className = "dark";
      probe.style.display = "none";
      document.body.append(probe);
      const ember = getComputedStyle(probe).getPropertyValue("--ember").trim();
      probe.remove();

      // The same compositing the card does, from the token rather than from the
      // card's own derivation of it.
      const swatch = document.createElement("canvas");
      swatch.width = swatch.height = 1;
      const paint = swatch.getContext("2d", { willReadFrequently: true })!;
      paint.fillStyle = "#08090d";
      paint.fillRect(0, 0, 1, 1);
      paint.fillStyle = `color-mix(in oklab, ${ember} 35%, transparent)`;
      paint.fillRect(0, 0, 1, 1);

      return {
        size: [sheet.width, sheet.height],
        bloom: at(540, 740),
        corner: at(4, sheet.height - 4),
        want: [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3),
        ember,
      };
    });

    expect(sample.size, "the card is not the sheet these coordinates were read from").toEqual([
      1080, 1920,
    ]);
    expect(sample.ember, "the dark ember token is not resolving").not.toBe("");
    // The card's own black, which is a value rather than a token.
    expect(sample.corner, "the corner is not the card's ground - the sample has moved").toEqual([
      8, 9, 13,
    ]);

    for (const [index, channel] of ["red", "green", "blue"].entries()) {
      expect(
        Math.abs(sample.bloom[index] - sample.want[index]),
        `the bloom's ${channel} is ${sample.bloom[index]} where the ember token gives ${sample.want[index]}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  test("a canvas ignores a colour that needs an element to resolve", async ({ page }) => {
    /*
     * The platform behaviour the palette is built around, pinned rather than
     * remembered. A canvas colour string has no element to resolve `var()`
     * against, and `fillStyle` answers an unparseable value by ignoring the
     * assignment - so a palette that handed the canvas `var(--ember)` would
     * paint whatever the previous fill was and report nothing.
     *
     * Two sentinels, because one read cannot tell an ignored assignment from a
     * successful one: an ignored assignment leaves each sentinel in place, so
     * the reads follow the sentinels rather than the value.
     *
     * If a future Chrome starts resolving these, this fails - and that is the
     * signal that the palette could be simpler, not that the test is wrong.
     */
    await page.goto(SHOW);

    const reads = await page.evaluate(() => {
      const context = document.createElement("canvas").getContext("2d")!;
      const twice = (colour: string) => {
        context.fillStyle = "#010203";
        context.fillStyle = colour;
        const first = context.fillStyle;
        context.fillStyle = "#040506";
        context.fillStyle = colour;
        return [first, context.fillStyle];
      };

      return {
        token: twice("var(--ember)"),
        mixed: twice("color-mix(in oklab, var(--ember) 35%, transparent)"),
        // Any resolved colour: the point is the form, not this value.
        resolved: twice("color-mix(in oklab, oklch(0.5 0.1 200) 35%, transparent)"),
        supports: [
          CSS.supports("color", "var(--ember)"),
          CSS.supports("color", "color-mix(in oklab, var(--ember) 35%, transparent)"),
        ],
      };
    });

    expect(reads.token, "a canvas resolved var() - the palette can stop resolving tokens").toEqual([
      "#010203",
      "#040506",
    ]);
    expect(reads.mixed, "a canvas resolved var() inside color-mix").toEqual(["#010203", "#040506"]);
    // The form the palette actually uses, proving the sentinels are not just
    // reporting that nothing works.
    expect(reads.resolved[0]).toBe(reads.resolved[1]);
    expect(reads.resolved[0]).not.toBe("#010203");
    // Why the check is a readback rather than a question to the CSS engine.
    expect(reads.supports, "CSS.supports would be a usable guard after all").toEqual([true, true]);
  });

  test("a token the canvas will not paint fails the card rather than the colour", async ({
    page,
  }) => {
    /*
     * The end of the chain the check above starts. A custom property holds any
     * token sequence at all, so a typo in the palette is a colour the canvas
     * shrugs at - and every fill after it lands in the previous colour. The
     * card would still render, still export, and still look almost right.
     *
     * Broken at the token rather than in the code, because that is the only way
     * in from outside; what it proves is that an unpaintable palette member
     * stops the card instead of quietly painting the wrong one.
     */
    await page.goto(SHOW);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.addStyleTag({ content: ".dark { --ember: not-a-colour; }" });

    await page.getByRole("button", { name: /^Share/ }).click();
    const panel = page.getByRole("dialog", { name: /^Share / });
    await expect(panel.getByText("Could not build the card.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("img[alt^='Share card']")).toHaveCount(0);
  });
});

/**
 * The album sheet, on the two surfaces that open it.
 *
 * `/dan-fm` and `/dan-fm/<slug>` render the same panel and differ in one prop,
 * so both are opened here: the address a panel sends is the whole of what the
 * prop decides, and a prop that stopped being passed would leave both surfaces
 * still building a card and still offering a link.
 *
 * The albums are picked off the log the build read rather than named, because
 * `dan-fm.json` is rewritten by the nightly job and the seed is a different log
 * again. A case with no album to run against skips with a reason - a skip
 * prints on every run, where an absent test leaves the suite green over a path
 * nothing entered.
 */
test.describe("share an album", () => {
  const ALBUMS = albumsOnDisk();

  /** What `/dan-fm` puts on the card: `station()`'s newest row by date. */
  const FEATURED = ALBUMS.reduce<LoggedAlbum | undefined>(
    (latest, album) => (!latest || album.date > latest.date ? album : latest),
    undefined,
  );

  /*
   * Bounds on the body block, not predictions of it. The take is set at 40px
   * over 888px, which is around 43 characters a line, and the block runs from
   * under the score down to 1556.
   *
   * The sleeve is what makes that budget tight. A 760px band and the 40px of
   * air under it start the type at 800 where a card with no picture starts it
   * at 620, so an album with art has 180px less to set a verdict and an
   * excerpt in - and the excerpt is measured out of what the take leaves, so
   * it is the half that goes first. Two 56px lines of take is what still
   * leaves a 46px line for the excerpt to be drawn on under the headings the
   * log carries; three does not.
   *
   * So a take under `WHOLE_TAKE` is those two lines, and one over `CUT_TAKE`
   * is more lines than the excerpt could ever have reserved - which is what
   * makes a take that survives whole beside a review one that had first claim
   * on the sheet rather than one that was short enough not to matter. A review
   * over `LONG_REVIEW` is several times the two 46px lines the excerpt is cut
   * to, so a card carrying one is drawing an excerpt rather than a review that
   * happened to fit. Move the block or shrink the sheet far enough for any of
   * that to stop holding and these fail and say so.
   */
  const WHOLE_TAKE = 80;
  const CUT_TAKE = 150;
  const LONG_REVIEW = 400;

  /*
   * The other end of that measure. The excerpt is set at 34px over the same
   * 888px, which is around fifty characters a line, so a review under
   * `WHOLE_REVIEW` is one two lines hold entire - a card carrying it has left
   * nothing behind to send anyone after.
   */
  const WHOLE_REVIEW = 120;

  /**
   * The sleeve band, and the rows of it the 420px fade into the sheet has not
   * reached - which is the part of a picture that arrives at full strength.
   */
  const SLEEVE_HEIGHT = 760;
  const SLEEVE_CLEAR = SLEEVE_HEIGHT - 420;

  /** How far a sleeve pushes the type down: the band and its air, against the 620 without. */
  const BAND_DROP = SLEEVE_HEIGHT + 40 - 620;

  /** The card's footer rule, 300px off the foot of a 1920px sheet. */
  const FOOTER_RULE = 1620;

  const reviewed = ALBUMS.find(
    (album) =>
      album.review.trim().length >= LONG_REVIEW &&
      album.take.trim() !== "" &&
      album.take.length <= WHOLE_TAKE,
  );
  const unreviewed = ALBUMS.find((album) => album.review.trim() === "" && album.take.trim() !== "");
  const longTake = ALBUMS.find(
    (album) => album.take.length >= CUT_TAKE && album.review.trim().length >= LONG_REVIEW,
  );

  /**
   * An album the card cannot have carried whole. `LONG_REVIEW` is several times
   * the two lines an excerpt is cut to, so this holds whatever room the take
   * left the excerpt - including none of it, which is the sheet that needs the
   * line most.
   */
  const cutReview = ALBUMS.find((album) => album.review.trim().length >= LONG_REVIEW);

  /**
   * The opposite: a review two lines hold entire, under a take short enough to
   * leave two lines free. Both halves are the fixture - a review the excerpt
   * would have carried whole is still cut on a sheet the take has filled.
   */
  const wholeReview = ALBUMS.find(
    (album) =>
      album.take.trim() !== "" &&
      album.take.length <= WHOLE_TAKE &&
      album.review.trim() !== "" &&
      album.review.trim().length <= WHOLE_REVIEW,
  );

  /** The newest album the log gives a sleeve, which is the only card that draws one. */
  const covered = ALBUMS.find((album) => album.cover !== "");

  /** Opens the sheet on one page and hands back the card once it is drawn. */
  async function openCard(page: Page, path: string): Promise<Locator> {
    await page.goto(path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("button", { name: /^Share/ }).click();

    const card = page.locator("img[alt^='Share card']");
    await expect(card).toBeVisible({ timeout: 15_000 });
    return card;
  }

  /** Records what the panel's link actions hand the OS, before the page loads. */
  async function stubClipboard(page: Page) {
    await page.addInitScript(() => {
      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });
  }

  /** What `Copy the link` put on the clipboard. */
  async function copyLink(page: Page): Promise<string[]> {
    const panel = page.getByRole("dialog", { name: /^Share / });
    const copy = panel.getByRole("button", { name: /Copy the link/ });
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    await expect(panel.getByRole("button", { name: /Link copied/ })).toBeVisible();
    return page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  }

  /**
   * The runs of rows the card laid ink down on, each named by the palette
   * colour it was painted in.
   *
   * The words on a poster are pixels, so what a test can read off one is where
   * a mark was made and what colour it was. Every fill a card makes is one of
   * three resolved tokens, and the brightest pixel of a run of text is that
   * fill at full opacity - so the brightest pixel names the run, and it names
   * it exactly rather than within a tolerance. The tokens are read off the page
   * the way `palette()` reads them, so this compares the card against the site
   * rather than against numbers written down here.
   *
   * Rows carrying nothing but the ember bloom stay under the threshold: the
   * glow is a 900px radius from a centre well above the body, so it is under a
   * tenth of the ember by the time it reaches the block the take is set in.
   *
   * Runs are left unmerged, and the cases below read the last of them rather
   * than counting them: a line whose glyphs happen not to touch the line under
   * it splits a block in two, which changes how many runs there are and not
   * which colour the block ends in.
   */
  async function marks(card: Locator) {
    return card.evaluate(async (img) => {
      const bitmap = new Image();
      bitmap.src = (img as HTMLImageElement).src;
      await bitmap.decode();

      const sheet = document.createElement("canvas");
      sheet.width = bitmap.naturalWidth;
      sheet.height = bitmap.naturalHeight;
      const context = sheet.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);

      const probe = document.createElement("div");
      probe.className = "dark";
      probe.style.display = "none";
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const tokens = {
        ink: style.getPropertyValue("--foreground").trim(),
        dim: style.getPropertyValue("--muted-foreground").trim(),
        ember: style.getPropertyValue("--ember").trim(),
      };
      probe.remove();

      const swatch = document.createElement("canvas");
      swatch.width = swatch.height = 1;
      const paint = swatch.getContext("2d", { willReadFrequently: true })!;
      const resolved = Object.entries(tokens).map(([name, colour]) => {
        paint.clearRect(0, 0, 1, 1);
        paint.fillStyle = colour;
        paint.fillRect(0, 0, 1, 1);
        return [name, [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3)] as const;
      });

      const pixels = context.getImageData(0, 0, sheet.width, sheet.height).data;
      const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Half of the dimmest thing a card writes with, which is the muted ink.
      const MARK = 90;

      const runs: { top: number; bottom: number; colour: string }[] = [];
      let run: { top: number; bottom: number; brightest: number[] } | null = null;

      for (let y = 0; y < sheet.height; y++) {
        let brightest = [0, 0, 0];
        for (let x = 0; x < sheet.width; x++) {
          const at = (y * sheet.width + x) * 4;
          const pixel = [pixels[at], pixels[at + 1], pixels[at + 2]];
          if (luma(pixel) > luma(brightest)) brightest = pixel;
        }

        if (luma(brightest) >= MARK) {
          run ??= { top: y, bottom: y, brightest };
          run.bottom = y;
          if (luma(brightest) > luma(run.brightest)) run.brightest = brightest;
        } else if (run) {
          const [colour] = resolved
            .map(
              ([name, rgb]) =>
                [name, rgb.reduce((d, c, i) => d + (c - run!.brightest[i]) ** 2, 0)] as const,
            )
            .sort((a, b) => a[1] - b[1])[0];
          runs.push({ top: run.top, bottom: run.bottom, colour });
          run = null;
        }
      }

      return { size: [sheet.width, sheet.height], runs };
    });
  }

  /** The marks above the footer rule, which is everything the body drew. */
  async function body(card: Locator) {
    const { size, runs } = await marks(card);
    expect(size, "the card is not the sheet these coordinates were read from").toEqual([
      1080, 1920,
    ]);
    return runs.filter((run) => run.top < FOOTER_RULE);
  }

  /**
   * The marks at or below the footer rule, which is everything under the body.
   *
   * `body` stops at the rule, so the band the date, the day count and the
   * address are set in is invisible to every case that reads a card as its
   * body. This is the rest of the same sheet, cut on the same row, so between
   * them they see every run once.
   */
  async function footer(card: Locator) {
    const { size, runs } = await marks(card);
    expect(size, "the card is not the sheet these coordinates were read from").toEqual([
      1080, 1920,
    ]);
    return runs.filter((run) => run.top >= FOOTER_RULE);
  }

  /**
   * The brightest pixel in each row of the sleeve band, down to where the fade
   * into the sheet begins.
   *
   * Measured rather than classified, because a picture is not type: `marks`
   * finds a run only where a row clears the threshold a line of ink sets, and a
   * sleeve can sit under that for its whole height without being any less
   * drawn. What a case does with this is compare two renders of one album, so
   * nothing here has to decide how light a sleeve ought to be.
   */
  async function bandRows(card: Locator): Promise<number[]> {
    return card.evaluate(async (img, clear) => {
      const bitmap = new Image();
      bitmap.src = (img as HTMLImageElement).src;
      await bitmap.decode();

      const sheet = document.createElement("canvas");
      sheet.width = bitmap.naturalWidth;
      sheet.height = clear;
      const context = sheet.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);

      const pixels = context.getImageData(0, 0, sheet.width, clear).data;
      const rows: number[] = [];

      for (let y = 0; y < clear; y++) {
        let brightest = 0;
        for (let x = 0; x < sheet.width; x++) {
          const at = (y * sheet.width + x) * 4;
          const luma = 0.2126 * pixels[at] + 0.7152 * pixels[at + 1] + 0.0722 * pixels[at + 2];
          if (luma > brightest) brightest = luma;
        }
        rows.push(brightest);
      }

      return rows;
    }, SLEEVE_CLEAR);
  }

  /** One card, read as the runs of type on it and as the light in its sleeve band. */
  async function sheetOf(page: Page, slug: string) {
    const card = await openCard(page, `/dan-fm/${slug}`);
    return { card, runs: await body(card), band: await bandRows(card) };
  }

  /**
   * One album drawn twice: with its sleeve, and with the sleeve refused.
   *
   * A blocked request is what `loadImage`'s null actually looks like from
   * outside - a cover the deploy has not caught up with, a file the prune took,
   * a reader on a connection that dropped the image and kept the page. It is
   * also the only way to hold everything but the picture still, which is what
   * lets a case ask what the sleeve alone was worth.
   */
  async function litAndBare(page: Page, slug: string) {
    const lit = await sheetOf(page, slug);
    await page.route("**/img/dan-fm/**", (route) => route.abort());

    return { lit, bare: await sheetOf(page, slug) };
  }

  test("sharing from the station sends the station, not the album on it", async ({ page }) => {
    /*
     * The whole of the `url` prop. Tomorrow the front page is a different
     * record, so a link sent from it has to land on the station rather than on
     * the album that happened to be on when it was sent.
     */
    test.skip(FEATURED === undefined, "the log the build read is empty - the station has no panel");

    await stubClipboard(page);
    await openCard(page, "/dan-fm");

    expect(await copyLink(page)).toEqual(["https://danavner.com/dan-fm"]);
  });

  test("the station's poster is still the album that is on air", async ({ page }) => {
    // The other half of the same decision: the address changes and the subject
    // does not. A panel that took the station as its subject as well as its
    // address would draw a poster of the page rather than of the record.
    test.skip(FEATURED === undefined, "the log the build read is empty - the station has no panel");

    await openCard(page, "/dan-fm");

    await expect(page.getByRole("dialog", { name: /^Share / })).toHaveAccessibleName(
      `Share ${FEATURED!.artist} - ${FEATURED!.album}`,
    );
    await expect(page.getByRole("link", { name: /Save the card/ })).toHaveAttribute(
      "download",
      `${FEATURED!.slug}.png`,
    );
  });

  test("sharing from an album's own page sends that album", async ({ page }) => {
    // The default the prop falls back to, which is every surface but the
    // station: the poster was built from this page, so this page is where the
    // link lands.
    test.skip(FEATURED === undefined, "the log the build read is empty - there are no album pages");

    await stubClipboard(page);
    await openCard(page, `/dan-fm/${FEATURED!.slug}`);

    expect(await copyLink(page)).toEqual([`https://danavner.com/dan-fm/${FEATURED!.slug}`]);
  });

  test("the front of the review is drawn under the take, in the dim ink", async ({ page }) => {
    /*
     * What the excerpt is for, and the one thing about it a test can see: it is
     * below the verdict and it is not painted in the verdict's ink. Set in the
     * ink and it reads as a second verdict rather than as the paragraph it was
     * lifted from, and nothing about the code would look wrong.
     */
    test.skip(
      reviewed === undefined,
      `no album has a take under ${WHOLE_TAKE} characters and a review over ${LONG_REVIEW} - the excerpt is undrawn`,
    );

    const card = await openCard(page, `/dan-fm/${reviewed!.slug}`);
    const runs = await body(card);

    expect(runs.at(-1)?.colour, "the last thing the body drew is not the muted ink").toBe("dim");
    const take = runs.filter((run) => run.colour === "ink").at(-1);
    expect(take, "nothing was drawn in the ink at all").toBeDefined();
    expect(take!.bottom, "the excerpt is not under the take").toBeLessThan(runs.at(-1)!.top);
  });

  test("an album with no review draws nothing under its take", async ({ page }) => {
    /*
     * The other half. Without it a renderer that reserved the gap and the two
     * lines whatever the review held would pass the case above and hand every
     * album without one a band of empty sheet under the verdict.
     */
    test.skip(
      unreviewed === undefined,
      "every album in the log the build read has a review - the empty-review card is unverified",
    );

    const card = await openCard(page, `/dan-fm/${unreviewed!.slug}`);
    const runs = await body(card);

    expect(
      runs.at(-1)?.colour,
      "something was drawn under the take on an album with no review",
    ).toBe("ink");
  });

  test("the review stops above the footer rule", async ({ page }) => {
    // The excerpt is fitted out of the same budget as the take and drawn after
    // it, so an excerpt measured against the wrong top would run into the rule
    // and land on the date under it.
    test.skip(
      reviewed === undefined,
      `no album has a take under ${WHOLE_TAKE} characters and a review over ${LONG_REVIEW} - the excerpt is undrawn`,
    );

    const card = await openCard(page, `/dan-fm/${reviewed!.slug}`);
    const runs = await body(card);

    expect(runs.at(-1)!.bottom, "the body ran into the footer rule").toBeLessThan(FOOTER_RULE - 8);
  });

  test("a cut review does not mark the card as a cut take", async ({ page }) => {
    /*
     * `truncated` is the take's alone. The share sheet turns it into READ THE
     * REST AT, which is a claim about the whole subject - and an excerpt is a
     * cut review by definition, so a card that flagged one would say every
     * album with a review was only half said.
     */
    test.skip(
      reviewed === undefined,
      `no album has a take under ${WHOLE_TAKE} characters and a review over ${LONG_REVIEW} - the excerpt is undrawn`,
    );

    const card = await openCard(page, `/dan-fm/${reviewed!.slug}`);
    await expect(card).toHaveAttribute("data-truncated", "false");
  });

  test("a card that left part of the review behind says where the rest is", async ({ page }) => {
    /*
     * A poster carries two dim lines of a piece that runs to a page, and on a
     * sheet the take has filled it carries none at all. Nothing else on it says
     * there is more, so a reader has no reason to go looking - this line is the
     * whole of what sends them.
     *
     * Read under the footer rule, where `body` stops: the line sits between the
     * day count and the address, which is the one band a case about the body
     * cannot see. Located against its neighbours rather than at a row, because
     * what it has to be is the second dim line of the footer and not a
     * particular pixel.
     */
    test.skip(
      cutReview === undefined,
      `no album in the log the build read has a review over ${LONG_REVIEW} characters - the cut review is undrawn`,
    );

    const card = await openCard(page, `/dan-fm/${cutReview!.slug}`);
    const runs = await footer(card);

    const address = runs.at(-1);
    expect(address?.colour, "the address is not the last mark on the sheet").toBe("ember");

    const dim = runs.filter((run) => run.colour === "dim");
    expect(
      dim,
      "the footer drew one dim line where the day count and the review line are two",
    ).toHaveLength(2);
    expect(dim[1].top, "the line is not under the day count").toBeGreaterThan(dim[0].bottom);
    expect(dim[1].bottom, "the line is not over the address").toBeLessThan(address!.top);
  });

  test("an album with no review is not pointed at one", async ({ page }) => {
    /*
     * The half that keeps the line honest. A footer that drew it whatever the
     * album held would satisfy the case above and then promise every reader of
     * an unreviewed record a review nobody wrote.
     */
    test.skip(
      unreviewed === undefined,
      "every album in the log the build read has a review - the empty-review footer is unverified",
    );

    const card = await openCard(page, `/dan-fm/${unreviewed!.slug}`);

    expect(
      (await footer(card)).filter((run) => run.colour === "dim"),
      "a line was drawn under the day count on an album with no review",
    ).toHaveLength(1);
  });

  test("a review the card carried whole is not offered as having more", async ({ page }) => {
    /*
     * The half a reader would actually catch. The poster is already showing
     * every word of this review, so a line offering the full one sends them to
     * what they have just finished reading - and a card that drew the line
     * whenever an album had a review at all would look right on every other
     * album in the log.
     *
     * The excerpt is checked as drawn first, because a card that dropped the
     * review entirely also has nothing to point at and would satisfy the
     * footer assertion for the opposite reason.
     */
    test.skip(
      wholeReview === undefined,
      `no album has a take under ${WHOLE_TAKE} characters and a review under ${WHOLE_REVIEW} - the whole-review card is unverified`,
    );

    const card = await openCard(page, `/dan-fm/${wholeReview!.slug}`);

    expect((await body(card)).at(-1)?.colour, "the review was not drawn at all").toBe("dim");
    expect(
      (await footer(card)).filter((run) => run.colour === "dim"),
      "the footer offered a full review of one the card had shown whole",
    ).toHaveLength(1);
  });

  test("a take that fits the card whole is not cut to make room for the review", async ({
    page,
  }) => {
    /*
     * The verdict has first claim on the sheet. A take of this length fits the
     * card whole on its own, so it still has to fit whole beside a review: the
     * excerpt is what is left over, and what is left over is measured after the
     * take has taken what it wants rather than after it has been held to a
     * floor.
     *
     * Read off `truncated` because that is where the consequence lands - a card
     * that cut the take says READ THE REST AT under a sentence that was going
     * to finish anyway.
     */
    test.skip(
      longTake === undefined,
      `no album has a take over ${CUT_TAKE} characters and a review over ${LONG_REVIEW} - the take's claim on the sheet is unverified`,
    );

    const card = await openCard(page, `/dan-fm/${longTake!.slug}`);
    await expect(card).toHaveAttribute("data-truncated", "false");
  });

  test("an album with a sleeve starts its type a whole band lower", async ({ page }) => {
    /*
     * The layout half of what a cover changes, and the half a screenshot of a
     * finished card cannot argue with. A renderer that drew the sleeve and then
     * laid the readout out where a sleeveless card puts it would print the
     * station's name across the record.
     *
     * The lit card is read from the first run at or under the band rather than
     * from its first run outright, because a bright enough sleeve is a mark in
     * its own right and this is a question about where the type went.
     */
    test.skip(covered === undefined, "no album in the log the build read has a sleeve");

    const { lit, bare } = await litAndBare(page, covered!.slug);
    const under = lit.runs.find((run) => run.top >= SLEEVE_HEIGHT);

    expect(under, "nothing at all was drawn under the sleeve band").toBeDefined();
    expect(under!.top - bare.runs[0].top, "the sleeve did not move the type").toBe(BAND_DROP);
  });

  test("the sleeve band carries the picture rather than the bare sheet", async ({ page }) => {
    /*
     * Room made for a sleeve and a sleeve drawn into that room look identical
     * to every assertion about where the type sits, and a card that reserved
     * 760px and painted nothing into it is a poster with a black bar across the
     * top of it.
     *
     * Compared row for row against the same album with the sleeve refused, so
     * the ember bloom - which is painted over the band either way - cancels,
     * and what is left is whatever the picture added.
     */
    test.skip(covered === undefined, "no album in the log the build read has a sleeve");

    const { lit, bare } = await litAndBare(page, covered!.slug);

    expect(lit.band).toHaveLength(SLEEVE_CLEAR);
    expect(
      lit.band.filter((row, index) => row > bare.band[index]).length,
      "the band is no lighter with a sleeve in it than with none",
    ).toBe(SLEEVE_CLEAR);
  });

  test("a sleeve that will not load costs the card its picture and nothing else", async ({
    page,
  }) => {
    /*
     * `loadImage` resolves null rather than throwing, and this card is what
     * takes that bargain: a share that failed outright over a sleeve would cost
     * the reader the poster as well as the picture. So the band closes up, the
     * type moves back to where an album with no art sets it, and every other
     * mark on the sheet is made exactly as it would have been.
     */
    test.skip(covered === undefined, "no album in the log the build read has a sleeve");

    await page.route("**/img/dan-fm/**", (route) => route.abort());
    const card = await openCard(page, `/dan-fm/${covered!.slug}`);
    const runs = await body(card);

    expect(runs[0].top, "the type stayed under a band with nothing in it").toBeLessThan(
      SLEEVE_HEIGHT,
    );
    expect(
      runs.some((run) => run.colour === "ink"),
      "the card lost its type along with its picture",
    ).toBe(true);
    expect(runs.at(-1)!.bottom, "the body ran into the footer rule").toBeLessThan(FOOTER_RULE - 8);
    // The flag is a claim about the verdict, and a missing picture is not one.
    await expect(card).toHaveAttribute("data-truncated", "false");
  });
});
