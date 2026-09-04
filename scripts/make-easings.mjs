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
 * Damping at or above critical is a structural guarantee, not a tuning choice:
 * these curves drive transforms on pressed controls, and a spring that
 * overshoots would scale a control past its rest size on release.
 */

const SETTLE_EPSILON = 0.001;
const POINTS = 21;

/**
 * Step response of a damped spring from rest position 0 toward 1.
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
    return (t) => 1 - (1 + (omega - velocity) * t) * Math.exp(-omega * t);
  }

  // Over-damped: two real roots, x(t) = 1 + A e^(s1 t) + B e^(s2 t).
  const spread = omega * Math.sqrt(zeta * zeta - 1);
  const s1 = -omega * zeta + spread;
  const s2 = -omega * zeta - spread;
  const a = (velocity + s2) / (s1 - s2);
  const b = -1 - a;
  return (t) => 1 + a * Math.exp(s1 * t) + b * Math.exp(s2 * t);
}

/**
 * The clamp, checked on the curve itself rather than derived per branch: a
 * large initial velocity can carry even an over-damped spring past its rest
 * point, and an easing that crosses 1 would scale a control past rest size.
 */
function assertClamped(x, duration) {
  let previous = 0;
  for (let i = 1; i <= 1000; i += 1) {
    const value = x((i / 1000) * duration);
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
  const x = solve(constants);
  const duration = settleTime(x);
  assertClamped(x, duration);
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
