/**
 * One language option in the onboarding picker and profile settings.
 * Styled as a continuous-corner card with flag badge and check indicator.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { Icon } from '@/components/ui/Icon';
import type { Language } from '@/constants/languages';

export interface LanguageRowProps {
  language: Language;
  selected: boolean;
  onPress: () => void;
  showEnglishName?: boolean;
}

export function LanguageRow({
  language,
  selected,
  onPress,
  showEnglishName = true,
}: LanguageRowProps) {
  const { colors, typography, isDark } = useTheme();
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ scale: 0.98 });

  const cardBg = selected
    ? isDark
      ? 'rgba(255, 138, 43, 0.10)'
      : 'rgba(255, 138, 43, 0.08)'
    : isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : colors.surface;

  const borderColor = selected
    ? colors.accent
    : isDark
    ? 'rgba(255, 255, 255, 0.10)'
    : colors.border;

  const flagBadgeBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F2EFEA';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${language.name}, ${language.nativeName}`}
      testID={`language-${language.code}`}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderWidth: selected ? 1 : 0.5,
          elevation: selected ? 3 : 0,
        },
        pressStyle,
      ]}
    >
      <View style={[styles.flagBadge, { backgroundColor: flagBadgeBg }]}>
        <Text
          style={styles.flag}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {language.flag}
        </Text>
      </View>

      <View style={styles.labels}>
        <Text
          numberOfLines={1}
          style={[
            typography.bodyStrong,
            styles.nativeName,
            { color: colors.textPrimary },
            language.rtl ? styles.rtl : null,
          ]}
        >
          {language.nativeName}
        </Text>
        {showEnglishName && language.nativeName !== language.name ? (
          <Text
            numberOfLines={1}
            style={[typography.caption, { color: colors.textMuted }]}
          >
            {language.name}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.checkCircle,
          {
            backgroundColor: selected ? colors.accent : 'transparent',
            borderColor: selected
              ? colors.accent
              : isDark
              ? 'rgba(255, 255, 255, 0.25)'
              : 'rgba(0, 0, 0, 0.18)',
          },
        ]}
      >
        {selected ? (
          <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
    borderRadius: 20,
    borderCurve: 'continuous',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  flagBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 22 },
  labels: { flex: 1, gap: 2 },
  nativeName: { fontSize: 16, letterSpacing: -0.2 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
