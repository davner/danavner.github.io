import { ArrowUpRight } from "lucide-react";

import { EmailReveal } from "@/components/email-reveal";
import { FramedPhoto } from "@/components/framed-photo";
import { PageHeader, PageShell, Section } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { education, observing, profile, roles, skills, socials } from "@/content/profile";
import { useDocumentMeta } from "@/lib/use-document-meta";

const scholar = socials.find((social) => social.icon === "graduation-cap")!;

export function Career() {
  useDocumentMeta(
    "Career",
    "A decade of writing software for telescopes: the roles, the toolkit, and the nights on a mountain that inform both.",
  );

  return (
    <PageShell>
      <PageHeader
        title={
          <>
            <span className="block">Built for</span>
            <span className="display-outline-ember block">the dark</span>
          </>
        }
        lede={profile.intro}
        aside={
          <FramedPhoto
            src="/img/career/goats-spie.jpg"
            alt="Dan at a podium presenting a GOATS project slide to a seated conference audience, a NOIRLab logo on the screen"
            caption="Presenting GOATS at SPIE"
            width={1600}
            height={1200}
            imageClassName="aspect-4/3 object-cover"
          />
        }
      >
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <EmailReveal />
          <a
            href="https://github.com/davner"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 border border-border px-5 py-3 transition-colors hover:border-ember hover:bg-ember/10 hover:text-ember"
          >
            <span className="readout">GitHub</span>
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </PageHeader>

      <Section title="Experience" index="01">
        <ol>
          {roles.map((role) => (
            <li
              key={`${role.org}-${role.start}`}
              className="grid gap-x-8 gap-y-4 border-b border-border py-10 md:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <div>
                <p className="readout text-ember">{role.period}</p>
                <p className="mt-3 font-mono text-sm">{role.org}</p>
                <p className="readout-dim mt-1">{role.location}</p>
              </div>

              <div>
                <h3 className="display text-2xl sm:text-3xl">{role.title}</h3>
                <p className="mt-2 text-muted-foreground text-pretty">{role.summary}</p>

                <ul className="mt-6 space-y-3">
                  {role.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="relative pl-6 leading-relaxed text-muted-foreground text-pretty before:absolute before:top-[0.72em] before:left-0 before:h-px before:w-3 before:bg-ember"
                    >
                      {highlight}
                    </li>
                  ))}
                </ul>

                <ul className="mt-6 flex flex-wrap gap-2">
                  {role.stack.map((tech) => (
                    <li key={tech}>
                      <Badge variant="outline" size="sm" className="rounded-none border-border">
                        {tech}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="On sky" index="02">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="bg-background p-6 sm:p-8">
            <p className="display text-6xl text-ember sm:text-7xl">{observing.nights}</p>
            <p className="readout-dim mt-2">Nights observing</p>
          </div>
          <div className="bg-background p-6 sm:p-8">
            <p className="text-muted-foreground text-pretty">
              I have spent a lot of nights actually observing, and it changes how you write the
              software. You learn what breaks at 2 a.m., and what a confusing button costs when the
              weather is about to close in on you.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              {observing.telescopes.map((telescope) => (
                <li key={telescope}>
                  <Badge variant="ember" className="rounded-none">
                    {telescope}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Toolkit" index="03">
        <dl className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {skills.map((group) => (
            <div key={group.label} className="bg-background p-6 sm:p-8">
              <dt className="readout text-ember">{group.label}</dt>
              <dd className="mt-4">
                <ul className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <li key={item}>
                      <Badge variant="outline" size="sm" className="rounded-none border-border">
                        {item}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Education" index="04">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {education.map((entry) => (
            <div key={entry.school} className="bg-background p-6 sm:p-8">
              <p className="readout text-ember">{entry.period}</p>
              <h3 className="display mt-3 text-2xl">{entry.degree}</h3>
              <p className="mt-2 font-mono text-sm text-muted-foreground">{entry.school}</p>
              <p className="readout-dim mt-1">{entry.location}</p>
            </div>
          ))}
        </div>

        <a
          href={scholar.href}
          target="_blank"
          rel="noreferrer noopener"
          className="group mt-px flex items-center gap-4 border border-t-0 border-border p-6 transition-colors hover:border-ember hover:bg-ember/10 hover:text-ember sm:p-8"
        >
          <span className="flex-1">
            <span className="readout block text-ember">Publications</span>
            <span className="mt-2 block font-mono text-sm">Google Scholar</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Peer-reviewed work from the observing and instrumentation side
            </span>
          </span>
          <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember" />
        </a>
      </Section>

      <Section>
        <div className="border border-ember/40 p-8 text-center sm:p-12">
          <p className="readout text-ember">Sidereal Software</p>
          <h2 className="display mx-auto mt-5 max-w-3xl text-4xl text-balance sm:text-6xl">
            Science is hard enough. The software should not be.
          </h2>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-muted-foreground text-pretty">
            I take on a little consulting through Sidereal Software: observatory systems, data
            pipelines, and the interfaces scientists have to live inside all night. The work I want
            is the kind where the domain is hard and the thing still has to hold up at 3 a.m.
            Sidereal is where to reach me about it.
          </p>
          <a
            href="https://sidereal.software"
            target="_blank"
            rel="noreferrer noopener"
            className="group mt-8 inline-flex items-center gap-2 border border-ember bg-ember px-6 py-3.5 text-primary-foreground transition-colors hover:bg-transparent hover:text-ember"
          >
            <span className="readout">sidereal.software</span>
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </Section>
    </PageShell>
  );
}
