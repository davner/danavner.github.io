import { ArrowUpRight, Mail } from "lucide-react";

import { PageHeader, PageShell, Section } from "@/components/page";
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
        title={
          <>
            <span className="block">Built for</span>
            <span className="display-outline-ember block">the dark</span>
          </>
        }
        meta={[profile.role, profile.org, "2013 — present"]}
        lede={profile.intro}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`mailto:${profile.email}`}
            className="group inline-flex items-center gap-2 border border-ember bg-ember px-5 py-3 text-primary-foreground transition-colors hover:bg-transparent hover:text-ember"
          >
            <Mail className="size-4" />
            <span className="readout">Work with me</span>
          </a>
          <a
            href="https://github.com/davner"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 border border-border px-5 py-3 transition-colors hover:border-ember hover:text-ember"
          >
            <span className="readout">GitHub</span>
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </PageHeader>

      <Section title="Selected projects" index="01">
        <ul className="grid gap-px border border-border bg-border md:grid-cols-2">
          {projects.map((project) => (
            <li key={project.name} className="cut-corners flex flex-col bg-background p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-mono text-lg font-semibold">{project.name}</h3>
                  <p className="readout-dim mt-1">{project.org}</p>
                </div>
                {project.current ? (
                  <p className="readout flex shrink-0 items-center gap-1.5 text-ember">
                    <span className="size-1.5 animate-pulse bg-ember" />
                    Active
                  </p>
                ) : null}
              </div>

              <p className="mt-5 flex-1 leading-relaxed text-muted-foreground text-pretty">
                {project.blurb}
              </p>

              <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-4">
                {project.stack.map((tech) => (
                  <li key={tech} className="readout-dim">
                    {tech}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Experience" index="02">
        <ol>
          {roles.map((role) => (
            <li
              key={`${role.org}-${role.start}`}
              className="grid gap-x-8 gap-y-4 border-b border-border py-10 first:border-t md:grid-cols-[13rem_minmax(0,1fr)]"
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

                <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-1">
                  {role.stack.map((tech) => (
                    <li key={tech} className="readout-dim">
                      {tech}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="On sky" index="03">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="bg-background p-8 sm:px-10">
            <p className="display text-6xl text-ember sm:text-7xl">{observing.nights}</p>
            <p className="readout-dim mt-2">Nights observing</p>
          </div>
          <div className="bg-background p-8">
            <p className="text-muted-foreground text-pretty">
              Time on the mountain, not just in the repo. Enough nights at the eyepiece to know
              what breaks at 2 a.m., and what a confusing button costs when the weather window is
              closing.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-5">
              {observing.telescopes.map((telescope) => (
                <li key={telescope} className="readout">
                  {telescope}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Toolkit" index="04">
        <dl className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {skills.map((group) => (
            <div key={group.label} className="bg-background p-6 sm:p-8">
              <dt className="readout text-ember">{group.label}</dt>
              <dd className="mt-4">
                <ul className="flex flex-wrap gap-x-3 gap-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="font-mono text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Education" index="05">
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
          className="group mt-px flex items-center gap-4 border border-t-0 border-border p-6 transition-colors hover:border-ember sm:p-8"
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
        <div className="border border-ember/40 p-8 text-center sm:p-14">
          <p className="readout text-ember">Open to interesting problems</p>
          <h2 className="display mx-auto mt-5 max-w-3xl text-4xl text-balance sm:text-6xl">
            Science is hard enough. The software should not be.
          </h2>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-muted-foreground text-pretty">
            I like problems where the domain is genuinely difficult and the system still has to be
            reliable at 3 a.m. If that sounds like yours, say hello.
          </p>
          <a
            href={`mailto:${profile.email}`}
            className="mt-8 inline-flex items-center gap-2 border border-ember bg-ember px-6 py-3.5 text-primary-foreground transition-colors hover:bg-transparent hover:text-ember"
          >
            <Mail className="size-4" />
            <span className="readout">{profile.email}</span>
          </a>
        </div>
      </Section>
    </PageShell>
  );
}
