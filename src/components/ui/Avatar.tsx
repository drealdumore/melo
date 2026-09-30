/**
 * Avatars are initials, not photos and not the logo — Melo has three users and
 * no image upload, so a letter is the honest representation.
 *
 * The presence ring is the interesting part: a solid `success` ring while the
 * friend is in this chat, a dashed muted ring while they are in the app
 * somewhere else, and nothing at all while they are away.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { PresenceState } from '@/types/models';

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

  const ring = useSharedValue(animateRing && online ? 0 : 1);

  useEffect(() => {
    if (!animateRing) return;
    ring.value = online
      ? reduced
        ? withTiming(1, { duration: 250 })
        : withSpring(1, { damping: 18, stiffness: 180 })
      : withTiming(1, { duration: 120 });
  }, [online, animateRing, reduced, ring]);

  // Under Reduce Motion the ring fades in at a fixed size; a ring that grows
  // outward is exactly the kind of movement the setting is meant to remove.
  const ringStyle = useAnimatedStyle(() =>
    reduced ? { opacity: ring.value } : { opacity: ring.value, transform: [{ scale: 0.7 + ring.value * 0.3 }] }
  );

  const label = [name, online ? 'online' : 'offline'].join(', ');

  return (
    <View
      style={[{ width: size + RING_WIDTH * 2, height: size + RING_WIDTH * 2 }, styles.center]}
      accessibilityLabel={label}
      testID={testID}
    >
      {online ? (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size + RING_WIDTH * 2,
              height: size + RING_WIDTH * 2,
              borderRadius: (size + RING_WIDTH * 2) / 2,
              // "Elsewhere" is deliberately quieter than "here now".
              borderColor: idle ? colors.textMuted : colors.success,
            },
            idle ? styles.ringDashed : null,
            ringStyle,
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
        <Text
          style={[
            typography.bodyStrong,
            { color: isDark ? colors.textPrimary : colors.accent, fontSize: size * 0.38 },
          ]}
        >
          {initialsOf(name)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: RING_WIDTH },
  ringDashed: { borderStyle: 'dashed', opacity: 0.55 },
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
