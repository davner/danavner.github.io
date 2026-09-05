import { useSpring } from "@react-spring/web";
import { useCallback, useRef, type PointerEvent } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * The shelf slip's physics, shared by both shelves so the covers answer one
 * hand. Constants in the make-easings idiom: tension 400, friction 30, mass
 * 1, clamped - underdamped enough for the clamp to engage at the rest
 * crossing, measured 183ms to rest against the shipped library. The research
 * pairing's friction 32 measures 217ms, which the Two Hundred Rule refuses.
 */
export const SLIP = { tension: 400, friction: 30, clamp: true as const };

/*
 * How a px/ms pointer speed becomes the spring's initial velocity, and the
 * cap that keeps a violent sweep inside the envelope. The scale is tuned by
 * eye: a fast sweep should make a cover leap from under the pointer, not
 * tear loose from the shelf.
 */
const HANDOFF = 220;
const MAX_SPEED = 3;

/** Depth grows with sweep speed, up to half again the resting pose. */
const DEPTH_GAIN = 0.25;
const MAX_GAIN_SPEED = 2;

/**
 * One per shelf: an EWMA of pointermove speed over roughly three samples.
 * Hand-rolled because the need is fifteen lines, and the gesture libraries
 * that would replace them are dormant. Speed is a magnitude - a sweep across
 * the shelf is mostly horizontal, and it is exactly the gesture whose
 * momentum the slip exists to carry - and the sign toward the slipped pose
 * is applied where the spring starts.
 */
export function useShelfTracker() {
  const state = useRef({ x: 0, y: 0, t: 0, speed: 0 });

  const onPointerMove = useCallback((event: PointerEvent) => {
    const s = state.current;
    const dt = event.timeStamp - s.t;
    if (s.t > 0 && dt > 0 && dt < 100) {
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      const instant = Math.hypot(dx, dy) / dt;
      s.speed += (instant - s.speed) / 3;
    } else {
      // A gap in the stream is a new gesture, not a very slow one.
      s.speed = 0;
    }
    s.x = event.clientX;
    s.y = event.clientY;
    s.t = event.timeStamp;
  }, []);

  const velocity = useCallback(() => state.current.speed, []);

  return { onPointerMove, velocity };
}

/**
 * Per tile: the spring that owns the cover's whole pose, and the handlers
 * that retarget it. Enter starts toward the slipped pose carrying the
 * sweep's velocity; leave retargets to rest carrying the leave speed - the
 * wake. Every gate leaves the handlers as no-ops: reduced motion (the
 * transform state is removed outright - the springs are never targeted),
 * non-hover media, and touch pointers.
 */
export function useSlip(velocity: () => number, pose: { y: number; rotate?: number }) {
  const reduce = useReducedMotion();
  const [style, api] = useSpring(() => ({ y: 0, rotate: 0, config: SLIP }));

  const gated = useCallback(
    (event: PointerEvent) =>
      reduce || event.pointerType === "touch" || !window.matchMedia("(hover: hover)").matches,
    [reduce],
  );

  const onPointerEnter = useCallback(
    (event: PointerEvent) => {
      if (gated(event)) return;
      const speed = Math.min(velocity(), MAX_SPEED);
      const depth = pose.y * (1 + Math.min(speed, MAX_GAIN_SPEED) * DEPTH_GAIN);
      void api.start({
        y: -depth,
        rotate: pose.rotate ?? 0,
        config: { ...SLIP, velocity: -speed * HANDOFF },
      });
    },
    [api, gated, pose.rotate, pose.y, velocity],
  );

  const onPointerLeave = useCallback(
    (event: PointerEvent) => {
      if (gated(event)) return;
      const speed = Math.min(velocity(), MAX_SPEED);
      void api.start({ y: 0, rotate: 0, config: { ...SLIP, velocity: speed * HANDOFF } });
    },
    [api, gated, velocity],
  );

  return { style, onPointerEnter, onPointerLeave };
}
