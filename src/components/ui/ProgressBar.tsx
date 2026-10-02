/**
 * Segmented Onboarding Progress Bar.
 * Renders discrete pill segments matching the onboarding step count.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface ProgressBarProps {
  /** 0 to 1 ratio or step / totalSteps */
  progress: number;
  totalSteps?: number;
}

function SegmentItem({
  index,
  activeRatio,
  activeIndex,
  isDark,
}: {
  index: number;
  activeRatio: number;
  activeIndex: number;
  isDark: boolean;
}) {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();
  const filled = useSharedValue(index < activeIndex ? 1 : 0);

  const targetFill = Math.max(0, Math.min(1, activeRatio - index));

  useEffect(() => {
    if (index < activeIndex) {
      filled.value = 1;
      return;
    }
    if (index > activeIndex) {
      filled.value = 0;
      return;
    }

    filled.value = withTiming(targetFill, {
      duration: reduced ? 140 : 180,
      easing: Easing.out(Easing.quad),
    });
  }, [activeIndex, filled, index, reduced, targetFill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${filled.value * 100}%`,
  }));

  const activeColor = isDark ? '#FFFFFF' : colors.textPrimary;
  const trackColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View style={[styles.segmentTrack, { backgroundColor: trackColor, borderRadius: radii.pill }]}>
      <Animated.View
        style={[
          styles.segmentFill,
          { backgroundColor: activeColor, borderRadius: radii.pill },
          fillStyle,
        ]}
      />
    </View>
  );
}

export function ProgressBar({ progress, totalSteps = 3 }: ProgressBarProps) {
  const { isDark } = useTheme();
  const activeRatio = progress * totalSteps;
  const activeIndex = Math.min(totalSteps - 1, Math.max(0, Math.ceil(activeRatio) - 1));

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      {Array.from({ length: totalSteps }).map((_, index) => (
        <SegmentItem
          key={index}
          index={index}
          activeRatio={activeRatio}
          activeIndex={activeIndex}
          isDark={isDark}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 16,
  },
  segmentTrack: {
    flex: 1,
    height: 4.5,
    overflow: 'hidden',
  },
  segmentFill: {
    height: 4.5,
  },
});
