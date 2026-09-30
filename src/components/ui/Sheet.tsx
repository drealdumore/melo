/**
 * A bottom sheet built on `@gorhom/bottom-sheet`.
 *
 * `BottomSheetModal` rather than the inline `BottomSheet`, because it renders
 * through a portal and therefore keeps the native modal semantics the old
 * `Modal` version had: it sits above the navigator, it owns the hardware back
 * button, and it does not inherit the calling screen's transform.
 *
 * The imperative `present()` / `dismiss()` pair is hidden behind the old
 * declarative `visible` prop, so nothing outside this file has to know the
 * library is here.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { ReduceMotion } from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { useTheme } from '@/hooks/useTheme';
import { IconButton } from '@/components/ui/IconButton';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Disables backdrop tap and drag-to-dismiss, e.g. while something is saving. */
  dismissable?: boolean;
}

/** Matches the `maxHeight: '86%'` the Modal version used. */
const MAX_SHEET_FRACTION = 0.86;
/** Rough height of the pinned title row, so the body scrolls under the cap. */
const HEADER_ALLOWANCE = 72;

export function Sheet({ visible, onClose, title, children, dismissable = true }: SheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { colors, typography, spacing, radii } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = Math.round(windowHeight * MAX_SHEET_FRACTION);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  /**
   * Fires for a backdrop tap, a drag-down, and a programmatic `dismiss()` alike.
   * The `visible` check is what stops a parent-driven close from calling
   * `onClose` a second time: by the time the dismissal lands, `visible` is
   * already false, so only a genuine user dismissal propagates.
   */
  const handleDismiss = useCallback(() => {
    if (visible) onClose();
  }, [visible, onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        // Flat dim, matching the old `rgba(0,0,0,0.4)`. No gradient.
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={dismissable ? 'close' : 'none'}
        opacity={0.4}
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]}
      />
    ),
    [dismissable]
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      // Content-sized, capped the way the Modal version capped it. `snapPoints`
      // would be the other way to size this, but it would mean every call site
      // has to know its own height. v5 dropped `maxDynamicSize`, so the cap
      // lives on the inner sheet's `style` instead.
      enableDynamicSizing
      enablePanDownToClose={dismissable}
      onDismiss={handleDismiss}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.card,
        borderTopRightRadius: radii.card,
      }}
      handleIndicatorStyle={styles.noHandle}
      // Reduce Motion trades the automatic travel for a plain appear. The pan
      // gesture stays enabled: that is direct manipulation the user is driving,
      // not autonomous motion, and it is the only dismiss affordance a screen
      // reader user needs here.
      overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.System}
      backdropComponent={renderBackdrop}
    >
      <BottomSheet
        // No `flex: 1`: with dynamic sizing the sheet is content-height, and
        // flexing it would defeat the measurement.
        style={{ maxHeight: maxSheetHeight, paddingBottom: Math.max(insets.bottom, spacing.md) }}
      >
        <View style={styles.header}>
          <Text
            style={[typography.screenTitle, { color: colors.textPrimary, flex: 1 }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {dismissable ? (
            <IconButton name="close" onPress={onClose} accessibilityLabel="Close" />
          ) : null}
        </View>
        {children}
      </BottomSheet>
    </BottomSheetModal>
  );
}

export function SheetRow({
  label,
  detail,
  selected,
  onPress,
  multiline,
  rtl,
}: {
  label: string;
  detail?: string;
  selected?: boolean;
  onPress?: () => void;
  multiline?: boolean;
  rtl?: boolean;
}) {
  const { colors, typography, spacing, hitSize } = useTheme();
  const { onPressIn, onPressOut, style: pressStyle } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPress ? onPressIn : undefined}
      onPressOut={onPress ? onPressOut : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.row,
        {
          minHeight: hitSize + 8,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: selected ? colors.accentTint : 'transparent',
        },
        pressStyle,
      ]}
    >
      <View style={styles.rowText}>
        <Text
          style={[typography.body, { color: colors.textPrimary }, rtl ? styles.rtl : null]}
          numberOfLines={multiline ? 2 : 1}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <View style={[styles.radio, { borderColor: colors.accent }]}>
          <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

/** Non-scrolling variant, for the short profile sheet. */
export function SheetBody({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

export function SheetScroll({ children }: { children: React.ReactNode }) {
  const { height: windowHeight } = useWindowDimensions();

  // A dynamically-sized sheet measures a ScrollView's *full* content, so without
  // a cap the sheet would grow to fit every row and never actually scroll. This
  // leaves room for the header inside the sheet's own 86% ceiling.
  const maxHeight = useMemo(
    () => Math.round(windowHeight * MAX_SHEET_FRACTION) - HEADER_ALLOWANCE,
    [windowHeight]
  );

  return (
    // The library's scroll view, not RN's: it hands the sheet enough context to
    // arbitrate between scrolling the list and dragging the sheet down. A plain
    // ScrollView makes the two gestures fight.
    <BottomSheetScrollView
      style={[styles.scroll, { maxHeight }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  noHandle: { width: 0, height: 0, opacity: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
    paddingBottom: 8,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
