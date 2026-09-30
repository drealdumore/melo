/**
 * The mascot: a small speech-bubble character that idles its way through the
 * moments Melo has nothing to say. A rounded bubble with a tail, two eyes with
 * highlights, and a smile.
 *
 * Idle behaviour, per spec: a 3pt vertical bob every 3s, and a blink every 5s.
 * Both are skipped under Reduce Motion — a mascot that will not hold still is
 * exactly what the setting is asking us not to do.
 *
 * The bubble and the smile are SVG; the eyes are plain views, because a blinking
 * eye is just a circle changing height and that is far cheaper to animate than
 * driving props through the SVG bridge.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const VIEW_W = 58;
const VIEW_H = 54;

/** Eye centres in SVG user units, which map straight onto the rendered box. */
const EYE_LEFT = 22;
const EYE_RIGHT = 36;
const EYE_Y = 24;
const EYE_R = 5;
const HIGHLIGHT_OFFSET = 1.6;
const HIGHLIGHT_R = 1.8;

const BOB_PERIOD_MS = 3000;
const BLINK_PERIOD_MS = 5000;
const BLINK_MS = 130;
const BOB_TRAVEL = 3;

export interface MascotProps {
  /** Rendered width. Height follows the 58:54 ratio. */
  size?: number;
  /** Optional speech bubble beside the character. */
  message?: string;
}

export function Mascot({ size, message }: MascotProps) {
  const { colors, sizes, typography, radii } = useTheme();
  const reduced = useReducedMotion();

  const width = size ?? sizes.mascot.width;
  const height = (width * VIEW_H) / VIEW_W;
  const scale = width / VIEW_W;

  const bob = useSharedValue(0);
  const lid = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      bob.value = withTiming(0);
      lid.value = withTiming(0);
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

    lid.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BLINK_MS }),
        withTiming(0, { duration: BLINK_MS }),
        withTiming(0, { duration: BLINK_PERIOD_MS - BLINK_MS * 2 })
      ),
      -1,
      false
    );
  }, [reduced, bob, lid]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value }] }));

  const lidStyle = useAnimatedStyle(() => ({
    // 1 is open, 0 is a closed line.
    transform: [{ scaleY: 1 - lid.value * 0.88 }],
  }));

  const eye = (center: number) => (
    <Animated.View
      style={[
        styles.eye,
        {
          left: center * scale - EYE_R * scale,
          top: EYE_Y * scale - EYE_R * scale,
          width: EYE_R * 2 * scale,
          height: EYE_R * 2 * scale,
          borderRadius: EYE_R * scale,
          backgroundColor: colors.background,
        },
        lidStyle,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: (HIGHLIGHT_OFFSET + EYE_R * 0.28) * scale,
          top: (HIGHLIGHT_OFFSET + EYE_R * 0.28) * scale,
          width: HIGHLIGHT_R * 2 * scale,
          height: HIGHLIGHT_R * 2 * scale,
          borderRadius: HIGHLIGHT_R * scale,
          backgroundColor: colors.surface,
        }}
      />
    </Animated.View>
  );

  return (
    <View style={styles.row}>
      <Animated.View style={[{ width, height }, bobStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} accessibilityRole="image">
          <Path
            d="M14 4h30a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H24l-10 8 2.5-8H14A10 10 0 0 1 4 32V14A10 10 0 0 1 14 4Z"
            fill={colors.accent}
          />
          <Path
            d="M24 34.5c1.6 2 4 3 5 3s3.4-1 5-3"
            stroke={colors.background}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        {eye(EYE_LEFT)}
        {eye(EYE_RIGHT)}
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
  eye: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bubble: { flex: 1, paddingVertical: 10, paddingLeft: 14, paddingRight: 12 },
});
