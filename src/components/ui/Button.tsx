/**
 * The one button in Melo. A pill, 54pt tall, that presses down and fires a light
 * haptic. Everything about it is a token, so a screen cannot get the height,
 * radius, or disabled treatment wrong.
 */
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { Icon, type IconName } from '@/components/ui/Icon';

export type ButtonVariant = 'primary' | 'surface' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: IconName;
  rightIcon?: IconName;
  /** 54pt in the onboarding flow and on Connect. */
  size?: 'primary' | 'compact';
  /**
   * Defaults to true. Set false when the haptic belongs to the *outcome* rather
   * than the press — Connect buzzes on success, not on every attempt, so a
   * failure feels like a failure.
   */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  rightIcon,
  size = 'primary',
  haptic = true,
  style,
  labelStyle,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const { colors, typography, radii, sizes } = useTheme();
  const inert = disabled || loading;
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ haptic });

  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: 'transparent' },
    surface: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
  }[variant];

  const minHeight = size === 'compact' ? 44 : sizes.primaryButton;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={inert ? undefined : onPressIn}
      onPressOut={inert ? undefined : onPressOut}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: loading }}
      testID={testID}
      style={[
        {
          minHeight,
          borderRadius: radii.pill,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'surface' ? 1 : 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          opacity: inert ? 0.45 : 1,
        },
        pressStyle,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator color={palette.fg} />
          {loadingLabel ? (
            <Text style={[typography.bodyStrong, { color: palette.fg }, labelStyle]} numberOfLines={1}>
              {loadingLabel}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={20} color={palette.fg} strokeWidth={2.4} /> : null}
          <Text style={[typography.bodyStrong, { color: palette.fg }, labelStyle]} numberOfLines={1}>
            {label}
          </Text>
          {rightIcon ? <Icon name={rightIcon} size={20} color={palette.fg} strokeWidth={2.4} /> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
