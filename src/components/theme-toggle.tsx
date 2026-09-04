import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  /*
   * Both icons stay mounted so the flip can cross-fade - a single conditional
   * icon has nothing to transition against. The `.dark` class on the root
   * drives which one shows; the quarter-turn is pointer feedback only, so a
   * keyboard press (`group-focus-visible`) swaps instantly, and reduced
   * motion keeps the opacity cross-fade while the turn snaps.
   */
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="group/theme relative text-muted-foreground hover:text-foreground"
    >
      <Sun className="-rotate-90 opacity-0 transition-[rotate,opacity] duration-150 ease-stamp group-focus-visible/theme:transition-none dark:rotate-0 dark:opacity-100" />
      <Moon className="absolute rotate-0 opacity-100 transition-[rotate,opacity] duration-150 ease-stamp group-focus-visible/theme:transition-none dark:rotate-90 dark:opacity-0" />
    </Button>
  );
}
