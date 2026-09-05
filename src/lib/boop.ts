import { SpringValue } from "@react-spring/web";

/**
 * The framed photo's press answer, loaded on first press and never in the
 * eager graph: react-spring stays out of the LCP bundle, and the first boop
 * affording a frame of chunk latency is what that costs.
 *
 * The gesture is the copy stamp's, in physics: the registration marks land at
 * the pressed pose instantly - a stamp does not travel to the paper - and the
 * spring carries the release back to rest. One leg, because the Two Hundred
 * Rule reads a spring by its settle and a there-and-back pair would double it.
 */

/*
 * Constants in the make-easings idiom: tension 400, friction 30, mass 1,
 * clamped. Underdamped enough that the clamp engages at the rest crossing -
 * measured settle 183ms against the shipped library. The research register's
 * 350/40 pairing is overdamped (the clamp never engages) and measures 583ms,
 * which the doctrine refuses.
 */
const BOOP = { tension: 400, friction: 30, clamp: true };

/** The pop's whole travel, in px - inward, because the frame clips outward. */
const TRAVEL = 2;

/* One spring per figure, so a re-press retargets the live spring mid-flight
   instead of racing a second one - the interruption grace WAAPI lacks. */
const springs = new WeakMap<HTMLElement, SpringValue<number>>();

export function boop(figure: HTMLElement, reduce: boolean): void {
  /*
   * The exposure flash: reader-triggered, 90ms, opacity only - the second
   * member of the Allowlist Contract Rule's bounded survival, and under
   * reduced motion the only signal the press landed. WAAPI like the shutter
   * blink, because the CSS animation kill would erase exactly the cue the
   * survival clause keeps.
   */
  figure
    .querySelector<HTMLElement>("[data-slot=boop-flash]")
    ?.animate([{ opacity: 0 }, { opacity: 0.3 }, { opacity: 0 }], {
      duration: 90,
      easing: "ease-out",
    });

  // The transform springs are never targeted under reduced motion: the
  // doctrine removes the transform state outright, and per-key immediate
  // would execute both legs as visible jumps instead.
  if (reduce) return;

  const ticks = figure.querySelectorAll<HTMLElement>("[data-slot=boop-tick]");
  if (ticks.length === 0) return;

  const apply = (progress: number) => {
    ticks.forEach((tick, index) => {
      // The top-left mark pops down-right, the bottom-right mark up-left.
      const inward = index === 0 ? 1 : -1;
      const shift = inward * TRAVEL * progress;
      tick.style.opacity = String(progress);
      tick.style.transform = `translate(${shift}px, ${shift}px)`;
    });
  };

  const spring = springs.get(figure) ?? new SpringValue(0);
  springs.set(figure, spring);

  spring.set(1);
  apply(1);
  void spring.start(0, { config: BOOP, onChange: () => apply(spring.get()) });
}
