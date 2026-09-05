import { Menu } from "lucide-react";
import { type PointerEvent, useState } from "react";
import { useLocation } from "react-router";

import { NavLink } from "@/components/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isGroup, SECTIONS, type Section } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The group a bar item's label watches for hover. Named rather than bare,
 * because `group-hover:` matches any ancestor carrying the class and
 * `NavigationMenuList` carries a bare `group` of its own - so an unnamed one
 * here lit every label in the bar at once the moment the pointer entered any of
 * them, which read as the whole nav responding to a hover over one item.
 */
const BAR_GROUP = "group/bar-item";

/**
 * A top-level bar item: mono label with the ember rule on the header's edge.
 *
 * The trailing `!` on the backgrounds is doing real work. `navigationMenuTriggerStyle`
 * paints an accent behind a trigger on hover, on focus and while open, layered
 * across several variants that each out-specify a plain `bg-transparent`. This
 * bar is flat at every state - the ember rule is what marks the current section -
 * so the accent has to be turned off rather than merely overridden.
 */
const BAR_ITEM = cn(
  BAR_GROUP,
  // `flex-row` is stated rather than left to the default: `NavigationMenuLink`'s
  // own base sets `flex-col`, and a direction is not a display, so merging the
  // two class strings keeps both.
  "relative flex h-full flex-row items-center gap-1.5 rounded-none px-1.5 transition-colors sm:px-3",
  "bg-transparent! hover:bg-transparent! focus:bg-transparent! data-[state=open]:bg-transparent!",
);

/**
 * What makes the collections panel a click rather than a hover.
 *
 * Radix drives a navigation menu from the pointer: moving over a trigger opens
 * it, leaving either the trigger or the panel starts a close timer. A panel
 * that expands because the pointer crossed the bar on its way to the theme
 * toggle is a panel nobody asked for, so both directions are refused here and
 * the button behaves like a button.
 *
 * Refused rather than replaced. `composeEventHandlers` runs the consumer's
 * handler first and skips Radix's own once the event is defaulted, which is
 * what lets the rest of the primitive stand - the click still toggles, Escape
 * and a press outside still dismiss, a link still closes the panel behind it,
 * and the roles, the focus order and `aria-expanded` are all still Radix's.
 */
const CLICK_TO_OPEN = {
  onPointerMove: (event: PointerEvent) => event.preventDefault(),
  onPointerLeave: (event: PointerEvent) => event.preventDefault(),
};

function ActiveRule({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        // Under the item, and level across all of them - which is why the bar
        // items are full-height. Sized to their own content, the group trigger
        // came out taller than a plain link because of the chevron, and its
        // marker sat two pixels lower than the rest.
        "absolute inset-x-1.5 -bottom-px h-0.5 bg-ember transition-transform duration-150",
        // A keyboard activation holds visible focus on the item when the
        // route flips, and control feedback never moves for the keyboard -
        // the rule snaps on instead of scaling.
        "group-focus-visible/bar-item:transition-none",
        on ? "scale-x-100" : "scale-x-0",
      )}
    />
  );
}

export function SiteHeader() {
  /*
   * Below `sm` the sections collapse into a menu rather than being squeezed:
   * seven of them do not fit a 320px phone. Above `sm` they sit in a bar, with
   * the collections behind one trigger so the bar stops growing every time a
   * shelf gets a page.
   */
  const [open, setOpen] = useState(false);
  /*
   * Whether the collections panel was opened by pointer, decided at
   * activation: a keydown on the trigger marks the keyboard, and the click
   * that follows re-checks `:focus-visible` (a pointer click never sets it).
   * Gating the hairline's class on this - rather than suppressing the
   * animation in CSS while focus is visible - is what stops the draw from
   * replaying when Tab moves focus off the trigger into the panel: the class
   * either lands or never exists.
   */
  const [pointerOpen, setPointerOpen] = useState(false);
  const { pathname } = useLocation();

  const isOn = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    /* Opaque, so the bar's contrast is a property of the bar rather than of
       whatever cover art happens to scroll under it. Paper has no navigation,
       so print drops the whole bar. */
    <header className="sticky top-0 z-50 border-b border-border bg-background print:hidden">
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
          <span className="display text-title">Dan Avner</span>
        </NavLink>

        <NavigationMenu
          // The shared animated viewport is for mega-menus that need to measure
          // and morph between panels. One short list does not, and turning it off
          // drops the panel straight under its trigger where it belongs.
          viewport={false}
          className="hidden h-full sm:flex"
        >
          <NavigationMenuList className="h-full items-stretch gap-0">
            {SECTIONS.map((entry) =>
              isGroup(entry) ? (
                <NavigationMenuItem key={entry.label} className="flex">
                  {/* The trigger draws its own chevron, already rotating on
                      open, so this passes only the label. */}
                  <NavigationMenuTrigger
                    className={cn(BAR_ITEM, "cursor-pointer")}
                    {...CLICK_TO_OPEN}
                    // Keydown covers the ArrowDown open, which fires no click.
                    onKeyDown={() => setPointerOpen(false)}
                    onClick={(event) =>
                      setPointerOpen(!event.currentTarget.matches(":focus-visible"))
                    }
                  >
                    <span
                      className={cn(
                        "readout transition-colors",
                        entry.items.some((item) => isOn(item.to))
                          ? "text-foreground"
                          : "text-muted-foreground group-hover/bar-item:text-foreground",
                      )}
                    >
                      {entry.label}
                    </span>
                    <ActiveRule on={entry.items.some((item) => isOn(item.to))} />
                  </NavigationMenuTrigger>

                  {/* `rounded-none!` for the same reason: the panel's radius
                      arrives through a `group-data-[viewport=false]` variant
                      that out-specifies a plain utility. Nothing here is round. */}
                  <NavigationMenuContent
                    className="rounded-none! border-border p-0"
                    {...CLICK_TO_OPEN}
                  >
                    {/* The ember hairline that draws in as the panel opens -
                        the ActiveRule idiom at panel scale. Pointer opens only:
                        on a keyboard open the class never lands, so there is
                        no deferred animation left to replay. */}
                    <span
                      aria-hidden
                      className={cn("block h-px bg-ember", pointerOpen && "nav-panel-rule")}
                    />
                    <ul className="w-44">
                      {entry.items.map((item) => (
                        <li key={item.to} className="border-b border-border last:border-b-0">
                          <NavigationMenuLink asChild>
                            {/*
                             * No fill on hover, matching the bar above it.
                             * `NavigationMenuLink` paints `bg-accent` on hover
                             * and on focus, and `asChild` concatenates class
                             * strings rather than merging them - so these have
                             * to out-rank it rather than replace it.
                             */}
                            <NavLink
                              to={item.to}
                              className={cn(
                                "group/link block px-4 py-3 transition-colors",
                                "bg-transparent! hover:bg-transparent! focus:bg-transparent!",
                                "data-[active=true]:bg-transparent!",
                              )}
                            >
                              {({ isActive }) => <PanelLabel item={item} active={isActive} />}
                            </NavLink>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ) : (
                <NavigationMenuItem key={entry.to} className="flex">
                  {/* `BAR_ITEM` goes on the link rather than on the `NavLink`
                      inside it. `Slot` concatenates the two class strings
                      instead of merging them, so a bar item spelled on the
                      child never out-ranks the panel styling on the parent -
                      it just sits beside it. Passed here, `cn` resolves the
                      pair. */}
                  <NavigationMenuLink asChild className={BAR_ITEM}>
                    <NavLink to={entry.to}>
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              "readout transition-colors",
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground group-hover/bar-item:text-foreground",
                            )}
                          >
                            {entry.label}
                          </span>
                          <ActiveRule on={isActive} />
                        </>
                      )}
                    </NavLink>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ),
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            {/* `Button` rather than a bare trigger: the focus ring, the hover
                state and the pointer cursor all come from the shared base, which
                is what `everything clickable shows a finger` polices. */}
            <Button
              variant="ghost"
              aria-label="Main menu"
              /* Square and unfilled, like the bar it stands in for. `ghost`
                 still earns its place: the focus ring, the disabled handling and
                 the pointer cursor come from the shared base rather than being
                 spelled out here and forgotten next time. */
              className="gap-2 rounded-none bg-transparent! px-2 text-muted-foreground hover:bg-transparent! hover:text-foreground sm:hidden"
            >
              <Menu />
              <span className="readout">Menu</span>
            </Button>
          </SheetTrigger>

          {/* Square and flat, like every other panel here. The drawer slides
              from the right, which is the side the button it came from sits on. */}
          {/* Width left to the component's own `w-3/4 sm:max-w-sm`. Pinning it
              to `w-72` took 288px of a 320px phone and left the page showing as
              a 32px sliver, which reads as a broken overlay rather than a
              drawer over something. */}
          <SheetContent side="right" className="gap-0 border-border bg-background p-0">
            <SheetHeader className="border-b border-border p-4">
              {/* `font-medium` is stated because `SheetTitle`'s own base sets
                  `font-semibold`, and a utility out-ranks `readout` - so
                  without it this one label sits a weight above the six others
                  set the same way. */}
              <SheetTitle className="readout font-medium text-left text-muted-foreground">
                Menu
              </SheetTitle>
              {/* Required for the dialog to have a description; there is nothing
                  useful to say about a list of links, so it is read-only-to-AT. */}
              <SheetDescription className="sr-only">
                Links to every section of the site.
              </SheetDescription>
            </SheetHeader>

            {/*
             * Flattened into headed groups rather than nested menus. A dropdown
             * inside a drawer on a phone is two taps to reach a link that fits on
             * the screen either way.
             */}
            <nav aria-label="Main" className="overflow-y-auto">
              {SECTIONS.map((entry) =>
                isGroup(entry) ? (
                  <div key={entry.label} className="border-b border-border last:border-b-0">
                    {/* `readout-dim` is already `--muted-foreground`. Dimming it
                        again put this group heading at 3.28:1 light and 3.88:1
                        dark, which axe reports as a real violation the moment
                        the sheet is open. */}
                    <p className="readout-dim px-4 pt-3 pb-1">{entry.label}</p>
                    <ul>
                      {entry.items.map((item) => (
                        <MobileItem
                          key={item.to}
                          item={item}
                          nested
                          onNavigate={() => setOpen(false)}
                        />
                      ))}
                    </ul>
                  </div>
                ) : (
                  <ul key={entry.to} className="border-b border-border last:border-b-0">
                    <MobileItem item={entry} onNavigate={() => setOpen(false)} />
                  </ul>
                ),
              )}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="border-border sm:ml-2 sm:border-l sm:pl-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * A link inside the desktop Hobbies panel.
 *
 * The colour reacts to the link being hovered rather than the label itself, so
 * the whole row is the target while only the text changes - which is how the
 * bar above behaves.
 */
function PanelLabel({ item, active }: { item: Section; active: boolean }) {
  return (
    <span
      className={cn(
        "readout transition-colors",
        // Hover brightens; ember is reserved for the page you are on. Using it
        // for both made every row you passed over look like the current one.
        active ? "text-ember" : "text-muted-foreground group-hover/link:text-foreground",
      )}
    >
      {item.label}
    </span>
  );
}

/**
 * A link inside the phone menu.
 *
 * `nested` indents the ones that sit under a group heading. The panel's title,
 * its top-level links and its group headings all share a left edge; the links
 * belonging to a heading step in from it, so the list reads as a hierarchy
 * rather than as nine equal things with a stray word in the middle.
 */
function MobileItem({
  item,
  nested,
  onNavigate,
}: {
  item: Section;
  nested?: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            // Text colour only, no fill. A full-width block of grey behind one
            // row reads as the panel highlighting rather than the link.
            "relative flex items-center py-3 pr-4 transition-colors",
            nested ? "pl-8" : "pl-4",
            isActive ? "text-ember" : "text-muted-foreground hover:text-foreground",
          )
        }
      >
        {({ isActive }) => (
          <>
            {/*
             * The marker sits in the gutter rather than in the flow. Holding a
             * slot for it inside the padding pushed every label 14px right of
             * the panel's title and its group headings, so three things that
             * should share a left edge had three.
             */}
            {isActive ? (
              <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 bg-ember" />
            ) : null}
            <span className="readout">{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}
