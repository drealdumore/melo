/**
 * A conversation. Header, messages, composer.
 *
 * The keyboard lifts the composer with `KeyboardAvoidingView`; the list keeps
 * its inverted anchor so a lifted keyboard never breaks the scroll position. A
 * room that cannot be resolved shows a plain message with a way back, not a
 * spinner that spins forever.
 */
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useProfile } from '@/hooks/useProfile';
import { useChat } from '@/hooks/useChat';
import { useAppPresence } from '@/components/providers/AppPresenceProvider';
import { useTheme } from '@/hooks/useTheme';
import { isRoomId } from '@/services/rooms';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatList, ChatListSkeleton } from '@/components/chat/ChatList';
import { Composer } from '@/components/chat/Composer';
import { FriendSheet } from '@/components/profile/FriendSheet';
import { Button } from '@/components/ui/Button';
import { MeloMark } from '@/components/ui/MeloMark';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ roomId?: string | string[] }>();
  const roomId = Array.isArray(params.roomId) ? (params.roomId[0] ?? '') : (params.roomId ?? '');
  const router = useRouter();

  const { colors, typography, spacing, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { profile } = useProfile();
  const { presenceOf, isInRoom, setActiveRoom } = useAppPresence();
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    loading,
    notFound,
    friend,
    messages,
    send,
    retry,
    discard,
    retryTranslation,
    friendIsTyping,
    noteTyping,
    presence,
    presenceLive,
    connection,
  } = useChat(roomId);

  // Tell the rest of the app which room this device is looking at, so a friend
  // in this room gets a solid ring and one elsewhere gets a dashed one.
  useEffect(() => {
    if (!isFocused) return;
    setActiveRoom(roomId);
    return () => setActiveRoom(null);
  }, [isFocused, roomId, setActiveRoom]);

  const openFriend = useCallback(() => setSheetOpen(true), []);
  const closeFriend = useCallback(() => setSheetOpen(false), []);

  if (!isRoomId(roomId)) return <MissingRoom message="This chat link is incomplete." />;
  if (notFound) return <MissingRoom message="This conversation is no longer available." />;

  const reconnecting = connection === 'reconnecting' || connection === 'connecting';
  // Room presence is authoritative for "here now"; app presence fills in the
  // "in Melo, but not in this chat" case that room presence cannot see.
  const elsewhere = friend ? presenceOf(friend.id) === 'online' && !isInRoom(friend.id, roomId) : false;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />

      <View style={{ paddingTop: insets.top + 8 }}>
        <ChatHeader
          name={friend?.display_name ?? '…'}
          readingLanguage={friend?.reading_language ?? profile?.reading_language ?? 'en'}
          myLanguage={profile?.reading_language ?? 'en'}
          presence={presence}
          presenceLive={presenceLive}
          elsewhere={elsewhere}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/chats'))}
          onPressName={friend ? openFriend : () => {}}
        />
      </View>

      {reconnecting ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[styles.banner, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
          accessibilityLiveRegion="polite"
          testID="reconnecting"
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>Reconnecting…</Text>
        </Animated.View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading && messages.length === 0 ? (
          <ChatListSkeleton />
        ) : (
          <ChatList
            messages={messages}
            meId={profile?.id ?? ''}
            friendIsTyping={friendIsTyping}
            onRetry={retry}
            onDelete={discard}
            onRetryTranslation={retryTranslation}
          />
        )}

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Composer onSend={send} onTypingChange={noteTyping} disabled={!isFocused || !friend} />
        </View>
      </KeyboardAvoidingView>

      <FriendSheet
        visible={sheetOpen}
        friend={friend}
        myLanguage={profile?.reading_language ?? 'en'}
        presence={presence}
        presenceLive={presenceLive}
        elsewhere={elsewhere}
        onClose={closeFriend}
      />
    </View>
  );
}

function MissingRoom({ message }: { message: string }) {
  const { colors, typography, screenPadding } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.missing,
        { backgroundColor: colors.background, paddingHorizontal: screenPadding, paddingTop: insets.top + 60 },
      ]}
    >
      <MeloMark size={40} color={colors.textMuted} />
      <Text style={[typography.section, styles.missingText, { color: colors.textPrimary }]}>{message}</Text>
      <Button
        label="Back to chats"
        variant="surface"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  // The pill is overlaid rather than stacked, so showing it never moves the
  // list the user is reading.
  banner: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  composerWrap: { paddingTop: 4 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  missingText: { textAlign: 'center' },
});
