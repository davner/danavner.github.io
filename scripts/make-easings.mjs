#!/usr/bin/env node
/**
 * Prints the two spring curves in `src/index.css` as CSS `linear()` stop lists.
 *
 *   node scripts/make-easings.mjs
 *
 * Run by hand and paste the output over the `--ease-*` values, like the other
 * `make-*` generators. Each curve is a damped spring solved analytically - no
 * simulation, no dependency - then sampled at even intervals across its settle
 * time, so the character survives as ~20 numbers a browser interpolates.
 *
 * These curves drive transforms on pressed controls, and a curve that crosses
 * 1 would scale a control past its rest size on release - so the script
 * refuses to print one. Damping below critical is rejected outright, and the
 * solved curve is then checked point by point across a window sized to its own
 * slowest decay, because enough initial velocity carries even a critically
 * damped spring past its target.
 */

const SETTLE_EPSILON = 0.001;
const POINTS = 21;

/**
 * Step response of a damped spring from rest position 0 toward 1, as
 * `{ x, tail }`: the curve itself, and its slowest time constant - every term
 * of the solution decays at least this fast, so any overshoot peak and the
 * whole settle sit within a few tails of zero.
 *
 * `velocity` is the initial velocity in units of travel per second: the stamp
 * starts already moving, the way a hand holding a stamp is already falling,
 * while the drawer accelerates from rest and spends its curve decelerating.
 */
function solve({ stiffness, damping, mass, velocity }) {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) throw new Error(`under-damped (zeta ${zeta.toFixed(3)}): would overshoot`);

  if (zeta === 1) {
    // Critically damped: x(t) = 1 - (1 + (omega - v0) t) e^(-omega t).
    return {
      x: (t) => 1 - (1 + (omega - velocity) * t) * Math.exp(-omega * t),
      tail: 1 / omega,
    };
  }

  // Over-damped: two real roots, x(t) = 1 + A e^(s1 t) + B e^(s2 t).
  const spread = omega * Math.sqrt(zeta * zeta - 1);
  const s1 = -omega * zeta + spread;
  const s2 = -omega * zeta - spread;
  const a = (velocity + s2) / (s1 - s2);
  const b = -1 - a;
  return {
    x: (t) => 1 + a * Math.exp(s1 * t) + b * Math.exp(s2 * t),
    tail: -1 / s1,
  };
}

/**
 * The clamp: 1000 even samples of the curve must never exceed 1 and never
 * decrease. Checked on the curve itself rather than derived per branch,
 * because a large initial velocity carries even a critically damped spring
 * past its rest point.
 *
 * The window has to be independent of the settle search: `settleTime` stops
 * at the first moment the curve comes within SETTLE_EPSILON of rest, which
 * for a curve about to overshoot is on the way up - a window cut there ends
 * before the peak it exists to catch. So the caller passes a window of many
 * tails, which provably contains any peak along with the whole settle.
 */
function assertClamped(x, window) {
  let previous = 0;
  for (let i = 1; i <= 1000; i += 1) {
    const value = x((i / 1000) * window);
    if (value > 1 + 1e-9) throw new Error("curve overshoots 1: lower the velocity");
    if (value < previous) throw new Error("curve is not monotone: lower the velocity");
    previous = value;
  }
}

/** Bisects for the moment the spring stays within SETTLE_EPSILON of rest. */
function settleTime(x) {
  let low = 0;
  let high = 1;
  while (1 - x(high) > SETTLE_EPSILON) high *= 2;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (1 - x(mid) > SETTLE_EPSILON) low = mid;
    else high = mid;
  }
  return high;
}

function easing(name, constants) {
  const { x, tail } = solve(constants);
  const duration = settleTime(x);
  // 20 tails: the settle at SETTLE_EPSILON needs at most ~10, and an
  // overshoot peak sits within the first few, so the window holds both.
  assertClamped(x, Math.max(duration, 20 * tail));
  const stops = Array.from({ length: POINTS }, (_, i) => {
    const value = i === POINTS - 1 ? 1 : x((i / (POINTS - 1)) * duration);
    return Number(value.toFixed(4));
  });
  const { stiffness, damping, mass, velocity } = constants;
  console.log(
    `  /* ${name}: stiffness ${stiffness}, damping ${damping}, mass ${mass}, velocity ${velocity} */`,
  );
  console.log(`  --ease-${name}: linear(${stops.join(", ")});`);
}

// The stamp: critically damped and already moving when it lands - most of the
// travel in the first fifth, then a short settle. The character of a hand
// stamp meeting paper.
easing("stamp", { stiffness: 900, damping: 60, mass: 1, velocity: 15 });

// The drawer: over-damped from rest - eases into motion, then decelerates the
// whole way home, like a drawer gliding shut on its rails.
easing("drawer", { stiffness: 400, damping: 48, mass: 1, velocity: 0 });
