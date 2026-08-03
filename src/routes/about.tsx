import {
  ArrowUpRight,
  Blocks,
  BookOpen,
  Disc3,
  Dumbbell,
  Gamepad2,
  Music,
  Swords,
  Telescope,
  Trophy,
} from "lucide-react";
import { Link } from "react-router";

import { FramedPhoto } from "@/components/framed-photo";
import { PageHeader, PageShell, Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { Badge } from "@/components/ui/badge";
import { funFact, interests, profile, type Interest } from "@/content/profile";
import { showStats } from "@/lib/shows";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/use-document-meta";

const INTEREST_ICONS = {
  music: Music,
  telescope: Telescope,
  "gamepad-2": Gamepad2,
  swords: Swords,
  disc: Disc3,
  "book-open": BookOpen,
  blocks: Blocks,
  dumbbell: Dumbbell,
} satisfies Record<Interest["icon"], typeof Music>;

/**
 * How far the last card has to stretch to finish its row.
 *
 * The grid paints its gaps with the border colour, so a row left half empty
 * renders as a solid block rather than as nothing. Rather than tuning the
 * interest count by hand every time one is added, the last card grows to close
 * whatever gap is left.
 */
function trailingSpanFor(count: number) {
  const feature = interests.filter((interest) => interest.feature).length;
  // A feature card already occupies a whole row, so it does not count toward
  // the tail.
  const tail = count - feature;

  const remainder = (columns: number) => (tail % columns === 0 ? 1 : columns - (tail % columns) + 1);

  return { sm: remainder(2), lg: remainder(3) };
}

const trailingSpan = trailingSpanFor(interests.length);

const SM_SPAN: Record<number, string> = { 1: "", 2: "sm:col-span-2" };
const LG_SPAN: Record<number, string> = { 1: "", 2: "lg:col-span-2", 3: "lg:col-span-3" };

export function About() {
  useDocumentMeta(
    "About",
    "Software engineer by trade, Florida man at heart. Alexis, Milly and Penny, concerts, records, comics, Legos, and one very specific bowling achievement.",
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
        lede="I'm Dan. Software engineer by trade, Florida man at heart."
      />

      <Section>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_19rem] md:gap-14">
          <div className="space-y-6 text-lg leading-relaxed text-muted-foreground text-pretty">
            <p>
              I grew up in Florida, spent a few formative years in Arizona, and somehow ended up in
              Los Angeles County with my wife,{" "}
              <span className="text-foreground">{profile.partnerFirstName}</span>. She's my
              favorite person, my best friend, and the perfect sweat to my sweat, whether we're
              dropping into Fortnite or hunting down a new coffee shop.
            </p>
            <p>
              Our house is ruled by two tiny supervisors: Milly, our pup, and Penny, our cat.
              They'll both be making appearances here, because frankly they're more photogenic
              than I am.
            </p>
            <p>
              Outside of work you'll usually find me at a concert, digging through record bins,
              building Lego sets with my nephew Nathan, pointing a camera at the night sky, or
              wandering into a comic shop on Wednesday because that's when the new pulls hit.
            </p>
            <p>
              I do genuinely love what I do for work, but that's what the{" "}
              <Link to="/career" className="text-ember underline underline-offset-4">
                Career page
              </Link>{" "}
              is for. This page is about everything else.
            </p>
          </div>

          <div className="md:sticky md:top-28 md:self-start">
            {/* Full colour rather than the duotone treatment used elsewhere -
                this is the warm one. */}
            <FramedPhoto
              src="/img/about/dan-and-alexis.jpg"
              alt={`${profile.name} and ${profile.partnerFirstName} on a balcony above the sea`}
              caption="Player one and two"
              width={1200}
              height={1600}
              imageClassName="aspect-4/5"
            />

            {/* The two supervisors, as promised. */}
            <div className="mt-px grid grid-cols-2 gap-px">
              <FramedPhoto
                src="/img/about/milly.jpg"
                alt="Milly, a small curly grey and cream dog, walking toward the camera across a sunlit lawn"
                caption="Milly"
                width={1000}
                height={750}
                imageClassName="aspect-square"
              />
              <FramedPhoto
                src="/img/about/penny.jpg"
                alt="Penny, a calico cat with black, white and orange markings, looking up close to the camera"
                caption="Penny"
                width={1000}
                height={750}
                imageClassName="aspect-square"
              />
            </div>

            <SocialLinks className="mt-4 -ml-2" />
          </div>
        </div>
      </Section>

      <Section title="Outside of work" index="01">
        <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((interest, index) => (
            <InterestCard
              key={interest.name}
              interest={interest}
              index={index}
              fill={index === interests.length - 1 ? trailingSpan : undefined}
            />
          ))}
        </ul>
      </Section>

      <Section title="Fun fact" index="02">
        <div className="flex flex-col items-start gap-6 border border-ember/40 p-8 sm:flex-row sm:items-center sm:p-12">
          <Trophy className="size-10 shrink-0 text-ember" />
          <div className="flex-1">
            <p className="display text-3xl text-balance sm:text-4xl">{funFact}</p>
            <p className="mt-3 text-muted-foreground text-pretty">It has been downhill ever since.</p>
          </div>
          <p className="display text-6xl text-ember sm:text-7xl">#2</p>
        </div>
      </Section>
    </PageShell>
  );
}

function Handle({ handle }: { handle: NonNullable<Interest["handle"]> }) {
  const chip = (
    <Badge
      variant="outline"
      // Wraps rather than nowraps: a long handle would otherwise push the card
      // wider than a 320px viewport.
      className="max-w-full flex-wrap gap-2 rounded-none border-border whitespace-normal transition-colors group-hover/handle:border-ember"
    >
      <span className="text-muted-foreground">{handle.label}</span>
      <span className="break-all text-ember">{handle.value}</span>
      {handle.href ? <ArrowUpRight className="text-muted-foreground" /> : null}
    </Badge>
  );

  if (!handle.href) return <p className="mt-4">{chip}</p>;

  return (
    <p className="mt-4">
      <a
        href={handle.href}
        target="_blank"
        rel="noreferrer noopener"
        className="group/handle relative z-10 inline-block"
      >
        {chip}
      </a>
    </p>
  );
}

function InterestCard({
  interest,
  index,
  fill,
}: {
  interest: Interest;
  index: number;
  /** Columns this card should occupy, when it is the one closing the grid. */
  fill?: { sm: number; lg: number };
}) {
  const Icon = INTEREST_ICONS[interest.icon];

  const body = (
    <>
      <div className="flex items-start justify-between">
        <Icon className="size-6 text-ember" />
        <span className="font-mono text-xs text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div
        className={cn(
          interest.feature && "gap-8 lg:flex lg:items-end lg:justify-between",
          "mt-6",
        )}
      >
        <div>
          <h3 className="display flex items-center gap-2 text-2xl transition-colors group-hover:text-ember">
            {interest.name}
            {interest.to ? (
              <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
            ) : null}
          </h3>

          <p
            className={cn(
              "mt-2 leading-relaxed text-muted-foreground text-pretty",
              interest.feature ? "max-w-2xl" : "text-sm",
            )}
          >
            {interest.note}
          </p>

          {interest.handle ? <Handle handle={interest.handle} /> : null}
        </div>

        {interest.feature ? (
          <p className="mt-6 shrink-0 lg:mt-0 lg:text-right">
            <span className="display block text-5xl text-ember">{showStats.total}</span>
            <span className="readout-dim">logged so far</span>
          </p>
        ) : null}
      </div>
    </>
  );

  const shell = cn(
    "cut-corners group bg-background p-6 transition-colors hover:bg-card/60 sm:p-8",
    // The feature card runs the width of the grid.
    interest.feature && "sm:col-span-2 lg:col-span-3",
    fill && !interest.feature && [SM_SPAN[fill.sm], LG_SPAN[fill.lg]],
  );

  if (interest.to) {
    return (
      <li className={cn(shell, "p-0 sm:p-0")}>
        <Link to={interest.to} className="block h-full p-6 sm:p-8">
          {body}
        </Link>
      </li>
    );
  }

  return <li className={shell}>{body}</li>;
}
