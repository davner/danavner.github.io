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
import { PAGE_META } from "@/lib/routes";
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

  const remainder = (columns: number) =>
    tail % columns === 0 ? 1 : columns - (tail % columns) + 1;

  return { sm: remainder(2), lg: remainder(3) };
}

const trailingSpan = trailingSpanFor(interests.length);

const SM_SPAN: Record<number, string> = { 1: "", 2: "sm:col-span-2" };
const LG_SPAN: Record<number, string> = { 1: "", 2: "lg:col-span-2", 3: "lg:col-span-3" };

const META = PAGE_META["/about"];

export function About() {
  useDocumentMeta(META.title, META.description);

  return (
    <PageShell>
      <PageHeader
        title={
          <>
            <span className="block">Who is</span>
            <span className="display-outline block">Dan?</span>
          </>
        }
        lede="I'm Dan. I sometimes do cool things. I write telescope software for a living; this page is the rest of the day."
        asideAlign="start"
        aside={
          <div>
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
        }
      >
        <div className="mt-10 max-w-xl space-y-6 text-lede leading-relaxed text-muted-foreground text-pretty">
          <p>
            I live in Los Angeles County. I moved here to be near my wife's family and stayed for
            the food, which is some of the best I've had anywhere. The traffic and the beach parking
            are worse than I'd like. Living here is also why I got a Disneyland pass. I don't have
            the Disneyland pass anymore. So sad.
          </p>
          <p>
            I met my wife <span className="text-foreground">{profile.partnerFirstName}</span> online
            in Flagstaff. Her profile photo had space in it, so I opened by making fun of astronomy,
            which I have a degree in and actually love. She didn't know that yet. On our first date
            she was thirty minutes late and ate a whole chicken, and I knew pretty much right away
            she was the one. We've got a dog, Milly, and a cat, Penny. We call them Stinky and the
            Brainless.
          </p>
          <p>
            There's also an asteroid named after my mom, Lillian, officially{" "}
            <a
              href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=20500&view=OPD"
              target="_blank"
              rel="noreferrer noopener"
              className="text-ember underline underline-offset-4"
            >
              (20500) Avner
            </a>
            . The day job has{" "}
            <Link to="/career" className="text-ember underline underline-offset-4">
              its own page
            </Link>
            . Everything else is below.
          </p>
        </div>
      </PageHeader>

      <Section title="Outside of work">
        <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((interest, index) => (
            <InterestCard
              key={interest.name}
              interest={interest}
              fill={index === interests.length - 1 ? trailingSpan : undefined}
            />
          ))}
        </ul>
      </Section>

      <Section title="Fun fact">
        <div className="flex flex-col items-start gap-6 border border-ember/40 p-8 sm:flex-row sm:items-center sm:p-12">
          <Trophy className="size-10 shrink-0 text-ember" />
          <div className="flex-1">
            <p className="display text-heading text-balance">{funFact}</p>
            <p className="mt-3 text-muted-foreground text-pretty">
              It has been downhill ever since.
            </p>
          </div>
          <p className="display text-feature text-ember">#2</p>
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
  fill,
}: {
  interest: Interest;
  /** Columns this card should occupy, when it is the one closing the grid. */
  fill?: { sm: number; lg: number };
}) {
  const Icon = INTEREST_ICONS[interest.icon];

  /*
   * The whole tile is clickable when the interest has a page, but the link is on
   * the heading and stretched over the card with `after:inset-0` rather than
   * wrapped around it.
   *
   * Wrapping the card in an anchor is not available: an interest with both a
   * page and an account - Vinyl and Comics - would put an anchor inside an
   * anchor, which is invalid HTML that browsers repair by closing the outer one
   * early, quietly dropping half the card out of the link. Stretching keeps one
   * tab stop for the page, one for the account, and no nesting.
   */
  const body = (
    <>
      <div className="flex items-start justify-between">
        {/* The tile's one mark, so it points rather than competes: nothing else
            in the card is coloured until the title takes ember on hover. */}
        <Icon className="size-6 text-ember" />
      </div>

      <div
        className={cn(interest.feature && "gap-8 lg:flex lg:items-end lg:justify-between", "mt-6")}
      >
        <div>
          <h3 className="display flex items-center gap-2 text-title transition-colors group-hover:text-ember">
            {interest.to ? (
              <Link to={interest.to} className="after:absolute after:inset-0">
                {interest.name}
              </Link>
            ) : (
              interest.name
            )}
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
            <span className="display block text-feature text-ember">{showStats.total}</span>
            <span className="readout-dim">logged so far</span>
          </p>
        ) : null}
      </div>
    </>
  );

  const shell = cn(
    // `relative` is what the stretched heading link measures itself against.
    "cut-corners group relative bg-background p-6 transition-colors hover:bg-card/60 sm:p-8",
    // The feature card runs the width of the grid.
    interest.feature && "sm:col-span-2 lg:col-span-3",
    fill && !interest.feature && [SM_SPAN[fill.sm], LG_SPAN[fill.lg]],
  );

  return <li className={shell}>{body}</li>;
}
