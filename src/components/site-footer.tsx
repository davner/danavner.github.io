import { Link } from "react-router";

import { PixelFire } from "@/components/pixel-fire";
import { SocialLinks } from "@/components/social-links";
import { profile } from "@/content/profile";

const LINKS = [
  { to: "/about", label: "About" },
  { to: "/career", label: "Career" },
  { to: "/blog", label: "Blog" },
  { to: "/shows", label: "Shows" },
  { to: "/trips", label: "Trips" },
];

/** Last-commit date (UTC), already formatted like "Aug 4, 2026" in `vite.config.ts`. */
const LAST_UPDATED = __LAST_UPDATED__;

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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

          <SocialLinks className="-ml-2 sm:-mr-2 sm:ml-0" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="readout-dim">
              © {new Date().getFullYear()} {profile.name} · Built in the dark with good music on
            </p>
            <p className="readout-dim">Last updated {LAST_UPDATED}</p>
          </div>
          {/* The last thing anyone reads should be a wave, not a job title. */}
          <p className="readout">
            <span aria-hidden>👋🏽</span> See ya later, alligator <span aria-hidden>🐊</span>
          </p>
        </div>
      </div>

      {/* Burns along the very bottom edge of the page. */}
      <PixelFire />
    </footer>
  );
}
