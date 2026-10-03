
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { avatarSource, type AvatarKey } from '@/constants/avatars';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { PresenceState } from '@/types/models';
import { duration } from '@/theme/motion';

/** `Ana` → `A`, `Ana María` → `AM`, `á` uppercases correctly. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0] ?? '')[0] ?? '';
  if (parts.length === 1) return first.toLocaleUpperCase();
  const second = Array.from(parts[parts.length - 1] ?? '')[0] ?? '';
  return (first + second).toLocaleUpperCase();
}

export interface AvatarProps {
  name: string;
  /** Slug from `profiles.avatar_key`. Unknown or absent falls back to initials. */
  avatarKey?: AvatarKey | string | null;
  size?: number;
  presence?: PresenceState;
  /** Dashed ring instead of a solid one: in the app, but not here. */
  idle?: boolean;
  /** Animate the ring in when presence turns online. */
  animateRing?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const RING_WIDTH = 3;

export function Avatar({
  name,
  avatarKey,
  size = 46,
  presence = 'offline',
  idle = false,
  animateRing = false,
  style,
  testID,
}: AvatarProps) {
  const { colors, typography, isDark } = useTheme();
  const reduced = useReducedMotion();
  const online = presence === 'online';

  const ring = useSharedValue(animateRing ? 0 : 1);
  const idleProgress = useSharedValue(idle ? 1 : 0);
  const source = avatarSource(avatarKey);

  useEffect(() => {
    cancelAnimation(ring);
    if (!animateRing) {
      ring.value = 1;
      return;
    }

    if (online) {
      ring.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, {
          duration: reduced ? duration.base : duration.slow,
          easing: Easing.out(Easing.cubic),
        })
      );
      return;
    }

    ring.value = withTiming(0, {
      duration: reduced ? duration.fast : duration.base,
      easing: Easing.out(Easing.quad),
    });
  }, [online, animateRing, reduced, ring]);

  useEffect(() => {
    if (!animateRing) {
      idleProgress.value = idle ? 1 : 0;
      return;
    }
    idleProgress.value = withTiming(idle ? 1 : 0, {
      duration: reduced ? duration.fast : duration.base,
      easing: Easing.inOut(Easing.quad),
    });
  }, [animateRing, idle, idleProgress, reduced]);

  // Under Reduce Motion the ring fades in at a fixed size; a ring that grows
  // outward is exactly the kind of movement the setting is meant to remove.
  const solidRingStyle = useAnimatedStyle(() => {
    const visible = animateRing ? ring.value : online ? 1 : 0;
    const solid = animateRing ? 1 - idleProgress.value : idle ? 0 : 1;
    return {
      opacity: visible * solid,
      ...(reduced
        ? {}
        : { transform: [{ scale: 0.58 + (animateRing ? ring.value : 1) * 0.42 }] }),
    };
  });
  const dashedRingStyle = useAnimatedStyle(() => {
    const visible = animateRing ? ring.value : online ? 1 : 0;
    const dashed = animateRing ? idleProgress.value : idle ? 1 : 0;
    return {
      opacity: visible * dashed * 0.55,
      ...(reduced
        ? {}
        : { transform: [{ scale: 0.58 + (animateRing ? ring.value : 1) * 0.42 }] }),
    };
  });

  const label = [name, online ? 'online' : 'offline'].join(', ');

  return (
    <View
      style={[{ width: size + RING_WIDTH * 2, height: size + RING_WIDTH * 2 }, styles.center]}
      accessibilityLabel={label}
      testID={testID}
    >
      {animateRing || (online && idle) ? (
        <Animated.View
          style={[
            styles.dashedRing,
            {
              width: size + RING_WIDTH * 2,
              height: size + RING_WIDTH * 2,
            },
            dashedRingStyle,
          ]}
        >
          <Svg
            width={size + RING_WIDTH * 2}
            height={size + RING_WIDTH * 2}
            viewBox={`0 0 ${size + RING_WIDTH * 2} ${size + RING_WIDTH * 2}`}
          >
            <Circle
              cx={size + RING_WIDTH}
              cy={size + RING_WIDTH}
              r={size / 2 + RING_WIDTH / 2}
              fill="none"
              stroke={colors.textMuted}
              strokeWidth={RING_WIDTH}
              strokeDasharray={[4, 4]}
            />
          </Svg>
        </Animated.View>
      ) : null}
      {animateRing || (online && !idle) ? (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size + RING_WIDTH * 2,
              height: size + RING_WIDTH * 2,
              borderRadius: (size + RING_WIDTH * 2) / 2,
              borderColor: colors.success,
            },
            solidRingStyle,
          ]}
        />
      ) : null}

      <View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.accentTint,
            borderColor: colors.border,
          },
        ]}
      >
        {source ? (
          <Image
            source={source}
            style={{ width: size, height: size }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text
            style={[
              typography.bodyStrong,
              { color: isDark ? colors.textPrimary : colors.accent, fontSize: size * 0.38 },
            ]}
          >
            {initialsOf(name)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: RING_WIDTH },
  dashedRing: { position: 'absolute', opacity: 0.55 },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
