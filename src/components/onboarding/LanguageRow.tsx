/**
 * One language in the onboarding picker. Styled to match the pill option cards in the reference images:
 * Rounded card container (20pt radius), flag icon, native + english label, radio check indicator on right.
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

export function LanguageRow({ language, selected, onPress, showEnglishName = true }: LanguageRowProps) {
  const { colors, typography, isDark } = useTheme();
  const { onPressIn, onPressOut, style: pressStyle } = usePressable();

  const cardBg = selected
    ? isDark
      ? 'rgba(255, 125, 99, 0.14)'
      : 'rgba(255, 106, 77, 0.08)'
    : colors.surface;

  const borderColor = selected
    ? colors.accent
    : isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.04)';

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
          backgroundColor: cardBg,
          borderColor,
          borderWidth: selected ? 2 : 1,
        },
        pressStyle,
      ]}
    >
      <View style={[styles.flagBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2EFEA' }]}>
        <Text style={styles.flag} accessibilityElementsHidden importantForAccessibility="no">
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
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
            {language.name}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.checkCircle,
          {
            backgroundColor: selected ? colors.accent : 'transparent',
            borderColor: selected ? colors.accent : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
          },
        ]}
      >
        {selected ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
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
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  flagBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 22 },
  labels: { flex: 1, gap: 2 },
  nativeName: { fontSize: 16 },
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
