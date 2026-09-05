import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";

/**
 * The album log's markdown subset, spelled once.
 *
 * `review` and `take` render as restricted CommonMark - no GFM anywhere on
 * the dan-fm path, unlike the blog and now pipelines, so tildes and pipes
 * stay the literal characters the author typed. Everything here parses bare
 * for that reason, and the parity is trivial because nobody registers
 * extensions: whatever `AlbumReview`'s renderer accepts, these validators
 * allow, and nothing more.
 *
 * Node-safe like `now-summary.ts`, and for the same reason: the build
 * validator in `vite-plugin-content.ts` calls this from Node, so imports stay
 * relative and bare - no `@/`, no `virtual:`. `scripts/update-dan-fm.mjs`
 * cannot import it at all (its spec stages the script alone in a throwaway
 * tree) and mirrors these rules instead, held in step by
 * `tests/markdown-cases.ts` - the `asQuarterStep` arrangement.
 *
 * Problem strings are predicates completing a sentence the caller opens -
 * "Review …" / "`albums[3]`.take …" - so both gates speak with one voice
 * from one spelling.
 */

type MdastNode = ReturnType<typeof fromMarkdown>["children"][number];

/** `toString`'s options - images and raw HTML contribute no words. */
const PLAIN = { includeImageAlt: false, includeHtml: false };

/**
 * Protocols a link may carry, plus site-relative paths starting `/`.
 * Stricter than react-markdown's own transform, which would blank a
 * `javascript:` href silently - a quietly empty link is the failure this
 * repo refuses, so the sheet hears about it instead.
 */
const LINK_OK = /^(?:https:|http:|mailto:|\/(?!\/))/;

/** The node's first source line, for quoting back at the author. */
function quoted(text: string, node: MdastNode): string {
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? start;
  const line = text.slice(start, end).split("\n", 1)[0].trim();
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

/** Every node in the tree, document order, depth first. */
function walk(nodes: readonly MdastNode[], visit: (node: MdastNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if ("children" in node) walk(node.children as MdastNode[], visit);
  }
}

/**
 * What a review may not carry. `[]` means valid - blank included, because not
 * every album gets a piece written about it.
 */
export function reviewProblems(text: string): string[] {
  const problems: string[] = [];

  walk(fromMarkdown(text).children, (node) => {
    if (node.type === "heading") {
      problems.push(
        `holds a heading ("${quoted(text, node)}"). The log's markdown is emphasis, links, lists and quotes.`,
      );
    } else if (node.type === "image" || node.type === "imageReference") {
      problems.push(
        `holds an image ("${quoted(text, node)}"). A pasted picture either leaves the origin or answers 404; the cover is the album's picture.`,
      );
    } else if (node.type === "html") {
      problems.push(
        `holds raw HTML ("${quoted(text, node)}"), which the page would silently skip rather than render.`,
      );
    } else if (node.type === "code") {
      problems.push(
        `holds a code block ("${quoted(text, node)}") - a fence, or four leading spaces, reads as code. Write plain text flush left.`,
      );
    } else if (node.type === "thematicBreak") {
      problems.push(
        `holds a "---" divider, which would render as a bare rule the page never styles.`,
      );
    } else if (node.type === "break") {
      problems.push(
        `holds a hard line break (two trailing spaces or a backslash before the newline) - invisible syntax in a cell that shows no trailing whitespace.`,
      );
    } else if (node.type === "link" || node.type === "definition") {
      if (!LINK_OK.test(node.url)) {
        problems.push(
          `links to "${node.url}", which is not a link the page will carry. A link is https:, http:, mailto:, or a path starting "/".`,
        );
      }
    }
  });

  return problems;
}

/**
 * A take is the sentence worth sending: everything a review refuses, plus
 * block constructs and any second paragraph.
 */
export function takeProblems(text: string): string[] {
  const problems = reviewProblems(text);
  const tree = fromMarkdown(text);

  walk(tree.children, (node) => {
    if (node.type === "list") {
      problems.push(`holds a list, and a take is one sentence. The long piece belongs in Review.`);
    } else if (node.type === "blockquote") {
      problems.push(`holds a quote, and a take is one sentence. The long piece belongs in Review.`);
    } else if (node.type === "definition") {
      problems.push(
        `holds a link definition ("${quoted(text, node)}"). Reference-style links belong in Review, where they have room.`,
      );
    }
  });

  const paragraphs = tree.children.filter((node) => node.type === "paragraph").length;
  if (paragraphs > 1) {
    problems.push(
      `holds a blank line, and a take is one paragraph. The long piece belongs in Review.`,
    );
  }

  return problems;
}

/**
 * A paragraph's phrasing content as one line, `now-summary.ts`'s walk without
 * the GFM cases: a hard break contributes the space its rendering stands for
 * (banned upstream, but this function stays total), and everything else
 * defers to `toString`.
 */
function phrasingText(nodes: readonly MdastNode[]): string {
  let text = "";
  for (const node of nodes) {
    if (node.type === "break") text += " ";
    else if ("children" in node) text += phrasingText(node.children as MdastNode[]);
    else text += toString(node, PLAIN);
  }
  return text;
}

/**
 * Every paragraph as plain text, in document order, whitespace collapsed -
 * list items and blockquote bodies are paragraph nodes and arrive as their
 * own entries, the way the page renders them as their own blocks.
 */
export function plainParagraphs(text: string): string[] {
  const found: string[] = [];

  const collect = (nodes: readonly MdastNode[]): void => {
    for (const node of nodes) {
      if (node.type === "paragraph") {
        const line = phrasingText(node.children).replace(/\s+/g, " ").trim();
        if (line) found.push(line);
        continue;
      }
      if ("children" in node) collect(node.children as MdastNode[]);
    }
  };

  collect(fromMarkdown(text).children);
  return found;
}

/** The whole field as one line - what the share card draws. */
export function plainText(text: string): string {
  return plainParagraphs(text).join(" ");
}

/**
 * Every link target in the field, document order - `link` and `definition`
 * URLs both. Callers filter: the validators check `/dan-fm/` targets against
 * the sheet, and `links.spec` walks the site-relative rest.
 */
export function danFmLinks(text: string): string[] {
  const urls: string[] = [];
  walk(fromMarkdown(text).children, (node) => {
    if (node.type === "link" || node.type === "definition") urls.push(node.url);
  });
  return urls;
}
