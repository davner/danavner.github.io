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
        {/* The photo sits beside the name from `md` up, not from `lg`. Stacked,
            it is as wide as the shell, which puts a 912px portrait between the
            buttons and the rest of the page and runs the hero to three screens
            on a tablet.

            Two column widths rather than one, because the left column has to
            hold two things at once. The wordmark is set in `vw`, so it wants a
            fixed share of the viewport however narrow its column gets, and the
            button row needs about 360px before it breaks into three lines. A
            column split that satisfies the wordmark alone still breaks the
            buttons. */}
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <h1 className="display text-hero">
              <span className="block">Dan</span>
              <span className="display-outline block">Avner</span>
            </h1>

            {/* A kicker between the name and the hello. Muted all the way
                through, because the greeting under it already takes the accent
                and two ember lines stacked would fight. Each sentence is its
                own flex item, so wrapping breaks between sentences rather than
                mid-thought. */}
            <p className="readout-dim mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
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

          {/* Full colour and full width, tops out level with the wordmark the
              way the about and career hero photos do. */}
          <div>
            {/* WebP, and two widths. The JPEG is half the size again as WebP
                at the same quality, and the small screens that need the least
                of it were being sent all 1067px of it. `sizes` describes what
                the layout actually does: a column beside the wordmark that
                widens once, and full width below the split. Each value tracks a
                grid track above, so a change to one is a change to both. */}
            <FramedPhoto
              src="/img/me1.webp"
              srcSet="/img/me1-768.webp 768w, /img/me1.webp 1067w"
              sizes="(min-width: 1024px) 384px, (min-width: 768px) 288px, 100vw"
              alt={`${profile.name}, smiling, in a patterned shirt`}
              caption="Me"
              width={1067}
              height={1334}
              eager
              imageClassName="aspect-4/5"
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
