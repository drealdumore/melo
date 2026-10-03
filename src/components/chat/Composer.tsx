/**
 * The composer: a floating card, a growing field, and a circular send button
 * that animates in smoothly when there is something to send.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { MAX_MESSAGE_LENGTH } from '@/services/messages';
import { Icon } from '@/components/ui/Icon';

const MAX_LINES = 5;
const LINE_HEIGHT = 23;
const VERTICAL_PADDING = 12;

const MIN_HEIGHT = LINE_HEIGHT + VERTICAL_PADDING * 2;
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES + VERTICAL_PADDING * 2;

export interface ComposerProps {
  /** Returns false if the send was rejected, so the text can be restored. */
  onSend: (text: string) => boolean;
  onTypingChange: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function Composer({ onSend, onTypingChange, disabled = false }: ComposerProps) {
  const { colors, typography, radii, sizes, springConfig, screenPadding, isDark } = useTheme();
  const reduced = useReducedMotion();
  const [text, setText] = useState('');
  const [contentHeight, setContentHeight] = useState(0);
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ haptic: true, scale: 0.92 });

  const canSend = text.trim().length > 0 && !disabled;
  const nearLimit = text.length > MAX_MESSAGE_LENGTH * 0.9;

  const sendScale = useSharedValue(0.6);
  useEffect(() => {
    sendScale.value = withSpring(canSend ? 1 : 0.6, springConfig);
  }, [canSend, springConfig, sendScale]);

  const sendStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 0.35 + sendScale.value * 0.65 }
      : { opacity: 0.35 + sendScale.value * 0.65, transform: [{ scale: 0.82 + sendScale.value * 0.18 }] }
  );

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      onTypingChange(next.trim().length > 0);
    },
    [onTypingChange]
  );

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const value = text;
    setText('');
    setContentHeight(0);
    onTypingChange(false);
    if (!onSend(value)) setText(value);
  }, [canSend, text, onSend, onTypingChange]);

  return (
    <View style={[styles.root, { paddingHorizontal: screenPadding }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : colors.surface,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border,
            borderRadius: radii.pill,
            height: Math.min(Math.max(contentHeight || MIN_HEIGHT, MIN_HEIGHT), MAX_HEIGHT),
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder="Say something in your language…"
          placeholderTextColor={colors.textMuted}
          multiline
          onContentSizeChange={(event) => setContentHeight(event.nativeEvent.contentSize.height + 4)}
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Message input"
          testID="composer-input"
          style={[
            styles.input,
            typography.body,
            { color: colors.textPrimary, maxHeight: MAX_HEIGHT },
          ]}
        />

        {canSend ? (
          <Animated.View style={sendStyle}>
            <AnimatedPressable
              onPress={handleSend}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              testID="send-button"
              style={[
                styles.send,
                { backgroundColor: colors.accent, borderRadius: sizes.sendButton / 2 },
                pressStyle,
              ]}
            >
              <Icon name="arrowUp" size={20} color={colors.onAccent} strokeWidth={2.4} />
            </AnimatedPressable>
          </Animated.View>
        ) : null}
      </View>

      {nearLimit ? (
        <Text style={[typography.caption, styles.counter, { color: colors.textMuted }]}>
          {text.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 6, position: 'relative' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderCurve: 'continuous',
    paddingLeft: 18,
    paddingRight: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  input: { flex: 1, paddingVertical: VERTICAL_PADDING, paddingRight: 8, fontSize: 16 },
  counter: { position: 'absolute', right: 24, top: -14 },
  send: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
