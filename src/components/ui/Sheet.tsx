import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/hooks/useTheme';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { IconButton } from '@/components/ui/IconButton';
import { duration } from '@/theme/motion';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_SHEET_FRACTION = 0.86;
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.25;
const SHEET_SPRING = { duration: 300, dampingRatio: 0.8, overshootClamping: true };
const PROJECTION_DECELERATION = 0.998;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  dismissable?: boolean;
}

export function Sheet({ visible, onClose, title, children, dismissable = true }: SheetProps) {
  const { colors, typography, radii } = useTheme();
  const { footerBottom: bottomPadding } = useScreenInsets();
  const reduced = useReducedMotion();
  const maxSheetHeight = SCREEN_HEIGHT * MAX_SHEET_FRACTION;

  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const sheetHeight = Math.min(
    Math.max(measuredHeight ?? maxSheetHeight, MIN_SHEET_HEIGHT),
    maxSheetHeight
  );

  const sheetH = useSharedValue(sheetHeight);
  const offset = useSharedValue(sheetHeight);
  const isDismissing = useSharedValue(false);

  useEffect(() => {
    sheetH.value = sheetHeight;
    if (!visible) offset.value = sheetHeight;
  }, [sheetHeight, visible, offset, sheetH]);

  useEffect(() => {
    if (visible) {
      isDismissing.value = false;
      offset.value = reduced
        ? withTiming(0, { duration: duration.base })
        : withSpring(0, SHEET_SPRING);
    } else {
      if (!isDismissing.value) {
        offset.value = reduced
          ? withTiming(sheetH.value, { duration: duration.base })
          : withSpring(sheetH.value, SHEET_SPRING);
      }
    }
  }, [visible, reduced, offset, sheetH, isDismissing]);

  const animateDismiss = useCallback((velocity = 0) => {
    'worklet';
    if (isDismissing.value) return;
    isDismissing.value = true;
    const completeDismiss = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onClose);
    };
    offset.value = reduced
      ? withTiming(sheetH.value, { duration: duration.base }, completeDismiss)
      : withSpring(
          sheetH.value,
          { ...SHEET_SPRING, velocity },
          completeDismiss
        );
  }, [onClose, offset, isDismissing, sheetH, reduced]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissable)
        .activeOffsetY([-10, 10])
        .onChange((e) => {
          if (isDismissing.value) return;
          offset.value = Math.max(0, Math.min(sheetH.value, offset.value + e.changeY));
        })
        .onEnd((e) => {
          if (isDismissing.value) return;
          const projectedOffset =
            offset.value +
            (e.velocityY / 1000 * PROJECTION_DECELERATION) / (1 - PROJECTION_DECELERATION);
          if (projectedOffset > sheetH.value * 0.4) {
            animateDismiss(e.velocityY);
          } else if (reduced) {
            offset.value = withTiming(0, { duration: duration.base });
          } else {
            offset.value = withSpring(0, {
              ...SHEET_SPRING,
              velocity: e.velocityY,
            });
          }
        }),
    [animateDismiss, dismissable, isDismissing, offset, reduced, sheetH]
  );

  const backdropTap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(dismissable)
        .onEnd(() => {
          if (isDismissing.value) return;
          animateDismiss();
        }),
    [animateDismiss, dismissable, isDismissing]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      offset.value,
      [0, sheetH.value],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  const handleArea = (
    <View style={styles.handleArea}>
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      <View style={styles.titleRow}>
        <Text style={[typography.screenTitle, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        {dismissable ? (
          <IconButton name="close" onPress={onClose} accessibilityLabel="Close" />
        ) : null}
      </View>
    </View>
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <GestureDetector gesture={backdropTap}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </GestureDetector>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radii.card,
            borderTopRightRadius: radii.card,
            height: sheetHeight,
            paddingBottom: bottomPadding,
          },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          {handleArea}
        </GestureDetector>
        <View style={styles.content}>{children}</View>
      </Animated.View>

      {/* Off-screen clone to measure natural content height */}
      <View
        pointerEvents="none"
        style={[styles.measure, { paddingBottom: bottomPadding }]}
        onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
      >
        {handleArea}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
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

export function SheetBody({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

export function SheetScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flexShrink: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  measure: {
    position: 'absolute',
    top: 0,
    left: -10000,
    width: SCREEN_WIDTH,
    opacity: 0,
  },
  handleArea: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingBottom: 8,
  },
  content: {
    flex: 1,
  },
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
