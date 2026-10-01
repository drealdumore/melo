
import { useEffect } from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const rollyAsset = require('../../../assets/thinking_rolly.svg');

const BOB_PERIOD_MS = 3000;
const BOB_TRAVEL = 4;

export interface MascotProps {
  /** Rendered width and height. */
  size?: number;
  /** Optional speech bubble beside the character. */
  message?: string;
}

export function Mascot({ size, message }: MascotProps) {
  const { colors, sizes, typography, radii } = useTheme();
  const reduced = useReducedMotion();

  const width = size ?? sizes.mascot.width ?? 54;
  const height = width;

  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      bob.value = withTiming(0);
      return;
    }

    bob.value = withRepeat(
      withSequence(
        withTiming(BOB_TRAVEL, { duration: BOB_PERIOD_MS / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: BOB_PERIOD_MS / 2, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [reduced, bob]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value }],
  }));

  const source = Image.resolveAssetSource(rollyAsset);

  return (
    <View style={styles.row}>
      <Animated.View style={[{ width, height }, bobStyle]}>
        <Image
          source={source}
          style={{ width, height, resizeMode: 'contain' }}
          accessibilityRole="image"
          accessibilityLabel="Melo Mascot Rolly"
        />
      </Animated.View>

      {message ? (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.speech,
              borderBottomLeftRadius: radii.speechTail,
            },
          ]}
        >
          <Text style={[typography.body, { color: colors.textMuted }]}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bubble: { flex: 1, paddingVertical: 10, paddingLeft: 14, paddingRight: 12 },
});
