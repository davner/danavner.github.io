import { siteIndex } from "virtual:site-index";

import { ArrowRight, ArrowUpRight, CheckIcon } from "lucide-react";

import { FramedPhoto } from "@/components/framed-photo";
import { Link } from "@/components/link";
import { Marquee } from "@/components/marquee";
import { Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { profile } from "@/content/profile";
import { ALL_SECTIONS, type Section as SiteSection } from "@/lib/site";
import { NO_ROW } from "@/lib/site-index";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/use-document-meta";

const TICKER = [
  "Live music",
  "Dropping into Fortnite",
  "Alexis, Milly and Penny",
  "Travel",
  "Record bins",
  "New comic Wednesday",
  "Legos with Nathan",
  "Astrophotography",
  "Telescope software",
  "Front of the barricade",
  "2nd in Florida for bowling",
  "Goof boy",
];

/**
 * One section on the index: its name, what it holds, and what it last gained.
 *
 * The last part comes from `virtual:site-index`, computed at build time, rather
 * than from the collections themselves. This page is the eager landing chunk
 * every route loads, and the collections it indexes are ~80 kB of payload plus
 * module-level work a bundler cannot shake out, to print nine lines.
 *
 * What a row carries is the digest's decision, not this component's: a section
 * with nothing logged has no readout at all, a record and a comic have no page
 * here to link to, and a Fortnite season has no date because a season is a
 * period rather than something that happened.
 */
function SectionRow({ section }: { section: SiteSection }) {
  const row = siteIndex[section.to] ?? NO_ROW;
  const readout = Boolean(row.latest || row.date || row.tally);

  return (
    <li
      data-slot="index-row"
      className="group relative border-b border-border py-6 transition-colors hover:bg-card/60 sm:py-8"
    >
      {/* One arrow, placed by `order` rather than rendered twice: it sits on
          the name's line while the row is stacked, and at the far end of the
          row once the readout moves alongside the name.

          The row's whole area is the section's link, drawn by the name's
          `::after`. Nothing between that pseudo-element and the `li` may take a
          transform - a transformed ancestor becomes its containing block and
          shrinks the target to the name - which is why the hover shift sits on
          the span inside the link rather than on the link itself. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-4 sm:gap-x-8 lg:flex-nowrap">
        <Link to={section.to} className="flex after:absolute after:inset-0">
          <span className="display text-feature transition-all duration-200 group-hover:translate-x-1 group-hover:text-ember">
            {section.label}
          </span>
        </Link>

        {/* `lg:ml-0` only where the readout follows: from `lg` that column
            carries the `ml-auto` that pushes the pair to the right edge, and
            the arrow riding one of its own as well would split them apart. A
            row with no readout has nothing else to push it, so it keeps the
            one it starts with and lands where every other row's arrow does. */}
        <ArrowUpRight
          className={cn(
            "ml-auto size-5 shrink-0 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember sm:size-6 lg:order-2",
            readout && "lg:ml-0",
          )}
        />

        {/* Dropped entirely rather than left empty when the digest has nothing:
            `/about` and `/career` are in no collection, so this column would
            otherwise be a bare box adding the row's `gap-y-4` under a name that
            already said everything. */}
        {readout ? (
          <div className="w-full min-w-0 lg:order-1 lg:ml-auto lg:w-auto lg:max-w-md lg:text-right">
            {row.latest ? (
              <p className="text-sm leading-relaxed text-pretty">
                {row.href ? (
                  /* Underlined at rest rather than coloured on hover: the link
                   sits in a run of body copy, so a cue held back until a
                   pointer arrives leaves a keyboard or touch reader meeting a
                   control as plain text (WCAG 1.4.1). The ring is pushed out
                   past the underline for `.readout-link`'s reason - at the
                   standing offset its lower edge lands on the underline, and
                   the two read as one thick rule. */
                  <Link
                    to={row.href}
                    className="relative underline decoration-muted-foreground underline-offset-4 transition-colors hover:text-ember hover:decoration-ember focus-visible:outline-offset-4"
                  >
                    {row.latest}
                  </Link>
                ) : (
                  row.latest
                )}
              </p>
            ) : null}

            {row.date || row.tally ? (
              <p className="readout-dim mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 lg:justify-end">
                {row.date ? <time dateTime={row.date}>{row.dateLabel}</time> : null}
                {row.date && row.tally ? (
                  <span className="text-ember" aria-hidden>
                    ·
                  </span>
                ) : null}
                {row.tally ? <span>{row.tally}</span> : null}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function Home() {
  useDocumentMeta("Dan Avner", `${profile.greeting} ${profile.blurb}`);

  return (
    <>
      {/* Matches PageShell's `pt-12 sm:pt-16` so the landing page starts at the
          same height off the nav as every other page. */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 sm:pt-16">
        {/* The name spans the shell rather than sitting in a column, so it is
            set at the width it is sized for. The break is written in rather
            than left to the browser: one line of "DAN AVNER" is wider than the
            measure at every viewport, so the browser would put the break in the
            same place with a chance of overflowing on a face that fell back. */}
        <h1 className="display text-hero">
          <span className="block">Dan</span>
          <span className="display-outline block">Avner</span>
        </h1>

        {/* The photo sits beside the copy from `md` up, not from `lg`. A plate
            left full-bleed on a wide screen is bound by the window's height
            rather than its width, so it flattens into a band too shallow to
            hold a face at any `object-position`. The column is what hands the
            whole photograph back.

            Two column widths rather than one, because at `md` the button row is
            already down to the ~360px it needs before breaking into three
            lines. The photo takes the wider track only once the shell has the
            room to give it. */}
        <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            {/* A kicker between the name and the hello. Muted all the way
                through, because the greeting under it already takes the accent
                and two ember lines stacked would fight. Each sentence is its
                own flex item, so wrapping breaks between sentences rather than
                mid-thought. */}
            <p className="readout-dim flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span>{profile.quest.label}:</span>
              <span>{profile.quest.main}</span>
            </p>

            {/* The side quests, as a box that was ticked a long time ago and is
                not getting unticked. Drawn rather than built out of a checkbox:
                there is nothing here to toggle, so it takes no focus, carries no
                control semantics, and stays out of the accessibility tree. A
                checkbox here would offer a state change the page cannot make,
                and announce itself as a control nobody can operate.

                The tick is the only thing saying the box is ticked, so the word
                it stands for is spoken in its place. Without that, the line is
                an instruction rather than something already done, and the joke
                reaches whoever can see the mark and nobody else.

                Just under full strength. Solid ember carries as much weight
                as the page's primary button, which is more than a 16px mark
                that does nothing should take from the greeting under it. The
                faint end of the scale overshoots the other way: a ticked box
                that looks switched off says the opposite of what it means. */}
            <p className="readout-dim mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{profile.quest.sideQuests}:</span>
              <span className="flex items-center gap-2 leading-none">
                <span
                  aria-hidden
                  className="grid size-4 shrink-0 place-content-center rounded-[4px] border border-ember bg-ember text-primary-foreground opacity-80"
                >
                  <CheckIcon className="size-3.5" />
                </span>
                <span className="readout-dim">{profile.quest.sideQuestsLabel}</span>
                <span className="sr-only">, accepted</span>
              </span>
            </p>

            <p className="mt-4 max-w-xl text-title leading-snug text-pretty">
              <span className="text-ember">{profile.greeting}</span> {profile.blurb}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <Link
                to="/about"
                className="group inline-flex items-center gap-2 border border-ember bg-ember px-5 py-3 text-primary-foreground transition-colors hover:bg-transparent hover:text-ember"
              >
                <span className="readout">Get to know me</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/career"
                className="inline-flex items-center gap-2 border border-border px-5 py-3 transition-colors hover:border-ember hover:bg-ember/5 hover:text-ember"
              >
                <span className="readout">The day job</span>
              </Link>
              <SocialLinks className="sm:ml-1" />
            </div>
          </div>

          {/* A plate rather than a portrait in a box. Below the split it runs
              to both edges of the screen and its own height crops it to a band,
              which is what holds a full-width photograph to about half the
              screen instead of the two-thirds its 2:3 frame would take. The
              height is capped three ways because each binds somewhere: the
              width on a phone, the screen on a short window, and a flat ceiling
              on a large tablet where neither does.

              From `md` it takes the frame's own 2:3 in the column, so nothing
              is cropped there and `object-position` has nothing to do - which
              is also what makes `sizes` below exact rather than approximate. */}
          <div>
            {/* WebP, and two widths. The JPEG is half the size again as WebP
                at the same quality, and the small screens that need the least
                of it were being sent all 1067px of it. `sizes` describes what
                the layout actually does: a column beside the copy that widens
                once, and the full screen below the split. Each value tracks a
                grid track above, and the same string is the preload's
                `imagesizes` in `index.html` - a change to one is a change to
                all three, and a preload that disagrees fetches a second copy.

                `width`/`height` are the file's own, not the box's: the image is
                out of flow, so the box is set by the classes above it and the
                pair is only here to give the browser the aspect ratio it
                decodes at. */}
            <FramedPhoto
              src="/img/me1.webp"
              srcSet="/img/me1-768.webp 768w, /img/me1.webp 1067w"
              sizes="(min-width: 1024px) 384px, (min-width: 768px) 288px, 100vw"
              alt={`${profile.name}, smiling, in a patterned shirt`}
              caption="Me"
              width={1067}
              height={1600}
              eager
              className="-mx-4 h-[min(110vw,70svh,46rem)] border-x-0 sm:-mx-6 md:mx-0 md:aspect-2/3 md:h-auto md:border-x"
              imageClassName="absolute inset-0 h-full object-[50%_35%]"
            />
          </div>
        </div>
      </section>

      <Marquee items={TICKER} />

      {/* `pb-8` rather than a matching `pb-20`, so the gap down to the footer is
          PageShell's, not double it. */}
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-8 sm:px-6">
        <Section>
          <ul className="border-t border-border">
            {ALL_SECTIONS.map((section) => (
              <SectionRow key={section.to} section={section} />
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
