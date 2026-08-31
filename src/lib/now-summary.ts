import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";

import { longDate } from "./dates";

/**
 * How a now entry describes itself: its title, its date, and its prose reduced
 * to plain paragraphs.
 *
 * Same discipline as `show-summary.ts`, and for the same reason. The build
 * calls this from Node while writing the per-entry HTML, and the browser calls
 * it for the tab title and the share card, so nothing here may be reached
 * through the app's module graph - Vite's own config resolves no `@/` alias and
 * no `virtual:` specifier. `./dates` is spelled relatively for that reason, and
 * the markdown packages are bare specifiers, which the config's esbuild bundle
 * leaves external and Node loads as the ESM they are.
 *
 * `NowEntryLike` is declared structurally rather than derived from the app's
 * `NowEntry`, which imports `virtual:now` and cannot be named from the Node
 * side. Any real entry satisfies it.
 */
export interface NowEntryLike {
  /** ISO date, `YYYY-MM-DD`. */
  updated: string;
  /** Markdown, with the frontmatter block already removed. */
  body: string;
  /**
   * Not read by anything here, and part of the shape on purpose: the build
   * takes `photos[0].src` for `og:image` in the same loop that calls these
   * functions, so an entry that satisfies this interface is an entry the whole
   * of that loop can handle.
   */
  photos: { src: string }[];
}

/**
 * Anything the parser can hang under a document.
 *
 * Read off the parser's own return type rather than imported from `mdast`.
 * Those types exist only because `mdast-util-from-markdown` depends on them, so
 * naming the package would mean declaring `@types/mdast` as well to say
 * something the parser's signature already says.
 */
type MdastNode = ReturnType<typeof fromMarkdown>["children"][number];

/**
 * The GFM syntax, registered for this parser the way `remark-gfm` registers it
 * for the page's.
 *
 * This is the parity, and it is load-bearing rather than decorative: without
 * it, `~~struck~~` keeps its tildes in the description, a table is read out as
 * one run-on line of pipes, `- [ ] Buy milk` describes itself as "[ ] Buy
 * milk", and `[^1]: A note.` is not a footnote at all but an ordinary second
 * paragraph - so an entry's description can quote a sentence that appears
 * nowhere in the prose the reader sees. That last one is the failure this
 * module exists to prevent, arriving by a different door.
 *
 * `remark-gfm` does exactly these two registrations on the parse side, with no
 * options, which is how `NowProse` passes it. The invariant is therefore
 * checkable rather than hoped for: whatever is in `NowProse`'s `remarkPlugins`
 * has to be represented here, and a plugin added there without a line here puts
 * the two parsers back out of step.
 */
const GFM = {
  extensions: [gfm()],
  mdastExtensions: [gfmFromMarkdown()],
};

/** `toString`'s two options, spelled once - `collectParagraphs` says why both are off. */
const PLAIN = { includeImageAlt: false, includeHtml: false };

/**
 * A paragraph's phrasing content as one line of text.
 *
 * `toString` on the paragraph would be the whole of this, but for one thing it
 * cannot express. It prints a node's `value`, or its children joined by nothing,
 * or - for a node carrying neither - the empty string. Inside a paragraph five
 * node types carry neither: `break`, `image`, `imageReference`, `html` and
 * `footnoteReference`. Four of those are right to print nothing - an image
 * either way round is a picture rather than words, raw HTML is not rendered at
 * all, and a footnote reference prints a superscript marker that is an
 * affordance and not part of the sentence. All four also sit between text that
 * carries its own spacing, so dropping them leaves the words either side still
 * separated.
 *
 * `break` is the one that is not like them, and it is the whole of the class it
 * is in: the node *is* the separator. Markdown eats the two trailing spaces or
 * the backslash and the newline that wrote it, so nothing else in the paragraph
 * holds that gap. The page renders `<br>` and the reader sees two lines;
 * `toString` joins them into `oneline`, a word printed nowhere on the page. That
 * is the fabricated-text failure this module exists to prevent, so a break
 * contributes the space its rendering stands for, and the collapse in
 * `collectParagraphs` folds it into whatever is already there.
 *
 * Written as a walk rather than as a scan of the paragraph's own children
 * because a break nests: `*first  \nsecond*` puts one inside an `emphasis`, and
 * a scan one level deep would miss it. Everything that is not a break defers to
 * `toString`, so the two options above stay the only statement about images and
 * HTML.
 */
function phrasingText(nodes: readonly MdastNode[]): string {
  let text = "";

  for (const node of nodes) {
    if (node.type === "break") text += " ";
    else if ("children" in node) text += phrasingText(node.children);
    else text += toString(node, PLAIN);
  }

  return text;
}

/**
 * Every paragraph in the document, in order, flattened to one line each.
 *
 * A paragraph rather than a top-level paragraph: a list's items and a
 * blockquote's body are paragraph nodes too, so prose written as a list arrives
 * as one line per item instead of vanishing. Headings, fenced code, thematic
 * breaks, tables and reference definitions hold no paragraph at all and so are
 * never collected, which is what they should be here - a meta description is
 * the entry's opening words, not its title, and a code block or a grid of
 * numbers read aloud as prose is noise.
 *
 * A footnote's definition is the one node skipped by name, and it earns that
 * because of the rule rather than despite it. Every other paragraph is taken
 * where it stands, since where it stands is where the page prints it. A
 * footnote is printed in a section at the foot of the page wherever its
 * definition was written, so reading it in document order splices the aside
 * into the middle of the entry - text the reader never meets there, which is
 * the exact fault this module exists to prevent.
 *
 * The consequence of document order, stated so it is a decision and not a
 * surprise: an entry that opens with a pull quote or an epigraph is described
 * by the quote, not by the sentence under it. That is deliberate. The quote is
 * what a reader arriving at the page meets first, so a preview that led with
 * the second thing on the page would be the one that misrepresented it.
 *
 * Images print nothing. `toString` would otherwise splice an image's `alt` into
 * the sentence around it, and alt text is written to stand in for a picture in
 * place, not to be read as prose by someone who was never shown the picture -
 * "Before a cat after." describes nothing the reader can see. Raw HTML prints
 * nothing for the plainer reason that the app renders none: there is no
 * `rehype-raw` in the markdown pipeline, so a stray tag is invisible on the
 * page and has no business in the description of it.
 */
function collectParagraphs(nodes: readonly MdastNode[], into: string[]): void {
  for (const node of nodes) {
    if (node.type === "footnoteDefinition") continue;

    if (node.type === "paragraph") {
      const text = phrasingText(node.children).replace(/\s+/g, " ").trim();
      if (text) into.push(text);
      continue;
    }

    if ("children" in node) collectParagraphs(node.children, into);
  }
}

/**
 * The body as plain paragraphs, markdown taken off.
 *
 * Parsed rather than stripped by hand. Stripping markdown by hand is a set of
 * rules about brackets, and it corrupts content three ways: a destination
 * containing `)` takes the label with it, a paragraph opening `[Update]:` is
 * deleted whole as a reference definition, and an unclosed `[` earlier in a
 * paragraph swallows the next real link. Markdown's grammar is not a set of
 * rules about brackets, so the parser that already ships in this repo reads it
 * instead.
 *
 * `mdast-util-from-markdown` is what `react-markdown` parses with, by way of
 * `remark-parse`, and `GFM` above carries over the one plugin `NowProse` adds,
 * so the browser bundle gains nothing it was not already carrying and this
 * reads the entry as the same syntax the page renders. These packages are
 * synchronous and none of them needs a unified pipeline, which is what makes a
 * parser look heavier for the Node side than it is.
 *
 * One reader with two consumers, deliberately - the card wants the paragraph
 * breaks and the meta description wants one line, and deriving both from the
 * same output is what stops a shared link previewing with different words than
 * the page it points at.
 */
export function nowParagraphs(body: string): string[] {
  const found: string[] = [];
  collectParagraphs(fromMarkdown(body, GFM).children, found);
  return found;
}

/** "August 10, 2026" - the outlined half of the h1. */
export function nowDate(entry: Pick<NowEntryLike, "updated">): string {
  return longDate(entry.updated);
}

/**
 * "Now · August 10, 2026" - the page's one title string.
 *
 * Everything composes from it: the h1 sets its two halves, `useDocumentMeta`
 * appends the site name for the tab, the build appends the same for the emitted
 * `<title>`, and the share sheet uses it whole as the subject's heading. The
 * separator is `·` because that is what both existing title builders use, and
 * the tab and the served HTML disagreeing about one page's title is the exact
 * thing this module exists to prevent.
 */
export function nowTitle(entry: Pick<NowEntryLike, "updated">): string {
  return `Now · ${nowDate(entry)}`;
}

/** The opening paragraph, cut at a word boundary. The meta description. */
export function nowSummary(entry: Pick<NowEntryLike, "body">, limit = 160): string {
  const first = nowParagraphs(entry.body)[0] ?? "";
  if (first.length <= limit) return first;

  const cut = first.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}
