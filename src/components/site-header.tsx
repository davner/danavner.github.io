import { NavLink } from "react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  // The wordmark already links home, so that entry is dropped on narrow screens
  // rather than letting four links plus the toggle wrap the bar.
  { to: "/", label: "Home", end: true, mobile: false },
  { to: "/work", label: "Work", end: false, mobile: true },
  { to: "/about", label: "About", end: false, mobile: true },
  { to: "/writing", label: "Writing", end: false, mobile: true },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-6">
        <NavLink
          to="/"
          aria-label="Dan Avner — home"
          className="mr-auto flex items-center gap-2 font-mono text-sm font-semibold tracking-tight whitespace-nowrap transition-opacity hover:opacity-80"
        >
          <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_2px_var(--glow)]" />
          {/* Below ~380px the mark alone carries the link, so the bar never wraps. */}
          <span className="hidden min-[380px]:inline">dan avner</span>
        </NavLink>

        <nav aria-label="Main">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => (
              <li key={item.to} className={item.mobile ? undefined : "hidden sm:block"}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors sm:px-3",
                      isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sm:ml-1 sm:border-l sm:border-border/60 sm:pl-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
