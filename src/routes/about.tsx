import { Blocks, Drum, Dumbbell, Gamepad2, Telescope, Trophy } from "lucide-react";
import { Link } from "react-router";

import { PageHeader, PageShell, Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { funFact, interests, profile, type Interest } from "@/content/profile";
import { showStats } from "@/lib/shows";
import { useDocumentMeta } from "@/lib/use-document-meta";

const INTEREST_ICONS = {
  dumbbell: Dumbbell,
  telescope: Telescope,
  "gamepad-2": Gamepad2,
  drum: Drum,
  blocks: Blocks,
} satisfies Record<Interest["icon"], typeof Dumbbell>;

const PLACES = [
  {
    place: "Gainesville, FL",
    detail: "B.A. Astronomy at the University of Florida",
    years: "2009 - 2013",
  },
  {
    place: "Flagstaff, AZ",
    detail: "M.S. Applied Physics at Northern Arizona University",
    years: "2015 - 2017",
  },
  {
    place: "Tucson, AZ",
    detail: "Steward Observatory - telescopes, domes, and long nights",
    years: "2019 - 2021",
  },
  {
    place: "Pasadena, CA",
    detail: "Caltech / IPAC on NASA's SPHEREx mission",
    years: "2021 - 2023",
  },
  {
    place: "Los Angeles County, CA",
    detail: "Remote for NOIRLab, working on Gemini software",
    years: "2023 - now",
  },
];

export function About() {
  useDocumentMeta(
    "About",
    "The non-résumé version: where I have lived, what I do outside of work, and one very specific bowling achievement.",
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="About"
        title={
          <>
            <span className="block">Not a</span>
            <span className="display-outline block">job title</span>
          </>
        }
        meta={[profile.location, "He/him", "Loud"]}
        lede="I have spent most of my adult life somewhere near a telescope - first as a student, then as the person on the mountain at 3 a.m., and now as the one writing the software that keeps all of it running."
      />

      <Section>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_19rem] md:gap-14">
          <div className="space-y-6 text-lg leading-relaxed text-muted-foreground text-pretty">
            <p>
              I studied astronomy in Florida and applied physics in Arizona, which is a slightly
              roundabout way of saying I liked the sky and I liked figuring out how things work.
              Somewhere in there I discovered the part I enjoyed most was not the paper at the end
              - it was the instrument, the pipeline, the interface, the thing that had to actually
              work when the dome opened.
            </p>
            <p>
              So I went that direction. Over 150 nights of observing later, I have a concrete sense
              of what breaks at 2 a.m. and how much a confusing button costs when the weather
              window is closing. That is the perspective I bring to everything I build now:{" "}
              <span className="text-foreground">
                this is not a demo, someone is going to depend on it in the dark.
              </span>
            </p>
            <p>
              These days I work remotely from Los Angeles County for NOIRLab, leading architecture
              on software for Gemini Observatory. Outside of that I lift, drum badly but
              enthusiastically, point a much smaller telescope at the same sky, and{" "}
              <Link to="/shows" className="text-ember underline underline-offset-4">
                stand too close to the speakers
              </Link>{" "}
              as often as I can manage.
            </p>
          </div>

          <div className="md:sticky md:top-28 md:self-start">
            <div className="group relative overflow-hidden border border-border">
              <img
                src="/img/me2.jpg"
                alt={profile.name}
                className="aspect-4/5 w-full object-cover grayscale contrast-[1.15] transition-all duration-500 group-hover:grayscale-0 group-hover:contrast-100"
              />
              <div className="pointer-events-none absolute inset-0 bg-ember opacity-25 mix-blend-color transition-opacity duration-500 group-hover:opacity-0" />
            </div>
            <p className="readout-dim mt-3 flex items-center justify-between">
              <span>Fig. 2</span>
              <span>Still smiling</span>
            </p>
            <SocialLinks className="-ml-2 mt-4" />
          </div>
        </div>
      </Section>

      <Section title="Coordinates" index="01">
        <ol>
          {PLACES.map((entry) => (
            <li
              key={entry.place}
              className="group grid gap-x-8 gap-y-1 border-b border-border py-6 first:border-t sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline"
            >
              <p className="readout-dim tabular-nums">{entry.years}</p>
              <div>
                <h3 className="display text-2xl transition-colors group-hover:text-ember sm:text-3xl">
                  {entry.place}
                </h3>
                <p className="mt-1.5 text-muted-foreground text-pretty">{entry.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Outside of work"
        index="02"
        action={
          <Link to="/shows" className="readout text-muted-foreground transition-colors hover:text-ember">
            {showStats.total} shows logged →
          </Link>
        }
      >
        <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((interest, index) => {
            const Icon = INTEREST_ICONS[interest.icon];
            return (
              <li
                key={interest.name}
                className="cut-corners group bg-background p-6 transition-colors hover:bg-card/60 sm:p-8"
              >
                <div className="flex items-start justify-between">
                  <Icon className="size-6 text-ember" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="display mt-6 text-2xl transition-colors group-hover:text-ember">
                  {interest.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {interest.note}
                </p>
              </li>
            );
          })}

          <li className="flex flex-col justify-center bg-background p-6 sm:p-8">
            <p className="readout-dim">Also</p>
            <p className="mt-2 leading-relaxed text-muted-foreground text-pretty">
              Anything with a double kick pedal and a breakdown. See the{" "}
              <Link to="/shows" className="text-ember underline underline-offset-4">
                show log
              </Link>
              .
            </p>
          </li>
        </ul>
      </Section>

      <Section title="Fun fact" index="03">
        <div className="flex flex-col items-start gap-6 border border-ember/40 p-8 sm:flex-row sm:items-center sm:p-12">
          <Trophy className="size-10 shrink-0 text-ember" />
          <div className="flex-1">
            <p className="display text-3xl text-balance sm:text-4xl">{funFact}</p>
            <p className="mt-3 text-muted-foreground text-pretty">
              I have peaked in exactly one measurable discipline and I am at peace with it.
            </p>
          </div>
          <p className="display text-6xl text-ember sm:text-7xl">#2</p>
        </div>
      </Section>
    </PageShell>
  );
}
