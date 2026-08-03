import { Link } from "react-router";

import { SocialLinks } from "@/components/social-links";
import { profile } from "@/content/profile";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-background/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-sm font-semibold">{profile.name}</p>
          <p className="text-sm text-muted-foreground">
            {profile.role} · {profile.org}
          </p>
        </div>

        <SocialLinks className="-ml-2 md:ml-0" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pb-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} {profile.fullName}</p>
        <p className="flex items-center gap-3">
          <Link to="/work" className="transition-colors hover:text-foreground">
            Work
          </Link>
          <Link to="/about" className="transition-colors hover:text-foreground">
            About
          </Link>
          <Link to="/writing" className="transition-colors hover:text-foreground">
            Writing
          </Link>
        </p>
      </div>
    </footer>
  );
}
