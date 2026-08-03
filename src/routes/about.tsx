import { Blocks, Drum, Dumbbell, Gamepad2, MapPin, Telescope, Trophy } from "lucide-react";

import { PageHeader, PageShell, Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { Badge } from "@/components/ui/badge";
import { funFact, interests, profile, type Interest } from "@/content/profile";
import { useDocumentMeta } from "@/lib/use-document-meta";

const INTEREST_ICONS = {
  dumbbell: Dumbbell,
  telescope: Telescope,
  "gamepad-2": Gamepad2,
  drum: Drum,
  blocks: Blocks,
} satisfies Record<Interest["icon"], typeof Dumbbell>;

const PLACES = [
  { place: "Gainesville, FL", detail: "B.A. Astronomy at the University of Florida", years: "2009 — 2013" },
  { place: "Flagstaff, AZ", detail: "M.S. Applied Physics at Northern Arizona University", years: "2015 — 2017" },
  { place: "Tucson, AZ", detail: "Steward Observatory — telescopes, domes, and long nights", years: "2019 — 2021" },
  { place: "Pasadena, CA", detail: "Caltech / IPAC on NASA's SPHEREx mission", years: "2021 — 2023" },
  { place: "Los Angeles County, CA", detail: "Remote for NOIRLab, working on Gemini software", years: "2023 — now" },
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
        title="The part that isn’t a job title."
        lede="I have spent most of my adult life somewhere near a telescope — first as a student, then as the person on the mountain at 3 a.m., and now as the one writing the software that keeps all of it running."
      />

      <Section>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-14">
          <div className="space-y-5 text-lg leading-relaxed text-muted-foreground text-pretty">
            <p>
              I studied astronomy in Florida and applied physics in Arizona, which is a slightly
              roundabout way of saying I liked the sky and I liked figuring out how things work.
              Somewhere in there I discovered that the part I enjoyed most was not the paper at the
              end — it was the instrument, the pipeline, the interface, the thing that had to
              actually work when the dome opened.
            </p>
            <p>
              So I went that direction. Over 150 nights of observing later, I have a pretty concrete
              sense of what breaks at 2 a.m. and how much a confusing button costs when the weather
              window is closing. That is the perspective I bring to everything I build now: this is
              not a demo, someone is going to depend on it in the dark.
            </p>
            <p>
              These days I work remotely from Los Angeles County for NOIRLab, leading architecture
              on software for Gemini Observatory. Outside of that I lift, drum badly but
              enthusiastically, point a much smaller telescope at the same sky, and build Legos
              because the instructions always work.
            </p>
          </div>

          <div className="md:sticky md:top-24 md:self-start">
            <img
              src="/img/me2.jpg"
              alt={profile.name}
              className="aspect-4/5 w-full rounded-xl border border-border object-cover shadow-lg"
            />
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 text-primary" />
              {profile.location}
            </p>
            <SocialLinks className="-ml-2 mt-2" />
          </div>
        </div>
      </Section>

      <Section title="The short version">
        <ol className="relative space-y-8 border-l border-border pl-8">
          {PLACES.map((entry) => (
            <li key={entry.place} className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[2.3rem] size-2.5 rounded-full border-2 border-background bg-primary"
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 className="font-semibold tracking-tight">{entry.place}</h3>
                <p className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                  {entry.years}
                </p>
              </div>
              <p className="mt-1 text-muted-foreground text-pretty">{entry.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Outside of work">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((interest) => {
            const Icon = INTEREST_ICONS[interest.icon];
            return (
              <li
                key={interest.name}
                className="rounded-xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{interest.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {interest.note}
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Fun fact">
        <div className="flex flex-col items-start gap-5 rounded-xl border border-primary/30 bg-primary/5 p-8 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Trophy className="size-6" />
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight text-balance">{funFact}</p>
            <p className="mt-2 text-muted-foreground">
              I have peaked in exactly one measurable discipline and I am at peace with it.
            </p>
          </div>
          <Badge variant="outline" className="font-mono font-normal sm:ml-auto">
            #2 · Florida
          </Badge>
        </div>
      </Section>
    </PageShell>
  );
}
