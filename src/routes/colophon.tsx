import { PageHeader, PageShell, Section } from "@/components/page";
import { code128bWidths } from "@/lib/code128";
import { PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

const META = PAGE_META["/colophon"];

/**
 * The inks on the plate, named the way `DESIGN.md` names them. The neutral
 * slots change name with the stock - the same swatch is newsprint on one run
 * and press black on the other - so those carry a name per theme and the page
 * shows whichever run the reader is holding.
 */
const INKS = [
  { css: "var(--background)", light: "Newsprint", dark: "Press black" },
  { css: "var(--card)", light: "Newsprint raised", dark: "Press black raised" },
  { css: "var(--foreground)", light: "Ink", dark: "Ink reversed" },
  { css: "var(--ember)", light: "Flyer red", dark: "Flyer red" },
  { css: "var(--ion)", light: "Photocopy cyan", dark: "Photocopy cyan" },
  { css: "var(--star)", light: "Bone", dark: "Bone" },
] as const;

/** The machines the site passes through, in the order it passes through them. */
const PRESS = [
  { stage: "Set in", detail: "TypeScript and React" },
  { stage: "Composed by", detail: "Vite" },
  { stage: "Inked by", detail: "Tailwind CSS" },
  { stage: "Proofed by", detail: "Playwright, on every push" },
  { stage: "Pressed by", detail: "GitHub Actions" },
  { stage: "Distributed by", detail: "GitHub Pages" },
] as const;

/**
 * The pressing's barcode: the commit this copy was built from, as Code 128B
 * element widths. Module-scope because the sha is a build-time constant, so
 * the widths are too.
 */
const BARCODE = code128bWidths(__COMMIT_SHA__);
const BARCODE_MODULES = BARCODE.reduce((sum, width) => sum + width, 0);
const BARCODE_HEIGHT = 32;

/** One line, ready to paste - the snippet the button section prints. */
const EMBED = `<a href="https://danavner.com"><img src="https://danavner.com/img/badge-88x31.png" width="88" height="31" alt="danavner.com"></a>`;

/** The bars alone; the gaps stay page-coloured, like unprinted stock. */
function barcodeRects() {
  const rects = [];
  let x = 0;
  for (const [index, width] of BARCODE.entries()) {
    if (index % 2 === 0) {
      rects.push(<rect key={index} x={x} y={0} width={width} height={BARCODE_HEIGHT} />);
    }
    x += width;
  }
  return rects;
}

export function Colophon() {
  useDocumentMeta(META.title, META.description);

  return (
    <PageShell>
      <PageHeader
        title="Colophon"
        lede="A zine keeps a page at the back saying how it was printed. This is mine: the type it is set in, the inks on the plate, and the press it comes off of."
      />

      <Section title="The type">
        <div className="max-w-2xl space-y-12">
          <div>
            <p className="display text-feature">Anton</p>
            <p className="readout-dim mt-3">Display · one weight, all caps</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
              Every headline on the site, set tight and under a line height of one. It ships in
              exactly one weight, which saves me from choosing.
            </p>
          </div>

          <div>
            <p className="text-lede leading-relaxed">
              Inter carries everything meant to be read at length, including this sentence.
            </p>
            <p className="readout-dim mt-3">Body · Inter Variable</p>
          </div>

          <div>
            <p className="readout">Dates · venues · catalogue numbers</p>
            <p className="readout-dim mt-3">Readout · JetBrains Mono Variable</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
              The instrument label, shown at actual size. If something on this site reads like a
              fact, it is set in this.
            </p>
          </div>
        </div>
      </Section>

      <Section title="The inks">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Four inks and two stocks. The themes are one poster on different paper, so the bar is
          labeled for whichever run you are reading: flip the theme and the same slots ink up for
          the other one.
        </p>

        <ul className="mt-8 grid max-w-2xl grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-6">
          {INKS.map((ink) => (
            <li key={ink.css}>
              {/* The hairline is what gives newsprint-on-newsprint an edge:
                  without it the page swatch is invisible on its own stock. */}
              <div className="h-14 border border-border" style={{ background: ink.css }} />
              <p className="readout-dim mt-2">
                {ink.light === ink.dark ? (
                  ink.light
                ) : (
                  <>
                    <span className="dark:hidden">{ink.light}</span>
                    <span className="hidden dark:inline">{ink.dark}</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="The press">
        <dl className="max-w-2xl divide-y divide-border border-y border-border">
          {PRESS.map((row) => (
            <div key={row.stage} className="grid grid-cols-[8.5rem_1fr] gap-x-6 py-3">
              <dt className="readout-dim">{row.stage}</dt>
              <dd className="readout">{row.detail}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          There is no backend and no database. The content is markdown and JSON checked while the
          site is built, so a bad file fails the build rather than the page. The fonts are served
          from here, not a CDN.
        </p>
      </Section>

      <Section title="The pressing">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Every copy of the site comes off one commit, and this copy came off this one. The text
          carries the fact; the bars are the same fact for anyone pointing a scanner at a monitor.
        </p>

        {/* Decoration over data, so it is hidden from AT - the readout line
            below says the same thing in words. Cold ink because a barcode is
            machine output, which is the one job `--ion` has. */}
        <svg
          viewBox={`0 0 ${BARCODE_MODULES} ${BARCODE_HEIGHT}`}
          className="mt-8 h-16 w-auto max-w-full fill-ion"
          shapeRendering="crispEdges"
          aria-hidden
        >
          {barcodeRects()}
        </svg>

        <p className="readout-dim mt-3">{__COMMIT_SHA__}</p>
      </Section>

      <Section title="The button">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          An 88 by 31 button, in the tradition of every site that ever kept a links page. If you
          keep one, this is mine. Shown at actual size, because that is the whole format.
        </p>

        <img
          src="/img/badge-88x31.png"
          alt="danavner.com: an 88 by 31 web button, the address in white and ember type on press black"
          width={88}
          height={31}
          className="mt-8"
        />

        {/* Focusable for the same reason blog-post.tsx's code blocks are: a
            block that scrolls sideways is unreachable to a keyboard unless it
            can take focus, and on a phone this one does. */}
        <pre
          tabIndex={0}
          className="mt-6 max-w-2xl overflow-x-auto border border-border bg-card p-4 text-sm"
        >
          <code>{EMBED}</code>
        </pre>
      </Section>
    </PageShell>
  );
}
