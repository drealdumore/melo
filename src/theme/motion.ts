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

import { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

const SCREEN_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Consistent top-to-bottom entrance for screen content. */
export function screenEnter(delay = 0) {
  return FadeInDown.duration(220).delay(delay).easing(SCREEN_EASE_OUT);
}

/** Fade-only counterpart for screen content under Reduce Motion. */
export function screenFadeEnter(delay = 0) {
  return FadeIn.duration(180).delay(delay).easing(SCREEN_EASE_OUT);
}

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
