import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ProseAnchor } from "@/components/prose-anchor";

/**
 * A now entry's body, rendered.
 *
 * Shared by the current entry and every archived one so they cannot drift into
 * looking like two different kinds of writing - they are the same writing, one
 * of them just older.
 *
 * No syntax highlighting here, unlike a blog post. A now entry is prose about a
 * few weeks of life; carrying a highlighter into this route to cover the case
 * where one contains a code block would cost more than the case is worth.
 *
 * `remarkPlugins` is paired with the `GFM` constant in `now-summary.ts`, which
 * parses the same body into the entry's description and share card. A plugin
 * added here has to be represented there, or the two read the same markdown as
 * two different syntaxes and a link previews with words the page never prints.
 */
export function NowProse({ body }: { body: string }) {
  return (
    <div className="prose-dan">
      <Markdown remarkPlugins={[remarkGfm]} components={{ a: ProseAnchor }}>
        {body}
      </Markdown>
    </div>
  );
}
