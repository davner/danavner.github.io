import { ChevronDown } from "lucide-react";

import { CONTROL_CLASS } from "@/components/filter-toggle";
import { cn } from "@/lib/utils";

/**
 * A single-choice control for options that are a setting rather than a filter.
 *
 * `FilterToggle` is the right shape when the choices are the subject - whose
 * records, which category - and each one is worth a target the size of a
 * button. Sort order is not that: it is one answer out of four, nobody scans
 * the ones they did not pick, and as pills it took two lines on a phone to say
 * a single word.
 *
 * A real `<select>` rather than a menu built out of divs. It brings the
 * platform picker on a phone, arrow keys and type-ahead on a desktop, and the
 * whole of its accessibility, none of which we would get for free otherwise.
 * Only the closed state is ours to style; the open list belongs to the OS.
 */
export function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Accessible name. There is no visible label, so this carries the meaning. */
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(
          CONTROL_CLASS,
          // `pr-11` clears the chevron, which sits on top and is decoration -
          // the native arrow goes with `appearance-none`.
          "w-full cursor-pointer appearance-none border border-border bg-background pr-11 text-sm",
          "focus-visible:border-ember focus-visible:outline-none",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
