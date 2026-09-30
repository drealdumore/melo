/**
 * A small circular control with a dashed outline. Used for the copy affordance
 * next to a Melo ID, where a dashed edge is meant to read as "secondary" next
 * to the solid buttons.
 *
 * The copy itself is the caller's job — pass the icon that reflects the current
 * state, and this stays a dumb, reusable control.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { DashedBorder } from '@/components/ui/DashedBorder';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface DashedIconButtonProps {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  testID?: string;
}

export function DashedIconButton({
  name,
  onPress,
  accessibilityLabel,
  size = 36,
  iconSize = 18,
  testID,
}: DashedIconButtonProps) {
  const { colors, hitSize } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable();
  // The circle is only `size` wide, so the target grows with hitSlop — a
  // 44pt pressable inside a 36pt ring would overflow it.
  const slop = Math.max(0, Math.round((hitSize - size) / 2));

  return (
    <View style={styles.touch} pointerEvents="box-none">
      <DashedBorder radius={size / 2} color={colors.border} strokeWidth={1} style={{ width: size, height: size }}>
        <AnimatedPressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={slop}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          style={[styles.inner, style]}
        >
          <Icon name={name} size={iconSize} color={colors.textMuted} strokeWidth={2.2} />
        </AnimatedPressable>
      </DashedBorder>
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { alignItems: 'center', justifyContent: 'center' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
