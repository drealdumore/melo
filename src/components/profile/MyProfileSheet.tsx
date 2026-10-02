import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';

import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { LANGUAGES, getLanguage } from '@/constants/languages';
import { Sheet, SheetScroll } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarGrid } from '@/components/profile/AvatarGrid';
import { LanguageRow } from '@/components/onboarding/LanguageRow';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { createLogger } from '@/services/logger';
import type { Profile } from '@/types/models';

const MAX_NAME_LENGTH = 30;
const RESET_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const RESET_ENTER = FadeInDown.duration(180).easing(RESET_EASE_OUT);
const RESET_EXIT = FadeOutUp.duration(140).easing(RESET_EASE_OUT);
const RESET_FADE_IN = FadeIn.duration(160).easing(RESET_EASE_OUT);
const RESET_FADE_OUT = FadeOut.duration(120).easing(RESET_EASE_OUT);
const RESET_LAYOUT = LinearTransition.duration(180).easing(RESET_EASE_OUT);

const log = createLogger('profile.sheet');

export interface MyProfileSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function MyProfileSheet({ visible, onClose }: MyProfileSheetProps) {
  const { profile } = useProfile();

  if (!profile) return null;
  return (
    <MyProfileBody
      key={profile.id}
      profile={profile}
      visible={visible}
      onClose={onClose}
    />
  );
}

function MyProfileBody({
  profile,
  visible,
  onClose,
}: {
  profile: Profile;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, typography, spacing, radii, screenPadding, fontFamily, isDark } =
    useTheme();
  const reducedMotion = useReducedMotion();
  const { update, reset } = useProfile();
  const router = useRouter();

  const [name, setName] = useState(profile.display_name);
  const [languageCode, setLanguageCode] = useState(profile.reading_language);
  const [avatarKey, setAvatarKey] = useState<string | null>(profile.avatar_key);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const { onPressIn: avatarPressIn, onPressOut: avatarPressOut, style: avatarPressStyle } = usePressable();

  const trimmed = name.trim();
  const nameValid = trimmed.length > 0;
  const changed =
    trimmed !== profile.display_name ||
    languageCode !== profile.reading_language ||
    avatarKey !== profile.avatar_key;

  const language = useMemo(() => getLanguage(languageCode), [languageCode]);

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    setResetError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    log.warn('user reset their device identity');
    try {
      await reset();
      setResetConfirmVisible(false);
      onClose();
      router.replace('/onboarding/welcome');
    } catch (error) {
      log.error('the device identity could not be reset', error);
      setResetError('Your profile is still on this device. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const save = async () => {
    if (!nameValid || saving) return;
    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const attempted = {
      displayName: trimmed.slice(0, MAX_NAME_LENGTH),
      readingLanguage: languageCode,
      avatarKey,
    };
    log.info('user is saving their profile', {
      name: attempted.displayName,
      reads: attempted.readingLanguage,
      avatar: avatarKey ?? 'initials',
      nameChanged: attempted.displayName !== profile.display_name,
      languageChanged: attempted.readingLanguage !== profile.reading_language,
      avatarChanged: avatarKey !== profile.avatar_key,
    });
    try {
      await update(attempted);
      log.info('profile saved');
      onClose();
    } catch (error) {
      log.error('the profile could not be saved; it was left unchanged', error);
      Alert.alert(
        "Couldn't save that.",
        'Your changes didn’t go through. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setResetConfirmVisible(false);
        onClose();
      }}
      title="You"
      dismissable={!saving && !resetting}
    >
      <SheetScroll>
        <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
          <View style={styles.identity}>
            <AnimatedPressable
              onPress={() => setPickingAvatar(true)}
              onPressIn={saving ? undefined : avatarPressIn}
              onPressOut={saving ? undefined : avatarPressOut}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Change your avatar"
              accessibilityHint="Opens a list of avatars to choose from"
              testID="edit-avatar"
              style={avatarPressStyle}
            >
              <Avatar
                name={trimmed || profile.display_name}
                avatarKey={avatarKey ?? undefined}
                size={54}
              />
            </AnimatedPressable>
            <View style={styles.nameColumn}>
              <Text
                style={[typography.section, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {trimmed || profile.display_name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Reads in {language.name}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.idRow,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : colors.border,
                borderRadius: radii.row,
              },
            ]}
          >
            <View style={styles.idLeft}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Melo ID
              </Text>
              <Text
                style={[
                  typography.mono,
                  {
                    color: colors.textPrimary,
                    fontFamily: fontFamily.mono,
                    letterSpacing: 1.5,
                    fontSize: 15,
                  },
                ]}
                numberOfLines={1}
              >
                {profile.melo_id}
              </Text>
            </View>
            <CopyButton meloId={profile.melo_id} compact />
          </View>

          <Text
            style={[
              typography.label,
              styles.label,
              { color: colors.textMuted },
            ]}
          >
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={(next) => setName(next.slice(0, MAX_NAME_LENGTH))}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MAX_NAME_LENGTH}
            accessibilityLabel="Your name"
            testID="profile-name-input"
            style={[
              styles.input,
              typography.body,
              {
                color: colors.textPrimary,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface,
                borderColor: nameValid ? (isDark ? 'rgba(255, 255, 255, 0.10)' : colors.border) : colors.danger,
                borderRadius: radii.input,
              },
            ]}
          />

          <Text
            style={[
              typography.label,
              styles.label,
              { color: colors.textMuted },
            ]}
          >
            Reading language
          </Text>
          <View style={{ gap: spacing.sm }}>
            {LANGUAGES.map((item) => (
              <LanguageRow
                key={item.code}
                language={item}
                selected={item.code === languageCode}
                onPress={() => setLanguageCode(item.code)}
              />
            ))}
          </View>

          <Text
            style={[
              typography.caption,
              styles.footnote,
              { color: colors.textMuted },
            ]}
          >
            Messages from your chats get automatically translated into this language.
          </Text>

          <Animated.View layout={reducedMotion ? undefined : RESET_LAYOUT}>
            {resetConfirmVisible ? (
              <Animated.View
                key="reset-confirmation"
                entering={reducedMotion ? RESET_FADE_IN : RESET_ENTER}
                exiting={reducedMotion ? RESET_FADE_OUT : RESET_EXIT}
                style={[
                  styles.resetConfirm,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                testID="reset-confirmation"
              >
                <Text style={[typography.body, styles.resetMessage, { color: colors.textPrimary }]}>
                  Your Melo ID and profile will be removed from this device. You’ll need your Melo ID to recover your profile later.
                </Text>

                {resetError ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[typography.caption, { color: colors.danger }]}
                  >
                    {resetError}
                  </Text>
                ) : null}

                <View style={styles.resetActions}>
                  <Button
                    label="Keep my profile"
                    onPress={() => setResetConfirmVisible(false)}
                    disabled={resetting}
                    testID="cancel-reset"
                  />
                  <Button
                    label="Reset this device"
                    variant="surface"
                    onPress={() => void handleReset()}
                    disabled={resetting}
                    loading={resetting}
                    loadingLabel="Resetting…"
                    style={{ borderColor: colors.border }}
                    labelStyle={{ color: colors.danger }}
                    testID="confirm-reset"
                  />
                </View>
              </Animated.View>
            ) : (
              <Animated.View
                key="reset-trigger"
                entering={reducedMotion ? RESET_FADE_IN : RESET_ENTER}
                exiting={reducedMotion ? RESET_FADE_OUT : RESET_EXIT}
              >
                <Button
                  label="Reset this device"
                  variant="ghost"
                  size="compact"
                  onPress={() => {
                    setResetError(null);
                    setResetConfirmVisible(true);
                  }}
                  disabled={saving || resetting}
                  style={[styles.resetButton, { borderColor: colors.danger }]}
                  testID="reset-device"
                />
              </Animated.View>
            )}
          </Animated.View>
        </View>

        {changed ? (
          <View style={[styles.footer, { paddingHorizontal: screenPadding }]}>
            <Button
              label="Save changes"
              onPress={() => void save()}
              disabled={!nameValid}
              loading={saving}
              testID="save-profile"
            />
          </View>
        ) : null}
      </SheetScroll>

      <Sheet
        visible={pickingAvatar}
        onClose={async () => {
          setPickingAvatar(false);
          if (avatarKey !== profile.avatar_key) void save();
        }}
        title="Your avatar"
        dismissable={!saving}
      >
        <SheetScroll>
          <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
            <AvatarGrid
              name={trimmed || profile.display_name}
              value={avatarKey}
              onChange={setAvatarKey}
              hint="Your friend sees this next to your messages."
              allowInitials
            />
          </View>
        </SheetScroll>
      </Sheet>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingBottom: 20, gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nameColumn: { flex: 1, gap: 2 },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  idLeft: { gap: 2, flex: 1 },
  label: { marginTop: 12 },
  input: {
    borderWidth: 1,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 16,
  },
  footnote: { lineHeight: 18, marginTop: 8 },
  footer: { marginTop: 12, paddingBottom: 12 },
  resetButton: { marginTop: 8 },
  resetConfirm: {
    marginTop: 8,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  resetMessage: { flex: 1, lineHeight: 22 },
  resetActions: { gap: 10 },
});
