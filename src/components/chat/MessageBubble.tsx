/**
 * One message bubble.
 *
 * Received messages show the translation, with the original always one tap away
 * behind a spring. A failed translation shows the original plus an honest
 * failure state and a way to try again — never a silent fallback, never an
 * overwrite. Our own messages always show our own words.
 *
 * A small rotation is what stops a long run of bubbles reading as a wall: each
 * bubble leans very slightly, and the lean alternates. It is a degree and a half
 * — enough to see, not enough to look broken.
 */
import { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { isRtl } from '@/constants/languages';
import { entrance, springConfig, timingConfig } from '@/theme/motion';
import type { LocalMessage, SendState } from '@/types/models';
import { Icon } from '@/components/ui/Icon';

export interface MessageBubbleProps {
  message: LocalMessage;
  isMine: boolean;
  /** Only the last bubble of a run gets a timestamp. */
  isLastInGroup: boolean;
  /** True when this row appeared after the list settled; drives the entrance. */
  animateIn: boolean;
  /** Alternates the lean so a run does not look stamped. */
  tiltSide: 1 | -1;
  /** The very last message you sent is the only one that gets a status line. */
  isLatestMine: boolean;
  onRetry: (message: LocalMessage) => void;
  onDelete: (message: LocalMessage) => void;
  onRetryTranslation: (message: LocalMessage) => void;
}

/** Vertical gap between bubbles inside a run. */
const RUN_GAP = 2;

function describe(message: LocalMessage, isMine: boolean, body: string): string {
  if (isMine) return `You said: ${body}`;
  if (message.translation_status === 'failed') {
    return `Could not translate. Original: ${message.original_text}`;
  }
  return `Translated: ${body}. Original: ${message.original_text}`;
}

function MessageBubbleComponent({
  message,
  isMine,
  isLastInGroup,
  animateIn,
  tiltSide,
  isLatestMine,
  onRetry,
  onDelete,
  onRetryTranslation,
}: MessageBubbleProps) {
  const { colors, typography, radii, duration, revealTilt, bubbleTilt } = useTheme();
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [revealHeight, setRevealHeight] = useState(0);
  const { onPressIn, onPressOut, style: pressStyle } = usePressable();

  const canExpand =
    !isMine && message.translation_status === 'translated' && Boolean(message.translated_text);
  const hasFailed = !isMine && message.translation_status === 'failed';
  const isPending = !isMine && message.translation_status === 'pending';

  const bodyRtl = isRtl(isMine ? message.source_language : message.target_language);
  const originalRtl = isRtl(message.source_language);

  /* ------------------------------------------------------ enter animations */

  const enter = useSharedValue(animateIn ? 0 : 1);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!animateIn) return;
    enter.value = withTiming(1, timingConfig(duration.base));
    if (isMine) pop.value = withSpring(1, springConfig);
  }, [animateIn, duration.base, isMine, enter, pop]);

  const enterStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: enter.value }
      : {
          opacity: enter.value,
          transform: [
            { translateY: (1 - enter.value) * entrance.rise },
            { scale: entrance.from + (1 - entrance.from) * pop.value },
          ],
        }
  );

  /* --------------------------------------------------------- reveal spring */

  const reveal = useSharedValue(0);
  useEffect(() => {
    // Reduced Motion opens the translation with a plain fade, so the height is
    // applied without a spring snapping it into place.
    reveal.value = reduced
      ? withTiming(expanded ? 1 : 0, timingConfig(duration.base))
      : withSpring(expanded ? 1 : 0, springConfig);
  }, [expanded, reduced, duration.base, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    height: reveal.value * revealHeight,
    opacity: reveal.value,
  }));

  // The original tilts out slightly as it opens. Under Reduce Motion it only
  // fades — the reveal is still legible without the movement.
  const revealTiltStyle = useAnimatedStyle(() =>
    reduced ? {} : { transform: [{ rotate: `${reveal.value * revealTilt}deg` }] }
  );

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
        accessibilityHint={canExpand ? 'Shows the original message' : undefined}
        accessibilityState={canExpand ? { expanded } : undefined}
        testID={`bubble-${message.id}`}
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.accent : colors.surface,
            borderRadius: radii.bubble,
            // The tail-side bottom corner tightens, which is what makes a run of
            // bubbles read as one block.
            borderBottomRightRadius: isMine ? radii.bubbleTail : radii.bubble,
            borderBottomLeftRadius: isMine ? radii.bubble : radii.bubbleTail,
            marginBottom: RUN_GAP,
          },
          canExpand ? pressStyle : null,
          // No lean under Reduce Motion, and none on the newest message: a
          // rotation on the message you are looking at is just noise.
          reduced || isLatestMine ? null : { transform: [{ rotate: `${tiltSide * bubbleTilt}deg` }] },
        ]}
      >
        <Text style={[typography.message, { color: textColor }, bodyRtl ? styles.rtl : null]}>
          {body}
        </Text>

        {isPending ? (
          <Text style={[typography.caption, styles.note, { color: colors.textMuted }]}>Translating…</Text>
        ) : null}

        {hasFailed ? (
          <View style={styles.failedRow}>
            <Text
              accessibilityLiveRegion="polite"
              style={[typography.caption, styles.note, { color: colors.danger }]}
            >
              Couldn&apos;t translate this time.
            </Text>
            <RetryChip label="Try again" onPress={() => onRetryTranslation(message)} />
          </View>
        ) : null}

        {canExpand ? (
          <Text style={[typography.caption, styles.caption, { color: colors.info }]}>Translated</Text>
        ) : null}

        {/*
          The original is revealed in place: same bubble, a divider, a label.
          Height is spring-animated from a measured content height, so the
          bubble grows instead of snapping.
        */}
        {canExpand ? (
          <Animated.View style={[styles.reveal, revealStyle]}>
            <Animated.View
              style={[styles.revealInner, revealTiltStyle]}
              onLayout={(event) => setRevealHeight(event.nativeEvent.layout.height)}
            >
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[typography.label, { color: colors.info }]}>ORIGINAL</Text>
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

      {isLastInGroup || isLatestMine ? (
        <View style={[styles.footer, isMine ? styles.footerEnd : styles.footerStart]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
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

function RetryChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, typography, radii } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
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
  const { onPressIn, onPressOut, style } = usePressable();

  if (state === 'failed') {
    // Tapping the warning retries; long-pressing offers the way out, so a
    // message that will never send does not sit there forever.
    return (
      <AnimatedPressable
        onPress={() => onRetry(message)}
        onLongPress={() => onDelete(message)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Not sent. Tap to retry, or long-press to delete"
        testID={`retry-${message.id}`}
        style={style}
      >
        <Text style={[typography.caption, { color: colors.danger }]}>Not sent. Tap to retry</Text>
      </AnimatedPressable>
    );
  }

  if (state === 'sending') {
    return (
      <View style={styles.tick} accessibilityLabel="Sending">
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
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  caption: { marginTop: 4, alignSelf: 'flex-start' },
  note: { marginTop: 4 },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  reveal: { overflow: 'hidden' },
  // Absolutely positioned so the content can be measured while height is 0.
  revealInner: { position: 'absolute', left: 0, right: 0, top: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 10, marginBottom: 8 },
  original: { marginTop: 4 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 2 },
  footerEnd: { justifyContent: 'flex-end' },
  footerStart: { justifyContent: 'flex-start' },
  tick: { width: 18, alignItems: 'flex-end' },
});
