/**
 * The copy affordance in the Melo ID card: a full-width, full-height tap target
 * that confirms itself with a radial burst of accent dots and then a checkmark.
 * The whole area is the button, which is what makes it comfortable to hit on a
 * phone without looking.
 */
import { useCallback, useState } from 'react';
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
/** How long the dots stay out before the checkmark settles in. */
const BURST_HOLD_MS = 900;

export interface CopyButtonProps {
  /** The Melo ID being copied. */
  meloId: string;
  /** Fires the share sheet alongside the copy, if the caller wants both. */
  onCopy: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CopyButton({ meloId, onCopy, style }: CopyButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const burst = useSharedValue(0);
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ haptic: false });

  const handlePress = useCallback(async () => {
    if (!meloId) return;
    await Clipboard.setStringAsync(meloId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCopy();
    setCopied(true);
    // One chain, so the outbound animation is not cancelled by the return trip.
    burst.value = withSequence(
      reduced
        ? withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) })
        : withSpring(1, { damping: 12, stiffness: 200 }),
      withDelay(BURST_HOLD_MS, withTiming(0, { duration: 260 }))
    );
  }, [burst, meloId, onCopy, reduced]);

  // Reduced Motion: the icon breathes instead of popping, so the confirmation
  // still lands without anything being scaled.
  const iconStyle = useAnimatedStyle(() =>
    reduced ? { opacity: 0.55 + burst.value * 0.45 } : { transform: [{ scale: 1 + burst.value * 0.15 }] }
  );

  return (
    <AnimatedPressable
      onPress={() => void handlePress()}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Copy your Melo ID, ${meloId}`}
      style={[styles.area, pressStyle, style]}
    >
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

      <Animated.View style={iconStyle}>
        <Icon
          name={copied ? 'check' : 'copy'}
          size={22}
          color={copied ? colors.success : colors.textMuted}
          strokeWidth={2.2}
        />
      </Animated.View>
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
    // Under Reduce Motion the dots hold a fixed ring and only fade; no travel,
    // no scale.
    const travel = reduced ? BURST_RADIUS * 0.6 : progress.value * BURST_RADIUS;
    // Hold full opacity briefly, then fade out over the back half of the travel.
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
  burst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, opacity: 0 },
});
