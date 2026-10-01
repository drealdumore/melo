/**
 * The copy affordance: tapping copies the Melo ID and swaps the icon from
 * copy → check with a crossfade, then back after a hold.
 *
 * Icon swap: 250ms ease-in-out (transitions-polish: icon swap token).
 * Check appear: 500ms with a slight bounce (success moment token).
 */
import { useCallback } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { Icon } from '@/components/ui/Icon';

const DOT_COUNT = 8;
const BURST_RADIUS = 26;
const BURST_HOLD_MS = 900;

// Icon swap: 250ms ease-in-out
const SWAP_DURATION = 250;
const SWAP_EASING = Easing.inOut(Easing.quad);
// Check bounce: cubic-bezier(0.34, 1.36, 0.64, 1) ≈ bounce open
const CHECK_SPRING = { damping: 10, stiffness: 180, mass: 0.8 };

export interface CopyButtonProps {
  meloId: string;
  /** Optional reaction to a successful copy (e.g. surfacing a "copied" toast). */
  onCopy?: () => void;
  style?: StyleProp<ViewStyle>;
  /** compact = small icon button (sheet), default = full-width area (ID card) */
  compact?: boolean;
  testID?: string;
}

export function CopyButton({ meloId, onCopy, style, compact = false, testID }: CopyButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  // 0 = copy icon fully visible, 1 = check icon fully visible
  const progress = useSharedValue(0);
  const burst = useSharedValue(0);
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ haptic: false });

  const handlePress = useCallback(async () => {
    if (!meloId) return;
    await Clipboard.setStringAsync(meloId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCopy?.();

    // Crossfade copy → check, hold, crossfade back
    progress.value = withSequence(
      reduced
        ? withTiming(1, { duration: SWAP_DURATION, easing: SWAP_EASING })
        : withSpring(1, CHECK_SPRING),
      withDelay(BURST_HOLD_MS, withTiming(0, { duration: SWAP_DURATION, easing: SWAP_EASING }))
    );

    burst.value = withSequence(
      reduced
        ? withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) })
        : withSpring(1, { damping: 12, stiffness: 200 }),
      withDelay(BURST_HOLD_MS, withTiming(0, { duration: 260 }))
    );
  }, [burst, progress, meloId, onCopy, reduced]);

  // Copy icon fades out as progress goes 0→1
  const copyStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: reduced ? 1 : 1 - progress.value * 0.15 }],
    position: 'absolute',
  }));

  // Check icon fades in as progress goes 0→1
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduced ? 1 : 0.7 + progress.value * 0.3 }],
    position: 'absolute',
  }));

  const iconSize = compact ? 20 : 22;

  return (
    <AnimatedPressable
      onPress={() => void handlePress()}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Copy Melo ID, ${meloId}`}
      testID={testID}
      style={[compact ? styles.compactArea : styles.area, pressStyle, style]}
    >
      {!compact && (
        <View pointerEvents="none" style={styles.burst}>
          {Array.from({ length: DOT_COUNT }, (_, index) => (
            <BurstDot
              key={index}
              angle={(360 / DOT_COUNT) * index}
              progress={burst}
              reduced={reduced}
              color={colors.accent}
            />
          ))}
        </View>
      )}

      <View style={styles.iconWrap}>
        <Animated.View style={copyStyle}>
          <Icon name="copy" size={iconSize} color={colors.textMuted} strokeWidth={1.5} />
        </Animated.View>
        <Animated.View style={checkStyle}>
          <Icon name="check" size={iconSize} color={colors.success} strokeWidth={1.5} />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

function BurstDot({
  angle,
  progress,
  reduced,
  color,
}: {
  angle: number;
  progress: SharedValue<number>;
  reduced: boolean;
  color: string;
}) {
  const radians = (angle * Math.PI) / 180;

  const style = useAnimatedStyle(() => {
    const travel = reduced ? BURST_RADIUS * 0.6 : progress.value * BURST_RADIUS;
    const fade = progress.value < 0.2 ? 1 : Math.max(0, 1 - (progress.value - 0.2) / 0.8);
    return {
      opacity: fade,
      transform: [
        { translateX: Math.cos(radians) * travel },
        { translateY: Math.sin(radians) * travel },
        ...(reduced ? [] : [{ scale: 0.6 + progress.value * 0.8 }]),
      ],
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  area: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  compactArea: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, opacity: 0 },
});
