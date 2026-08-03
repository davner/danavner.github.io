import { Blocks, Dumbbell, Gamepad2, Guitar, Swords, Telescope, Trophy } from "lucide-react";
import { Link } from "react-router";

import { PageHeader, PageShell, Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { Badge } from "@/components/ui/badge";
import { fortnite, funFact, interests, profile, type Interest } from "@/content/profile";
import { showStats } from "@/lib/shows";
import { useDocumentMeta } from "@/lib/use-document-meta";

const INTEREST_ICONS = {
  dumbbell: Dumbbell,
  telescope: Telescope,
  "gamepad-2": Gamepad2,
  guitar: Guitar,
  swords: Swords,
  blocks: Blocks,
} satisfies Record<Interest["icon"], typeof Dumbbell>;

export function About() {
  useDocumentMeta(
    "About",
    "The person, not the job title: music, lifting, Legos, a backyard telescope, and one very specific bowling achievement.",
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="About"
        title={
          <>
            <span className="block">Who is</span>
            <span className="display-outline block">Dan?</span>
          </>
        }
        meta={[profile.location, "He/him", "Loud"]}
        lede="Someone who is happiest at the front of a crowded room with the volume too high, and otherwise at home with a barbell, a guitar, a controller, or a pile of Lego bricks."
      />

      <Section>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_19rem] md:gap-14">
          <div className="space-y-6 text-lg leading-relaxed text-muted-foreground text-pretty">
            <p>
              I grew up in Florida, spent some formative years in Arizona, and now live in Los
              Angeles County with my wife{" "}
              <span className="text-foreground">{profile.partner}</span> - who is, for the record,
              the best person I know and also the only teammate I trust in a final circle.
            </p>
            <p>
              Most of what I do outside the house involves standing too close to a speaker. I have
              been going to shows since I was a teenager and I have never really stopped, so I{" "}
              <Link to="/shows" className="text-ember underline underline-offset-4">
                keep a log of every one
              </Link>
              . Metalcore mostly, but I will show up for anything with a good breakdown or a good
              chorus, and I have been known to cry at a Bruno Mars set.
            </p>
            <p>
              The rest of it is quieter. I lift, badly and consistently. I play guitar, badly and
              enthusiastically. I point a small telescope at the sky from the backyard and stack
              frames until something looks like a galaxy. I build Legos on a table that has not
              been used for anything else in years.
            </p>
            <p>
              I also have a day job I genuinely like -{" "}
              <Link to="/career" className="text-ember underline underline-offset-4">
                that lives over here
              </Link>{" "}
              - but it is not the interesting part of this page.
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
            <SocialLinks className="mt-4 -ml-2" />
          </div>
        </div>
      </Section>

      <Section
        title="Outside of work"
        index="01"
        action={
          <Link
            to="/shows"
            className="readout text-muted-foreground transition-colors hover:text-ember"
          >
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
        </ul>
      </Section>

      <Section title="Drop me at Tilted" index="02">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="bg-background p-8 sm:p-10">
            <p className="readout text-ember">Fortnite, still, unapologetically</p>
            <ul className="mt-6 space-y-3 text-lg leading-relaxed text-pretty">
              <li className="relative pl-6 before:absolute before:top-[0.72em] before:left-0 before:h-px before:w-3 before:bg-ember">
                {fortnite.squad}
              </li>
              <li className="relative pl-6 before:absolute before:top-[0.72em] before:left-0 before:h-px before:w-3 before:bg-ember">
                {fortnite.duo}
              </li>
            </ul>
            <p className="mt-6 text-muted-foreground text-pretty">{fortnite.note}</p>
          </div>

          <div className="flex flex-col justify-center gap-3 bg-background p-8 sm:p-10">
            <Badge variant="ember" className="self-start">
              Gamer tag
            </Badge>
            <p className="font-mono text-2xl break-all text-ember sm:text-3xl">
              {fortnite.gamertag}
            </p>
          </div>
        </div>
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
