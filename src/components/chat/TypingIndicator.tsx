/**
 * The typing loader: a message bubble holding three dots that fade in sequence.
 *
 * Ported from the reference prototype, where the bubble is a plain `.b` with the
 * typing class on it — same surface, same 22/22/22/8 silhouette, same muted dots
 * — so it reads as the tail end of the conversation rather than a spinner bolted
 * onto it. The dots only fade; they never travel, because a dot that moves draws
 * the eye to the animation instead of to the conversation. Under Reduce Motion
 * the loop stops entirely and the dots sit at full strength.
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
const STEP = 200;
const DIM = 0.4;

export function TypingIndicator() {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.bubble,
          borderBottomLeftRadius: radii.bubbleTail,
        },
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
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      fade.value = withTiming(1);
      return;
    }
    fade.value = withDelay(
      index * STEP,
      withRepeat(
        withSequence(withTiming(DIM, timingConfig(CYCLE)), withTiming(1, timingConfig(CYCLE))),
        -1,
        false
      )
    );
  }, [index, reduced, fade]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
