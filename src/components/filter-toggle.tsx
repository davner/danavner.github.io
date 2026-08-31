import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * The one place a filter control's measurements are written down.
 *
 * One place, so pill rows cannot drift apart: two rows a quarter-step out of
 * step are immediately visible once they sit above each other.
 *
 * A fixed height rather than vertical padding, because these sit in a row with
 * the search field, whose border and larger text would otherwise make it a
 * couple of pixels taller than the pills beside it. `h-11` is 44px, which is
 * also the smallest comfortable touch target.
 */
export const CONTROL_CLASS = "h-11 px-5";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Printed after the label when given. */
  count?: number;
}

/**
 * A single-select filter row: blog categories, vinyl owners, vinyl sort order.
 *
 * Rendered as a radio group, which is what `ToggleGroup type="single"` gives -
 * roving focus and arrow-key navigation for free.
 */
export function FilterToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Accessible name for the group. */
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Radix reports "" when the active item is clicked again. A radio group
      // should not empty itself that way, so the current value stands.
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={label}
      /*
       * No background here. Painting the seams as `bg-border` on this element
       * showing through `gap-px` works only while the row fits on one line: a
       * flex container that wraps takes the full width available rather than the
       * width of its longest line, so on a phone the leftover space beside the
       * last pill of each row paints itself grey. The seams are drawn by the
       * pills instead - see below.
       */
      className={cn("max-w-full flex-wrap", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn(
            CONTROL_CLASS,
            /*
             * `flex-none` overrides the `flex-1` shadcn puts on every
             * ToggleGroupItem. `flex-1` means `flex: 1 1 0%`, so the pills in a
             * row are all forced to one width no matter what is written on
             * them - and with `min-w-0` and `whitespace-nowrap`, the longest
             * label then spills straight through its own padding and touches
             * the edges, while a short one looks twice as roomy. Sized to
             * content, every pill keeps the same 20px either side.
             */
            "flex-none",
            /*
             * The seam, drawn per pill. A 1px spread shadow takes no layout
             * space, so with the group's `gap-px` a pill's shadow lands on the
             * exact pixel its neighbour's does - one hairline between them,
             * however the row wraps, and nothing left over to paint.
             */
            "shadow-[0_0_0_1px_var(--color-border)]",
            "gap-2 bg-background text-muted-foreground",
            "hover:bg-background hover:text-ember",
            "data-[state=on]:bg-ember data-[state=on]:text-primary-foreground",
          )}
        >
          <span className="readout">{option.label}</span>
          {/* No opacity here: dimming the count to 70% drops it under the
              4.5:1 AA contrast floor against both the ember and the plain
              background. The mono readout face is already secondary. */}
          {option.count != null ? <span className="readout">{option.count}</span> : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
