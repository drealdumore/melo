/**
 * Segmented Onboarding Progress Bar.
 * Renders discrete pill segments (e.g. 3 segments for 3 steps), matching the exact header design
 * in the reference images.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  isDark,
}: {
  index: number;
  activeRatio: number;
  isDark: boolean;
}) {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();
  const filled = useSharedValue(0);

  // Target fill for this specific segment index (0, 1, 2...)
  const targetFill = Math.max(0, Math.min(1, activeRatio - index));

  useEffect(() => {
    filled.value = reduced
      ? withTiming(targetFill, { duration: 180 })
      : withSpring(targetFill, { damping: 22, stiffness: 180 });
  }, [targetFill, reduced, filled]);

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
