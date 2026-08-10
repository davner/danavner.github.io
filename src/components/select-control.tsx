import { CONTROL_CLASS } from "@/components/filter-toggle";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * Built on shadcn's Select, so the listbox matches the rest of the site rather
 * than the operating system. Squared off and sized from `CONTROL_CLASS`, which
 * is the one place a control's measurements are written down - the trigger sits
 * in a row with the filter pills and the search field, and a couple of pixels
 * out is immediately visible.
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
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          CONTROL_CLASS,
          /*
           * The height has to be written as the same variant shadcn uses.
           * `SelectTrigger` sets `data-[size=default]:h-9`, and an attribute
           * variant outranks the plain `h-11` in `CONTROL_CLASS`, so the
           * trigger came out 36px in a row of 44px controls - which is the
           * exact drift `CONTROL_CLASS` exists to prevent.
           */
          "data-[size=default]:h-11",
          // Square, hairline, and the page's own background - the shadcn
          // defaults are rounded with a shadow, which nothing else here is.
          "cursor-pointer rounded-none border-border bg-background text-sm shadow-none",
          "focus-visible:border-ember focus-visible:ring-0",
          // The trigger is `w-fit` by default and these sit in a sized row.
          "w-full",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent className="rounded-none border-border">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="cursor-pointer rounded-none"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
