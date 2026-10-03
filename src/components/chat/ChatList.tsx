/**
 * The message list.
 *
 * Inverted with newest-first data, so the list opens pinned to the latest
 * message and never jumps from the top on load. Two consequences of inversion
 * worth knowing: the header renders at the visual bottom — which is exactly
 * where the typing indicator belongs, between the newest bubble and the
 * composer — and non-cell content is *not* auto-flipped, so the header and
 * empty state carry their own counter-flip.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { groupMessages, type MessageGroup } from '@/utils/grouping';
import { formatDateSeparator } from '@/utils/time';
import type { LocalMessage } from '@/types/models';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

/** Undoes the inverted-list flip for content the list does not re-flip itself. */
const UNFLIP = { transform: [{ scaleY: -1 }] } as const;

export interface ChatListProps {
  /** Oldest first, as returned by the chat hook. */
  messages: LocalMessage[];
  meId: string;
  friendIsTyping: boolean;
  onRetry: (message: LocalMessage) => void;
  onDelete: (message: LocalMessage) => void;
  onRetryTranslation: (message: LocalMessage) => void;
}

export function ChatList({
  messages,
  meId,
  friendIsTyping,
  onRetry,
  onDelete,
  onRetryTranslation,
}: ChatListProps) {
  const { colors, typography, screenPadding } = useTheme();

  /* ---------------------------------------------------- entrance animation */

  /**
   * History is not "new", so the first render primes the set and animates
   * nothing. After that, ids that appear are ones the friend just sent.
   */
  const previousIdsRef = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  useEffect(() => {
    const previous = previousIdsRef.current;
    if (previous) {
      const fresh = messages.filter((message) => !previous.has(message.id)).map((message) => message.id);
      if (fresh.length > 0) setFreshIds(new Set(fresh));
    }
    previousIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messages]);

  const data = useMemo(() => groupMessages(messages, meId).reverse(), [messages, meId]);

  // Only the newest message you sent carries a status line, so a screen full of
  // old ticks would drown the one that matters.
  const latestMineId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message && message.sender_id === meId) return message.id;
    }
    return null;
  }, [messages, meId]);

  const renderItem = useCallback<ListRenderItem<MessageGroup>>(
    ({ item }) => (
      <View style={styles.group}>
        {item.startsNewDay ? (
          <View style={[styles.separator, { backgroundColor: colors.surface, borderRadius: 999 }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {formatDateSeparator(item.last.created_at)}
            </Text>
          </View>
        ) : null}

        {/*
          Rendered tail-first within the run, because inside an inverted list the
          visual order runs bottom-up through the same array.
        */}
        {item.messages.length > 1
          ? item.messages
              .slice(0, -1)
              .map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={item.isMine}
                  isLastInGroup={false}
                  animateIn={false}
                  isLatestMine={message.id === latestMineId}
                  onRetry={onRetry}
                  onDelete={onDelete}
                  onRetryTranslation={onRetryTranslation}
                />
              ))
          : null}
        <MessageBubble
          message={item.last}
          isMine={item.isMine}
          isLastInGroup
          animateIn={freshIds.has(item.last.id)}
          isLatestMine={item.last.id === latestMineId}
          onRetry={onRetry}
          onDelete={onDelete}
          onRetryTranslation={onRetryTranslation}
        />
      </View>
    ),
    [colors.surface, colors.textMuted, freshIds, latestMineId, onDelete, onRetry, onRetryTranslation, typography.caption]
  );

  const keyExtractor = useCallback((group: MessageGroup) => group.key, []);

  return (
    <View style={styles.flex}>
      {/* Empty state lives outside the inverted FlatList so it never gets flipped. */}
      {data.length === 0 ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.empty}>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Say something in your language.{'\n'}They&rsquo;ll read it in theirs.
          </Text>
        </Animated.View>
      ) : null}
      <FlatList
        inverted
        data={data}
        extraData={friendIsTyping}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: screenPadding }]}
        ListHeaderComponent={
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(140)}
            // A layout change, not a transform, would move the list under the user.
            style={[styles.typing, UNFLIP, friendIsTyping ? null : styles.hidden]}
            pointerEvents="none"
          >
            {friendIsTyping ? <TypingIndicator /> : null}
          </Animated.View>
        }
        testID="message-list"
      />
    </View>
  );
}

/** Three ghost bubbles: one in, two out. Says "loading" without a spinner. */
export function ChatListSkeleton({ label }: { label?: string }) {
  const { colors, radii, screenPadding, typography } = useTheme();

  // A `DimensionValue` needs the literal, not an inferred `string`.
  const rows: { mine: boolean; width: `${number}%` }[] = [
    { mine: false, width: '62%' },
    { mine: true, width: '48%' },
    { mine: false, width: '74%' },
  ];

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.skeleton, { paddingHorizontal: screenPadding }]} testID="chat-skeleton">
      {rows.map((row, index) => (
        <View
          key={index}
          style={[
            styles.skeletonBubble,
            {
              width: row.width,
              alignSelf: row.mine ? 'flex-end' : 'flex-start',
              backgroundColor: colors.surface,
              borderRadius: radii.bubble,
            },
          ]}
        />
      ))}
      {label ? <Text style={[typography.caption, { color: colors.textMuted, alignSelf: 'center', marginTop: 8 }]}>{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 12, paddingTop: 8, flexGrow: 1 },
  group: { marginBottom: 8, alignItems: 'stretch' },
  separator: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  typing: { height: 0 },
  hidden: { height: 0, opacity: 0 },
  empty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  skeleton: { flex: 1, justifyContent: 'center', gap: 14 },
  skeletonBubble: { height: 46 },
});
