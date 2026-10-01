/**
 * Press feedback, in one place.
 *
 * Spec: every pressable scales to ~0.96 on a spring, and primary actions get a
 * light haptic. Under Reduce Motion the scale is dropped and the press becomes a
 * plain opacity dip — a fade instead of a transform, which is the whole point of
 * the setting.
 *
 * Returns props to spread onto an `AnimatedPressable`, so there is no wrapper
 * view to add to a layout that is already dense.
 */
import { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { pressScale, springConfig } from '@/theme/motion';

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Plain fade timings, used whenever a spring would be a transform instead. */
const FADE_IN = { duration: 110, easing: Easing.out(Easing.quad) } as const;
const FADE_OUT = { duration: 180, easing: Easing.out(Easing.quad) } as const;

export interface PressableFeedback {
  onPressIn: () => void;
  onPressOut: () => void;
  /**
   * Spread onto the pressable. Holds the transform, or the fade.
   *
   * Typed loosely on purpose: Reanimated's animated styles are a superset of
   * `ViewStyle` but TS cannot see that through the union we build below, and
   * every consumer spreads this straight into a `style` array.
   */
  style: AnimatedStyle<ViewStyle> | StyleProp<ViewStyle>;
  /** Shared value 0 -> 1 tracking the press progress for child micro-interactions. */
  progress: SharedValue<number>;
}

export interface PressableOptions {
  /** How far to shrink. Defaults to the global 0.96. */
  scale?: number;
  /** Fire a light haptic on press in. Use for primary actions only. */
  haptic?: boolean;
  /** Opacity while held, used in place of the scale under Reduce Motion. */
  pressedOpacity?: number;
}

export function usePressable({
  scale = pressScale,
  haptic = false,
  pressedOpacity = 0.75,
}: PressableOptions = {}): PressableFeedback {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  const onPressIn = useCallback(() => {
    if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Reduced Motion drives the opacity with a timing, not a spring: a spring
    // under `ReduceMotion.System` would jump straight to its end value, which is
    // a snap rather than the fade the setting is asking for.
    progress.value = reduced ? withTiming(1, FADE_IN) : withSpring(1, springConfig);
  }, [haptic, progress, reduced]);

  const onPressOut = useCallback(() => {
    progress.value = reduced ? withTiming(0, FADE_OUT) : withSpring(0, springConfig);
  }, [progress, reduced]);

  const style = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - progress.value * (1 - pressedOpacity) }
      : { transform: [{ scale: 1 - progress.value * (1 - scale) }] }
  );

  return { onPressIn, onPressOut, style, progress };
}

/** Convenience: the same three props, typed for spreading into a pressable. */
export type AnimatedPressableProps = PressableProps & { style?: PressableProps['style'] };
