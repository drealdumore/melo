/**
 * Connect. Your ID at the top with a way to copy it, their ID below in a dashed
 * field, one button.
 *
 * Errors appear inline under the field and never in a modal — the user is typing
 * an ID they read off another device, and a dialog would hide the field they
 * need to fix.
 */
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { connectWithMeloId } from '@/services/rooms';
import { MELO_ID_LENGTH, normalizeMeloId } from '@/services/profile';
import { Button } from '@/components/ui/Button';
import { DashedBorder } from '@/components/ui/DashedBorder';
import { DashedIconButton } from '@/components/ui/DashedIconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { MyProfileSheet } from '@/components/profile/MyProfileSheet';
import { copyToClipboard } from '@/utils/clipboard';

type ErrorMessage =
  | "That ID doesn't exist. Check it and try again."
  | "That's your own ID."
  | 'Something went wrong. Try again.';

export default function ConnectScreen() {
  const { colors, typography, radii, spacing, screenPadding, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();

  const [value, setValue] = useState('');
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Lowercased and space-stripped on the way in, so a pasted ID and a typed one
  // behave identically and we never send a mangled ID to the database.
  const onChange = useCallback((next: string) => {
    setValue(normalizeMeloId(next).slice(0, MELO_ID_LENGTH));
    setError(null);
  }, []);

  const onStart = useCallback(async () => {
    if (!profile || busy) return;
    setError(null);
    setBusy(true);

    try {
      const result = await connectWithMeloId(profile, value);

      if (result.ok) {
        // The haptic means "you have a chat now", so it belongs on success only.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.replace(`/chats/${result.roomId}`);
        return;
      }

      setError(
        result.reason === 'self'
          ? "That's your own ID."
          : result.reason === 'not_found'
            ? "That ID doesn't exist. Check it and try again."
            : 'Something went wrong. Try again.'
      );
    } catch (caught) {
      console.error('Connect failed', caught);
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }, [profile, busy, value, router]);

  if (!profile) return null;

  const canSubmit = value.length === MELO_ID_LENGTH && !busy;
  const showMalformedHint = value.length > 0 && value.length < MELO_ID_LENGTH && !error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScreenHeader
        title="Connect"
        onBack={() => router.back()}
        userName={profile.display_name}
        onPressUser={() => setProfileOpen(true)}
      />

      <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
        <Text style={[typography.label, styles.label, { color: colors.textMuted }]}>
          YOUR MELO ID
        </Text>
        <View
          style={[
            styles.ownId,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.input,
            },
          ]}
        >
          <Text style={[typography.mono, { color: colors.textPrimary, fontFamily: fontFamily.mono }]}>
            {profile.melo_id}
          </Text>
          <View style={styles.ownIdRight}>
            <Text style={[typography.caption, { color: copied ? colors.success : colors.textMuted }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
            <PressableCopy meloId={profile.melo_id} copied={copied} onCopied={() => setCopied(true)} />
          </View>
        </View>

        <Text style={[typography.label, styles.label, { color: colors.textMuted }]}>
          FRIEND&apos;S MELO ID
        </Text>
        <DashedBorder
          radius={radii.inputDashed}
          color={error ? colors.danger : colors.border}
          style={[styles.inputWrapper, { backgroundColor: colors.surface }]}
        >
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="abc23def456"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="go"
            onSubmitEditing={() => void onStart()}
            maxLength={MELO_ID_LENGTH}
            accessibilityLabel="Friend's Melo ID"
            testID="friend-id-input"
            style={[styles.input, typography.mono, { color: colors.textPrimary }]}
          />
        </DashedBorder>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.caption, styles.message, { color: colors.danger }]}
            testID="connect-error"
          >
            {error}
          </Text>
        ) : showMalformedHint ? (
          <Text style={[typography.caption, styles.message, { color: colors.textMuted }]}>
            Melo IDs are {MELO_ID_LENGTH} characters.
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.footer,
          { paddingHorizontal: screenPadding, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <Button
          label="Start Chat"
          onPress={() => void onStart()}
          disabled={!canSubmit}
          loading={busy}
          // The buzz belongs to a successful connection, fired in `onStart`.
          haptic={false}
          testID="start-chat"
        />
      </View>

      <MyProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </KeyboardAvoidingView>
  );
}

/** A small dashed circle around the copy glyph, as specified. */
function PressableCopy({
  meloId,
  copied,
  onCopied,
}: {
  meloId: string;
  copied: boolean;
  onCopied: () => void;
}) {
  return (
    <DashedIconButton
      name={copied ? 'check' : 'copy'}
      accessibilityLabel={`Copy your Melo ID, ${meloId}`}
      testID="copy-own-id"
      onPress={() => {
        void copyToClipboard(meloId).then((ok) => {
          if (ok) onCopied();
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingTop: 8 },
  label: { marginTop: 24, marginBottom: 8 },
  ownId: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 56,
    borderWidth: 1,
  },
  ownIdRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputWrapper: { minHeight: 54 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    letterSpacing: 2,
  },
  message: { marginTop: 8 },
  footer: { paddingTop: 8 },
});
