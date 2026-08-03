import { ArrowUpRight, GraduationCap, Mail, Moon, Telescope } from "lucide-react";

import { PageHeader, PageShell, Section } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  education,
  observing,
  profile,
  projects,
  roles,
  skills,
  socials,
} from "@/content/profile";
import { useDocumentMeta } from "@/lib/use-document-meta";

const scholar = socials.find((social) => social.icon === "graduation-cap")!;

export function Work() {
  useDocumentMeta(
    "Work",
    "Projects, roles, and skills — a decade of building software for telescopes, observatories, and astronomers.",
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Work"
        title="Software for the people who use telescopes."
        lede={profile.intro}
      >
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <a href={`mailto:${profile.email}`}>
              <Mail />
              Work with me
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="https://github.com/davner" target="_blank" rel="noreferrer noopener">
              GitHub
              <ArrowUpRight />
            </a>
          </Button>
        </div>
      </PageHeader>

      <Section title="Selected projects">
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.name}
              className="flex flex-col rounded-xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-mono text-lg font-semibold tracking-tight">
                    {project.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{project.org}</p>
                </div>
                {project.current ? (
                  <Badge variant="outline" className="shrink-0 gap-1.5 font-normal">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Active
                  </Badge>
                ) : null}
              </div>

              <p className="mt-4 flex-1 leading-relaxed text-muted-foreground text-pretty">
                {project.blurb}
              </p>

              <ul className="mt-5 flex flex-wrap gap-1.5">
                {project.stack.map((tech) => (
                  <li key={tech}>
                    <Badge variant="secondary" className="font-mono font-normal">
                      {tech}
                    </Badge>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Experience">
        <ol className="relative space-y-12 border-l border-border pl-8">
          {roles.map((role) => (
            <li key={`${role.org}-${role.start}`} className="relative">
              <span
                aria-hidden
                className="absolute top-2 -left-[2.3rem] size-2.5 rounded-full border-2 border-background bg-primary"
              />

              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 className="text-lg font-semibold tracking-tight">{role.title}</h3>
                <p className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                  {role.period}
                </p>
              </div>

              <p className="mt-1 text-sm text-primary">
                {role.org} <span className="text-muted-foreground">· {role.location}</span>
              </p>

              <ul className="mt-4 space-y-2.5">
                {role.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="relative pl-5 leading-relaxed text-muted-foreground text-pretty before:absolute before:top-[0.7em] before:left-0 before:size-1 before:rounded-full before:bg-primary/60"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>

              <ul className="mt-4 flex flex-wrap gap-1.5">
                {role.stack.map((tech) => (
                  <li key={tech}>
                    <Badge variant="secondary" className="font-mono font-normal">
                      {tech}
                    </Badge>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="At the telescope">
        <div className="rounded-xl border border-border bg-card/50 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Moon className="size-5" />
              </span>
              <div>
                <p className="font-mono text-3xl font-semibold tracking-tight">
                  {observing.nights}
                </p>
                <p className="text-sm text-muted-foreground">nights observing</p>
              </div>
            </div>

            <div className="flex-1 sm:border-l sm:border-border sm:pl-6">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Telescope className="size-4 text-primary" />
                Time on the mountain, not just in the repo
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {observing.telescopes.map((telescope) => (
                  <li key={telescope}>
                    <Badge variant="outline" className="font-mono font-normal">
                      {telescope}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Toolkit">
        <dl className="grid gap-6 sm:grid-cols-2">
          {skills.map((group) => (
            <div key={group.label} className="rounded-xl border border-border bg-card/40 p-6">
              <dt className="eyebrow">{group.label}</dt>
              <dd className="mt-4">
                <ul className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <li key={item}>
                      <Badge variant="secondary" className="font-mono font-normal">
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

      <Section title="Education & research">
        <div className="grid gap-4 sm:grid-cols-2">
          {education.map((entry) => (
            <div key={entry.school} className="rounded-xl border border-border bg-card/40 p-6">
              <p className="font-mono text-xs text-muted-foreground">{entry.period}</p>
              <h3 className="mt-2 font-semibold tracking-tight">{entry.degree}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.school} · {entry.location}
              </p>
            </div>
          ))}
        </div>

        <a
          href={scholar.href}
          target="_blank"
          rel="noreferrer noopener"
          className="group mt-4 flex items-center gap-3 rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/40 hover:bg-card"
        >
          <GraduationCap className="size-5 shrink-0 text-primary" />
          <span className="flex-1 text-sm">
            <span className="font-medium">Publications on Google Scholar</span>
            <span className="block text-muted-foreground">
              Peer-reviewed work from the observing and instrumentation side
            </span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </Section>

      <Section>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Building something at the edge of science and software?
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground text-pretty">
            I like problems where the domain is genuinely hard and the software still has to be
            reliable at 3 a.m. If that sounds like yours, say hello.
          </p>
          <Button asChild size="lg" className="mt-6">
            <a href={`mailto:${profile.email}`}>
              <Mail />
              {profile.email}
            </a>
          </Button>
        </div>
      </Section>
    </PageShell>
  );
}
