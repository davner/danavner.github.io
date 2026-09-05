/**
 * The dan-fm markdown contract as test cases, shared by both gates.
 *
 * The rules live twice on purpose - `src/lib/dan-fm-markdown.ts` for the
 * build, a mirror in `scripts/update-dan-fm.mjs` for the fetch (the script is
 * staged standalone by its spec and cannot import the module) - and this
 * table is what holds the two in step: `update-dan-fm.spec.ts` runs every
 * case through the script and `dan-fm.spec.ts` runs the same cases through
 * the module and the build validator. A construct decision that lands in one
 * mirror without the other fails the other's half of this table.
 */

export interface RefusalCase {
  /** Short name for test titles. */
  construct: string;
  /** Cell content carrying the construct. */
  cell: string;
  /** A substring every refusal message must contain, whichever gate speaks. */
  names: string;
  /** Reviews allow more than takes; a take-only case passes reviewProblems. */
  fields: "both" | "take-only";
}

export const REFUSALS: RefusalCase[] = [
  {
    construct: "a heading",
    cell: "## The room\n\nGreat sound.",
    names: "heading",
    fields: "both",
  },
  {
    construct: "an image",
    cell: "![the cover](https://example.com/cover.jpg)",
    names: "image",
    fields: "both",
  },
  {
    construct: "a reference image",
    cell: "![the cover][art]\n\n[art]: https://example.com/cover.jpg",
    names: "image",
    fields: "both",
  },
  { construct: "raw HTML", cell: "A <b>bold</b> record.", names: "HTML", fields: "both" },
  {
    construct: "a fenced code block",
    cell: "```\ntracklist\n```",
    names: "code block",
    fields: "both",
  },
  {
    construct: "an indented code block",
    cell: "The pasted bit:\n\n    four spaces deep",
    names: "code block",
    fields: "both",
  },
  {
    construct: "a thematic break",
    cell: "Side A.\n\n---\n\nSide B.",
    names: "divider",
    fields: "both",
  },
  {
    construct: "a hard break written as spaces",
    cell: "line one  \nline two",
    names: "hard line break",
    fields: "both",
  },
  {
    construct: "a hard break written as a backslash",
    cell: "line one\\\nline two",
    names: "hard line break",
    fields: "both",
  },
  {
    construct: "a javascript: link",
    cell: "[press play](javascript:alert(1))",
    names: "javascript:alert(1)",
    fields: "both",
  },
  {
    construct: "a data: link",
    cell: "[art](data:text/html,hello)",
    names: "data:text/html,hello",
    fields: "both",
  },
  {
    construct: "a protocol-relative link",
    cell: "[mirror](//example.com/x)",
    names: "//example.com/x",
    fields: "both",
  },
  {
    construct: "a bare relative link",
    cell: "[the shelf](vinyl)",
    names: '"vinyl"',
    fields: "both",
  },
  {
    construct: "a fragment link",
    cell: "[up top](#archive)",
    names: "#archive",
    fields: "both",
  },
  {
    construct: "a blank line in a take",
    cell: "One thought.\n\nA second thought.",
    names: "one paragraph",
    fields: "take-only",
  },
  {
    construct: "a list in a take",
    cell: "- the A side\n- the B side",
    names: "list",
    fields: "take-only",
  },
  {
    construct: "a blockquote in a take",
    cell: "> the liner notes said it",
    names: "quote",
    fields: "take-only",
  },
  {
    construct: "a link definition in a take",
    cell: "Heard [here][src].\n\n[src]: https://example.com",
    names: "definition",
    fields: "take-only",
  },
];

export interface AllowedCase {
  construct: string;
  cell: string;
  /** Block constructs and second paragraphs are review's alone. */
  reviewOnly?: boolean;
}

export const ALLOWED: AllowedCase[] = [
  { construct: "emphasis and strong", cell: "It *lands*, and it **stays**." },
  { construct: "inline code", cell: "The `tape hiss` is the point." },
  { construct: "an https link", cell: "Heard on [the show](https://example.com/show)." },
  { construct: "a mailto link", cell: "Argue with [me](mailto:dan@example.com)." },
  { construct: "a site-relative link", cell: "It lives beside [the shelf](/vinyl)." },
  {
    construct: "a reference link",
    cell: "Heard [here][src] first.\n\n[src]: https://example.com/show",
    reviewOnly: true,
  },
  {
    construct: "a list",
    cell: "Two sides:\n\n- the A side simmers\n- the B side boils",
    reviewOnly: true,
  },
  { construct: "a blockquote", cell: "> The liner notes said it best.", reviewOnly: true },
  {
    construct: "several paragraphs",
    cell: "The first listen confused me.\n\nThe second one didn't.",
    reviewOnly: true,
  },
];

/**
 * Tolerated with a warning, script-side only (the `Year` precedent): the old
 * contract split paragraphs on single newlines, the new one needs a blank
 * line, and a lone newline inside a paragraph is the one habit worth a nudge
 * without turning the job red.
 */
export const NEWLINE_WARNING = {
  cell: "First line\nsecond line of the same paragraph.",
  names: "single line break",
};
