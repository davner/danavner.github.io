import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SECTIONS as NAV } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The mono label every nav item is set in, at both sizes. */
const LABEL = "font-mono text-[0.68rem] font-medium tracking-[0.18em] uppercase";

export function SiteHeader() {
  /*
   * Six sections do not fit across a 320px phone, and a seventh is coming, so
   * below `sm` they collapse into a menu rather than being squeezed. This used
   * to be an inline row at every width, which is also why the wordmark had to
   * contract to "DA" - with the row gone there is room for the whole name back.
   */
  const [open, setOpen] = useState(false);

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
          <span className="display text-xl sm:text-2xl">Dan Avner</span>
        </NavLink>

        <nav aria-label="Main" className="hidden sm:block">
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
                      <span className={LABEL}>{item.label}</span>
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

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label="Main menu"
            className="flex cursor-pointer items-center gap-2 px-2 py-2 text-muted-foreground transition-colors hover:text-foreground sm:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className={LABEL}>Menu</span>
          </PopoverTrigger>

          {/* Square corners and a flat surface, like every other panel here. */}
          <PopoverContent
            align="end"
            sideOffset={9}
            className="w-56 rounded-none border-border bg-background p-0"
          >
            <nav aria-label="Main">
              <ul className="flex flex-col">
                {NAV.map((item) => (
                  <li key={item.to} className="border-b border-border last:border-b-0">
                    <NavLink
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card/60",
                          isActive ? "text-ember" : "text-muted-foreground hover:text-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Holds its width whether or not it is showing, so
                              the labels do not shift between items. */}
                          <span
                            className={cn("h-3 w-0.5 shrink-0", isActive ? "bg-ember" : "bg-transparent")}
                          />
                          <span className={LABEL}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </PopoverContent>
        </Popover>

        <div className="border-border sm:ml-2 sm:border-l sm:pl-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
