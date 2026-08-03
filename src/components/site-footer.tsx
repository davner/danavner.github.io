import { Link } from "react-router";

import { SocialLinks } from "@/components/social-links";
import { profile } from "@/content/profile";

const LINKS = [
  { to: "/work", label: "Work" },
  { to: "/about", label: "About" },
  { to: "/writing", label: "Writing" },
  { to: "/shows", label: "Shows" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="rule-ticks" />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div>
            <p className="display text-5xl sm:text-6xl">
              Dan
              <br />
              Avner
            </p>
            <p className="readout-dim mt-4">
              {profile.role} — {profile.org}
            </p>
            <p className="readout-dim mt-1">{profile.location}</p>
          </div>

          <div className="flex flex-col gap-6 md:items-end">
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="readout text-muted-foreground transition-colors hover:text-ember"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <SocialLinks className="-ml-2 md:-mr-2 md:ml-0" />

            <a
              href={`mailto:${profile.email}`}
              className="font-mono text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-ember hover:decoration-ember"
            >
              {profile.email}
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="readout-dim">© {new Date().getFullYear()} {profile.fullName}</p>
          <p className="readout-dim">Built in the dark · Los Angeles</p>
        </div>
      </div>
    </footer>
  );
}
