import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * The one place a filter control's measurements are written down.
 *
 * Every page used to spell its own out, which is how `/vinyl` shipped with two
 * rows of pills that did not line up - `px-5 py-3` on the owner row and
 * `px-4 py-2.5` on the sort row, a quarter-step apart and immediately visible
 * once they sat above each other.
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
      className={cn("max-w-full flex-wrap bg-border", className)}
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
             * the edges. "Everything 51" wanted 105px of text in the 72px its
             * share of the row left inside the padding, while "Dan 42" wanted
             * 46px and looked twice as roomy. Sized to content, every pill
             * keeps the same 20px either side.
             */
            "flex-none",
            "gap-2 bg-background text-muted-foreground",
            "hover:bg-background hover:text-ember",
            "data-[state=on]:bg-ember data-[state=on]:text-primary-foreground",
          )}
        >
          <span className="readout">{option.label}</span>
          {/* No opacity here: dimming the count to 70% drops it under the
              4.5:1 AA contrast floor against both the ember and the plain
              background. The mono face at 0.65rem is already secondary. */}
          {option.count != null ? (
            <span className="font-mono text-[0.65rem]">{option.count}</span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
