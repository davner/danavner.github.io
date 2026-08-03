import { NavLink } from "react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/about", label: "About", index: "01" },
  { to: "/career", label: "Career", index: "02" },
  { to: "/blog", label: "Blog", index: "03" },
  { to: "/shows", label: "Shows", index: "04" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-2 sm:gap-3 sm:px-6">
        <NavLink
          to="/"
          aria-label="Dan Avner - home"
          className={({ isActive }) =>
            cn(
              "mr-auto flex items-baseline transition-opacity hover:opacity-70",
              isActive && "text-ember",
            )
          }
        >
          {/* Four section labels plus a toggle leave no room for the full
              wordmark on the narrowest phones, so it contracts to initials. */}
          <span className="display text-xl sm:text-2xl">
            <span className="sm:hidden">DA</span>
            <span className="hidden sm:inline">Dan Avner</span>
          </span>
        </NavLink>

        <nav aria-label="Main">
          <ul className="flex items-center">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-baseline gap-1.5 px-1.5 py-2 transition-colors sm:px-3",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "hidden font-mono text-[0.6rem] transition-colors sm:inline",
                          isActive ? "text-ember" : "text-muted-foreground",
                        )}
                      >
                        {item.index}
                      </span>
                      <span className="font-mono text-[0.6rem] font-medium tracking-[0.1em] uppercase sm:text-[0.68rem] sm:tracking-[0.18em]">
                        {item.label}
                      </span>
                      {/* Active marker sits on the header's bottom rule. */}
                      <span
                        className={cn(
                          "absolute inset-x-1.5 -bottom-px h-0.5 bg-ember transition-transform duration-150",
                          isActive ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-border sm:ml-2 sm:border-l sm:pl-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
