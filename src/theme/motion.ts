/**
 * Motion tokens. Everything animated in Melo pulls its duration from here so the
 * app feels like one surface.
 *
 * Reduce Motion is a real design rule here, not a safety net: when the user asks
 * for less motion we do not merely shorten an animation, we swap transforms for
 * plain fades. `useReducedMotion` is how a component discovers that, and
 * `springConfig` / `timingConfig` are always built with `ReduceMotion.System` so
 * an animation that is still run collapses to its end value.
 */

import { ReduceMotion } from 'react-native-reanimated';

export const duration = {
  /** Press feedback, colour swaps. */
  fast: 150,
  /** Expansion, selection, cross-fades. */
  base: 250,
  /** Entrance and exit. */
  slow: 400,
  /** The copy-button dot burst, and the long mascot loop. */
  burst: 800,
} as const;

export const spring = {
  damping: 18,
  stiffness: 220,
} as const;

export const springConfig = {
  damping: spring.damping,
  stiffness: spring.stiffness,
  mass: 1,
  reduceMotion: ReduceMotion.System,
} as const;

/** Same contract for timing animations, so every duration respects the setting. */
export function timingConfig(ms: number) {
  return { duration: ms, reduceMotion: ReduceMotion.System };
}

/** Press feedback. Spec: 0.95 to 0.97, on a spring. */
export const pressScale = 0.96;

/** Arrival and send entrance. */
export const entrance = {
  /** Friend messages slide up this far. */
  rise: 10,
  /** And scale in from here. */
  from: 0.95,
} as const;

/** The expanded "Original" panel tilts by this much while it is open. */
export const revealTilt = -1;

/** Message bubbles lean by this many degrees, alternating side to side. */
export const bubbleTilt = 1.5;
