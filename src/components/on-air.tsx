import type { Lamp } from "@/lib/dan-fm";
import { cn } from "@/lib/utils";

/**
 * A label and a treatment per state.
 *
 * `lit` is carried beside the label rather than inferred from it, because the
 * paint is what a reader takes the badge's meaning from before reading a word:
 * a state added here has to choose whether the lamp burns, instead of
 * inheriting an answer from how its name happens to be spelled.
 */
const LAMP: Record<Lamp, { label: string; lit: boolean }> = {
  "on-air": { label: "On air", lit: true },
  "off-air": { label: "Off air", lit: false },
};

/**
 * The station light: a badge saying whether the station has anything on.
 *
 * The glow is `.on-air-lamp` in `index.css`, on the dot and applied only when
 * lit, so an unlit lamp carries none to switch off. Putting it on the dot
 * rather than behind the badge is what keeps ember off the label: the dot is
 * decoration with nothing to read under it, and the glow dies inside the gap
 * before the first character.
 *
 * The label is prefixed for a screen reader because these are radio terms and
 * nothing else in the badge says what they are about. Read on its own - and on
 * a log with nothing in it there is no card under the badge to fall back on -
 * "Off air" is a phrase with no subject.
 *
 * Not `role="status"`: the state is decided once while React renders and never
 * changes under the reader, and a live region that never goes live promises an
 * announcement that cannot arrive. `filter-status.tsx` is where that role
 * belongs, on a count that does update.
 */
export function OnAir({ lamp, className }: { lamp: Lamp; className?: string }) {
  const { label, lit } = LAMP[lamp];

  return (
    <p
      data-slot="station-lamp"
      className={cn(
        "readout inline-flex items-center gap-2.5 border px-3.5 py-2",
        lit ? "border-ember text-ember" : "border-border text-muted-foreground",
        className,
      )}
    >
      {/* Square-ish rather than round: the radius cap is 4px site-wide, and the
          rounding sweep in `tests/site.spec.ts` reports anything past it. */}
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-sm", lit ? "on-air-lamp bg-ember" : "bg-border")}
      />
      <span className="sr-only">Station status: </span>
      {label}
    </p>
  );
}
