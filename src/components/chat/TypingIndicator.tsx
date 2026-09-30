/**
 * A small bubble with three dots that breathe, so the list does not jump while
 * somebody is writing.
 *
 * The bubble itself grows after 700ms: a person who has been typing for a moment
 * is more likely to have something to say, and a wider bubble is the difference
 * between "one word" and "an actual reply". Under Reduce Motion the bubble stays
 * the same size and only the dots change opacity — no growth, no bobbing.
 */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { timingConfig } from '@/theme/motion';

const CYCLE = 600;
const GROW_AFTER_MS = 700;
const GROW_PADDING = 18;

export function TypingIndicator() {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();

  const grow = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      grow.value = withTiming(0);
      return;
    }
    grow.value = withDelay(GROW_AFTER_MS, withTiming(1, { duration: 220 }));
  }, [reduced, grow]);

  const bubbleStyle = useAnimatedStyle(() =>
    // Padding rather than width, so the dots themselves are never squashed.
    reduced ? {} : { paddingRight: 14 + grow.value * GROW_PADDING }
  );

  return (
    <Animated.View
      style={[
        styles.bubble,
        { backgroundColor: colors.surface, borderRadius: radii.speech },
        bubbleStyle,
      ]}
      accessibilityLabel="Typing"
      accessibilityRole="text"
      testID="typing-indicator"
    >
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} color={colors.textMuted} reduced={reduced} />
      ))}
    </Animated.View>
  );
}

function Dot({ index, color, reduced }: { index: number; color: string; reduced: boolean }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1, timingConfig(CYCLE / 2)),
          withTiming(0, timingConfig(CYCLE / 2))
        ),
        -1,
        false
      )
    );
  }, [index, lift]);

  const style = useAnimatedStyle(() =>
    reduced
      ? { opacity: 0.45 + lift.value * 0.55 }
      : { transform: [{ translateY: -3 * lift.value }], opacity: 0.45 + lift.value * 0.55 }
  );

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingLeft: 14,
    paddingVertical: 12,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
