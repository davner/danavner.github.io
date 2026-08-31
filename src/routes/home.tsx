import { ArrowRight, ArrowUpRight, CheckIcon } from "lucide-react";
import { Link } from "react-router";

import { BandList } from "@/components/band-list";
import { FramedPhoto } from "@/components/framed-photo";
import { Marquee } from "@/components/marquee";
import { Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { profile } from "@/content/profile";
import { posts } from "@/lib/blog";
import { formatShowDate, showLocation, showStats, supportFor } from "@/lib/shows";
import { NOW_DESCRIPTION } from "@/lib/site";
import { useDocumentMeta } from "@/lib/use-document-meta";

const INDEX = [
  {
    to: "/now",
    title: "Now",
    // The same sentence the page and its link preview use, so the three cannot
    // describe it differently depending on where you meet it.
    blurb: NOW_DESCRIPTION,
  },
  {
    to: "/about",
    title: "About",
    blurb: "Alexis, Milly and Penny, shows, records, comics, Legos, and one bowling statistic.",
  },
  {
    to: "/career",
    title: "Career",
    blurb: "The day job, and the decade of telescope software behind it.",
  },
  {
    to: "/blog",
    title: "Blog",
    blurb: "Notes on whatever has my attention, which is usually not work.",
  },
  {
    to: "/shows",
    title: "Shows",
    blurb: "Every gig I have been to since I started keeping track, logged and rated.",
  },
  {
    to: "/vinyl",
    title: "Vinyl",
    blurb: "Every record Alexis and I own, pulled straight from the Discogs shelf.",
  },
  {
    to: "/comics",
    title: "Comics",
    blurb: "Every run on the shelf, what is waiting at the shop, and what I still want.",
  },
  {
    to: "/fortnite",
    title: "Fortnite",
    blurb: "Wins, kills and K/D, read nightly and kept season by season.",
  },
];

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

export function Home() {
  useDocumentMeta("Dan Avner", `${profile.greeting} ${profile.blurb}`);

  const latestPost = posts[0];
  const latestShow = showStats.latest;

  return (
    <>
      {/* Matches PageShell's `pt-12 sm:pt-16` so the landing page starts at the
          same height off the nav as every other page. */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 sm:pt-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-12">
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
                the layout actually does: a fixed column beside the wordmark on
                a wide screen, full width below that. */}
            <FramedPhoto
              src="/img/me1.webp"
              srcSet="/img/me1-768.webp 768w, /img/me1.webp 1067w"
              sizes="(min-width: 1024px) 400px, 100vw"
              alt={`${profile.name}, smiling, in a patterned shirt`}
              caption="Subject, smiling"
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
            {INDEX.map((entry) => (
              <li key={entry.to}>
                <Link
                  to={entry.to}
                  className="group flex items-center gap-4 border-b border-border py-6 transition-colors hover:bg-card/60 sm:gap-8 sm:py-8"
                >
                  <span className="display text-feature transition-all duration-200 group-hover:translate-x-1 group-hover:text-ember">
                    {entry.title}
                  </span>
                  <span className="ml-auto hidden max-w-sm text-right text-sm leading-relaxed text-muted-foreground text-pretty lg:block">
                    {entry.blurb}
                  </span>
                  <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember sm:size-6" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Latest"
          action={
            <Link
              to="/blog"
              className="readout text-muted-foreground transition-colors hover:text-ember"
            >
              All posts →
            </Link>
          }
        >
          <div className="grid gap-px border border-border bg-border md:grid-cols-2">
            {latestPost ? (
              <Link
                to={`/blog/${latestPost.slug}`}
                className="group flex flex-col bg-background p-6 transition-colors hover:bg-card/60 sm:p-8"
              >
                <p className="readout text-ember">Latest post</p>
                <p className="display mt-4 text-heading text-balance transition-colors group-hover:text-ember">
                  {latestPost.title}
                </p>
                <p className="mt-4 flex-1 leading-relaxed text-muted-foreground text-pretty">
                  {latestPost.summary}
                </p>
                <p className="readout-dim mt-6 flex items-center gap-2">
                  Read
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ) : null}

            {latestShow ? (
              <Link
                to="/shows"
                className="group flex flex-col bg-background p-6 transition-colors hover:bg-card/60 sm:p-8"
              >
                <p className="readout text-ember">Last show</p>
                <p className="display mt-4 text-heading text-balance transition-colors group-hover:text-ember">
                  {latestShow.title}
                </p>
                <p className="mt-4 flex-1 leading-relaxed text-muted-foreground text-pretty">
                  {supportFor(latestShow).length ? (
                    <>
                      <span className="text-ember">w/</span>{" "}
                      <BandList bands={supportFor(latestShow)} />
                      {" - "}
                    </>
                  ) : null}
                  {showLocation(latestShow)}
                </p>
                <p className="readout-dim mt-6 flex items-center gap-2">
                  {[formatShowDate(latestShow), latestShow.date.slice(0, 4)]
                    .filter(Boolean)
                    .join(" ")}
                  <span className="text-ember">·</span>
                  {showStats.total} logged
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ) : null}
          </div>
        </Section>
      </div>
    </>
  );
}
