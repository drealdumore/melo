/**
 * One message bubble.
 * Received messages show the translation with original always one tap away.
 */
import { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { isRtl } from '@/constants/languages';
import { springConfig, timingConfig } from '@/theme/motion';
import type { LocalMessage, SendState } from '@/types/models';
import { Icon } from '@/components/ui/Icon';

export interface MessageBubbleProps {
  message: LocalMessage;
  isMine: boolean;
  /** Only the last bubble of a run gets a timestamp. */
  isLastInGroup: boolean;
  /** True when this row appeared after the list settled; drives the entrance. */
  animateIn: boolean;
  /** The very last message you sent is the only one that gets a status line. */
  isLatestMine: boolean;
  onRetry: (message: LocalMessage) => void;
  onDelete: (message: LocalMessage) => void;
  onRetryTranslation: (message: LocalMessage) => void;
}

/** Vertical gap between bubbles inside a run. */
const RUN_GAP = 3;

function describe(message: LocalMessage, isMine: boolean, body: string): string {
  if (isMine) return `You said: ${body}`;
  if (message.translation_status === 'failed') {
    return `Couldn't translate that one. Original: ${message.original_text}`;
  }
  if (message.translation_status === 'skipped') {
    return body;
  }
  return `Translated: ${body}. Tap to see the original: ${message.original_text}`;
}

function MessageBubbleComponent({
  message,
  isMine,
  isLastInGroup,
  animateIn,
  isLatestMine,
  onRetry,
  onDelete,
  onRetryTranslation,
}: MessageBubbleProps) {
  const { colors, typography, radii, duration, isDark } = useTheme();
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [revealHeight, setRevealHeight] = useState(0);
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ scale: 0.98 });

  const canExpand =
    !isMine && message.translation_status === 'translated' && Boolean(message.translated_text);
  const hasFailed = !isMine && message.translation_status === 'failed';

  const bodyRtl = isRtl(isMine ? message.source_language : message.target_language);
  const originalRtl = isRtl(message.source_language);

  /* ------------------------------------------------------ enter animations */

  const enter = useSharedValue(animateIn ? 0 : 1);

  useEffect(() => {
    if (!animateIn) return;
    enter.set(
      withTiming(1, {
        ...timingConfig(duration.fast),
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      })
    );
  }, [animateIn, duration.fast, enter]);

  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.get() }));

  /* --------------------------------------------------------- reveal spring */

  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.set(
      reduced
        ? withTiming(expanded ? 1 : 0, timingConfig(duration.base))
        : withSpring(expanded ? 1 : 0, springConfig)
    );
  }, [expanded, reduced, duration.base, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    height: reveal.get() * revealHeight,
    opacity: reveal.get(),
  }));

  const toggle = useCallback(() => {
    if (!canExpand) return;
    setExpanded((value) => !value);
  }, [canExpand]);

  const body = isMine ? message.original_text : (message.translated_text ?? message.original_text);
  const textColor = isMine ? colors.onAccent : colors.textPrimary;

  return (
    <Animated.View
      style={[enterStyle, styles.wrapper, isMine ? styles.alignEnd : styles.alignStart]}
    >
      <AnimatedPressable
        onPress={toggle}
        onPressIn={canExpand ? onPressIn : undefined}
        onPressOut={canExpand ? onPressOut : undefined}
        disabled={!canExpand}
        accessibilityRole={canExpand ? 'button' : 'text'}
        accessibilityLabel={describe(message, isMine, body)}
        accessibilityHint={
          canExpand ? (expanded ? 'Hides the original message' : 'Shows the original message') : undefined
        }
        accessibilityState={canExpand ? { expanded } : undefined}
        testID={`bubble-${message.id}`}
        style={[
          styles.bubble,
          {
            backgroundColor: isMine
              ? colors.accent
              : isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : colors.surface,
            borderColor: isMine
              ? 'transparent'
              : isDark
              ? 'rgba(255, 255, 255, 0.10)'
              : colors.border,
            borderWidth: isMine ? 0 : 1,
            borderRadius: radii.bubble,
            borderBottomRightRadius: isMine ? radii.bubbleTail : radii.bubble,
            borderBottomLeftRadius: isMine ? radii.bubble : radii.bubbleTail,
            marginBottom: RUN_GAP,
          },
          canExpand ? pressStyle : null,
        ]}
      >
        <Text style={[typography.message, { color: textColor }, bodyRtl ? styles.rtl : null]}>
          {body}
        </Text>

        {canExpand ? (
          <View style={[styles.translationLabels, styles.caption]}>
            <Text style={[typography.caption, { color: isMine ? colors.onAccent : colors.info }]}>Translated</Text>
            <Text style={[typography.caption, { color: isMine ? colors.onAccent : colors.info }]}>·</Text>
            <Text style={[typography.caption, { color: isMine ? colors.onAccent : colors.info }]}>
              {expanded ? 'Hide original' : 'Original'}
            </Text>
          </View>
        ) : null}

        {canExpand ? (
          <Animated.View style={[styles.reveal, revealStyle]}>
            <Animated.View
              style={styles.revealInner}
              onLayout={(event) => setRevealHeight(event.nativeEvent.layout.height)}
            >
              <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border }]} />
              <Text style={[typography.label, { color: colors.info }]}>Original</Text>
              <Text
                style={[
                  typography.body,
                  styles.original,
                  { color: colors.textMuted },
                  originalRtl ? styles.rtl : null,
                ]}
              >
                {message.original_text}
              </Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </AnimatedPressable>

      {hasFailed ? (
        <View style={styles.failedRow}>
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.caption, styles.note, { color: colors.danger }]}
          >
            Couldn’t translate that one.
          </Text>
          <RetryChip
            label="Retry"
            accessibilityLabel="Retry translation"
            onPress={() => onRetryTranslation(message)}
            testID={`retry-translation-${message.id}`}
          />
        </View>
      ) : null}

      {isLastInGroup || isLatestMine ? (
        <View style={[styles.footer, isMine ? styles.footerEnd : styles.footerStart]}>
          <Text style={[typography.caption, styles.timeText, { color: colors.textMuted }]}>
            {formatClock(message.created_at)}
          </Text>
          {isLatestMine ? (
            <StatusTick state={message.sendState ?? 'sent'} message={message} onRetry={onRetry} onDelete={onDelete} />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function RetryChip({
  label,
  onPress,
  testID,
  accessibilityLabel = label,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors, typography, radii } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable({ scale: 0.94 });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={10}
      style={[
        styles.chip,
        { borderColor: colors.danger, borderRadius: radii.pill },
        style,
      ]}
    >
      <Text style={[typography.captionStrong, { color: colors.danger }]}>{label}</Text>
    </AnimatedPressable>
  );
}

function StatusTick({
  state,
  message,
  onRetry,
  onDelete,
}: {
  state: SendState;
  message: LocalMessage;
  onRetry: (message: LocalMessage) => void;
  onDelete: (message: LocalMessage) => void;
}) {
  const { colors, typography } = useTheme();

  if (state === 'failed') {
    return (
      <View style={styles.failedStatus} accessibilityLabel="Not sent">
        <Text style={[typography.caption, { color: colors.danger }]}>Not sent</Text>
        <RetryChip
          label="Retry"
          accessibilityLabel="Retry message"
          onPress={() => onRetry(message)}
          testID={`retry-${message.id}`}
        />
        <RetryChip
          label="Delete"
          accessibilityLabel="Delete unsent message"
          onPress={() => onDelete(message)}
          testID={`delete-${message.id}`}
        />
      </View>
    );
  }

  if (state === 'sending') {
    return (
      <View style={styles.tick} accessibilityLabel="Sending…">
        <Icon name="clock" size={14} color={colors.textMuted} />
      </View>
    );
  }

  if (message.read_at) {
    return (
      <View style={styles.tick} accessibilityLabel="Read">
        <Icon name="checkDouble" size={16} color={colors.info} />
      </View>
    );
  }

  if (message.delivered_at) {
    return (
      <View style={styles.tick} accessibilityLabel="Delivered">
        <Icon name="checkDouble" size={16} color={colors.info} />
      </View>
    );
  }

  return (
    <View style={styles.tick} accessibilityLabel="Sent">
      <Icon name="check" size={15} color={colors.textMuted} />
    </View>
  );
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  wrapper: { maxWidth: '82%' },
  alignEnd: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  alignStart: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  caption: { marginTop: 4, alignSelf: 'flex-start' },
  translationLabels: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  note: { marginTop: 4 },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  failedStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderCurve: 'continuous' },
  reveal: { overflow: 'hidden' },
  revealInner: { position: 'absolute', left: 0, right: 0, top: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 10, marginBottom: 8 },
  original: { marginTop: 4 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 2 },
  timeText: { fontVariant: ['tabular-nums'], fontSize: 11 },
  footerEnd: { justifyContent: 'flex-end' },
  footerStart: { justifyContent: 'flex-start' },
  tick: { width: 18, alignItems: 'flex-end' },
});
