/**
 * The circular icon button used in every header: a `surface` fill, a hairline
 * border, and a back arrow or glyph. 38pt, with the touch target padded out to
 * 44pt so it is comfortable without changing how it looks.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface IconButtonProps {
  name: IconName;
  onPress: () => void;
  /** Required by spec: every icon button names itself. */
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  variant?: 'surface' | 'accent' | 'plain';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size,
  iconSize = 22,
  variant = 'surface',
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const { colors, sizes } = useTheme();
  // 38pt visual, padded to 44pt by the wrapper below.
  const diameter = size ?? sizes.headerButton;
  const { onPressIn, onPressOut, style: pressStyle } = usePressable();

  const palette = {
    surface: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
    accent: { bg: colors.accent, fg: colors.onAccent, border: 'transparent' },
    plain: { bg: 'transparent', fg: colors.textPrimary, border: 'transparent' },
  }[variant];

  return (
    <View style={styles.touch} pointerEvents="box-none">
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        style={[
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderWidth: variant === 'surface' ? StyleSheet.hairlineWidth : 0,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.4 : 1,
          },
          pressStyle,
          style,
        ]}
      >
        <Icon name={name} size={iconSize} color={palette.fg} strokeWidth={2.2} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pads the 38pt circle out to a 44pt target without changing its size.
  touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
