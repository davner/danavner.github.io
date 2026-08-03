import { ArrowRight, BookOpen, Briefcase, MapPin, Sparkles, User } from "lucide-react";
import { Link } from "react-router";

import { PostCard } from "@/components/post-card";
import { Section } from "@/components/page";
import { SocialLinks } from "@/components/social-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { profile, projects } from "@/content/profile";
import { posts } from "@/lib/blog";
import { useDocumentMeta } from "@/lib/use-document-meta";

const DOORS = [
  {
    to: "/work",
    icon: Briefcase,
    title: "Work",
    description:
      "The career side — what I have built, who I built it for, and the stack I reach for. Projects, roles, and skills.",
    cta: "See the work",
  },
  {
    to: "/about",
    icon: User,
    title: "About",
    description:
      "The rest of it. Where I came from, what I do when I am not shipping software, and one unusually specific bowling fact.",
    cta: "Get to know me",
  },
  {
    to: "/writing",
    icon: BookOpen,
    title: "Writing",
    description:
      "Notes on scientific software and engineering, plus whatever else I feel like writing down. Work and personal, side by side.",
    cta: "Read the posts",
  },
];

export function Home() {
  useDocumentMeta("Dan Avner", profile.tagline);

  const current = projects.filter((project) => project.current);
  const latest = posts.slice(0, 2);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="flex flex-col items-center text-center">
        <div className="relative">
          <span
            aria-hidden
            className="absolute -inset-4 rounded-full bg-primary/15 blur-2xl"
          />
          <img
            src="/img/me1.jpg"
            alt={profile.name}
            width={160}
            height={160}
            className="relative size-36 rounded-full border border-border object-cover shadow-xl sm:size-40"
          />
        </div>

        <Badge variant="outline" className="mt-8 gap-1.5 py-1 font-normal text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          {profile.role} at {profile.org}
        </Badge>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Hi, I&rsquo;m {profile.name}.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
          {profile.tagline}
        </p>

        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" />
          {profile.location}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/work">
              See my work
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`mailto:${profile.email}`}>Get in touch</a>
          </Button>
        </div>

        <SocialLinks className="mt-6" />
      </section>

      <Section className="mt-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {DOORS.map((door) => (
            <Link
              key={door.to}
              to={door.to}
              className="group relative flex flex-col rounded-xl border border-border bg-card/50 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-lg"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <door.icon className="size-5" />
              </span>
              <h2 className="mt-5 text-lg font-semibold tracking-tight">{door.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                {door.description}
              </p>
              <span className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
                {door.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Currently building">
        <ul className="divide-y divide-border rounded-xl border border-border bg-card/40">
          {current.map((project) => (
            <li key={project.name} className="flex flex-col gap-3 p-6 sm:flex-row sm:gap-6">
              <div className="sm:w-52 sm:shrink-0">
                <p className="flex items-center gap-2 font-mono font-semibold">
                  <Sparkles className="size-3.5 text-primary" />
                  {project.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{project.org}</p>
              </div>
              <div className="flex-1">
                <p className="leading-relaxed text-muted-foreground text-pretty">
                  {project.blurb}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {project.stack.map((tech) => (
                    <li key={tech}>
                      <Badge variant="secondary" className="font-mono font-normal">
                        {tech}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-sm">
          <Link
            to="/work"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Everything I have worked on
            <ArrowRight className="size-4" />
          </Link>
        </p>
      </Section>

      {latest.length > 0 ? (
        <Section title="Latest writing">
          <div className="grid gap-4 sm:grid-cols-2">
            {latest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          <p className="mt-5 text-sm">
            <Link
              to="/writing"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              All posts
              <ArrowRight className="size-4" />
            </Link>
          </p>
        </Section>
      ) : null}
    </div>
  );
}
