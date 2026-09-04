import { GraduationCap, Github, Instagram, Linkedin, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import { socials, type SocialLink } from "@/content/profile";
import { cn } from "@/lib/utils";

const ICONS = {
  github: Github,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  "graduation-cap": GraduationCap,
} satisfies Record<SocialLink["icon"], typeof Github>;

export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cn("flex items-center gap-0.5", className)}>
      {socials.map((social) => {
        const Icon = ICONS[social.icon];
        const external = social.href.startsWith("http");

        return (
          <li key={social.label}>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              {/* `me` marks the profile as this person's own - the body-side
                  half of the head's rel=me links, for parsers that do run
                  the app. */}
              <a
                href={social.href}
                aria-label={social.label}
                title={social.label}
                {...(external ? { target: "_blank", rel: "me noreferrer noopener" } : {})}
              >
                <Icon />
              </a>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
