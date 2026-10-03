import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated from "react-native-reanimated";

import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { connectWithMeloId } from "@/services/rooms";
import {
  MELO_ID_MAX_LENGTH,
  isValidMeloId,
  normalizeMeloId,
} from "@/services/profile";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { DashedBorder } from "@/components/ui/DashedBorder";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { MyProfileSheet } from "@/components/profile/MyProfileSheet";
import { createLogger } from "@/services/logger";
import { screenEnter, screenFadeEnter } from "@/theme/motion";

const log = createLogger("connect");
const CONNECT_CONTENT_ENTER = screenEnter(40);
const CONNECT_FADE_ENTER = screenFadeEnter(40);

type ErrorMessage =
  | "Hmm… can't find them. Double-check the Melo ID and try again."
  | "That's your own ID. Enter your friend's ID to start chatting."
  | "That didn't work. Check your internet and try again.";

export default function ConnectScreen() {
  const { colors, typography, radii, screenPadding, fontFamily, isDark } =
    useTheme();
  const reducedMotion = useReducedMotion();
  const { footerBottom } = useScreenInsets();
  const router = useRouter();
  const { profile } = useProfile();

  const [value, setValue] = useState("");
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Lowercased and space-stripped on the way in
  const onChange = useCallback((next: string) => {
    setValue(normalizeMeloId(next).slice(0, MELO_ID_MAX_LENGTH));
    setError(null);
  }, []);

  const onStart = useCallback(async () => {
    if (!profile || busy) return;
    setError(null);
    setBusy(true);

    try {
      const result = await connectWithMeloId(profile, value);

      if (result.ok) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        log.info(`connected → ${result.roomId}`);
        router.replace(`/chats/${result.roomId}`);
        return;
      }

      log.info(`connect was rejected: ${result.reason}`, {
        shown:
          result.reason === "self"
            ? "That's your own ID. Enter your friend's ID to start chatting."
            : result.reason === "not_found"
              ? "Hmm… can't find them. Double-check the Melo ID and try again."
              : "That didn't work. Check your internet and try again.",
      });
      setError(
        result.reason === "self"
          ? "That's your own ID. Enter your friend's ID to start chatting."
          : result.reason === "not_found"
            ? "Hmm… can't find them. Double-check the Melo ID and try again."
            : "That didn't work. Check your internet and try again.",
      );
    } catch (caught) {
      log.error("connect threw before it could return a result", caught);
      setError("That didn't work. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }, [profile, busy, value, router]);

  if (!profile) return null;

  const canSubmit = isValidMeloId(value) && !busy;
  const showMalformedHint = value.length > 0 && !canSubmit && !error;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScreenHeader
          title="Who are we texting?"
          onBack={() => router.back()}
          userName={profile.display_name}
          userAvatarKey={profile.avatar_key}
          onPressUser={() => setProfileOpen(true)}
        />

        <Animated.View
          entering={reducedMotion ? CONNECT_FADE_ENTER : CONNECT_CONTENT_ENTER}
          style={[styles.body, { paddingHorizontal: screenPadding }]}
        >
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Enter their Melo ID to start chatting. They don’t need to enter
            yours.
          </Text>

          <Text
            style={[
              typography.label,
              styles.label,
              { color: colors.textMuted },
            ]}
          >
            Your Melo ID
          </Text>
          <View
            style={[
              styles.ownId,
              {
                backgroundColor: colors.surface,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : colors.border,
                borderRadius: radii.input,
              },
            ]}
          >
            <View style={styles.ownIdLeft}>
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
            <CopyButton meloId={profile.melo_id} compact testID="copy-own-id" />
          </View>

          <Text
            style={[
              typography.label,
              styles.label,
              { color: colors.textMuted },
            ]}
          >
            Their Melo ID
          </Text>
          <DashedBorder
            radius={radii.inputDashed}
            color={
              error
                ? colors.danger
                : isDark
                  ? "rgba(255, 255, 255, 0.18)"
                  : colors.border
            }
            style={[
              styles.inputWrapper,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : colors.surface,
              },
            ]}
          >
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="Paste their ID"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="go"
              onSubmitEditing={() => void onStart()}
              maxLength={MELO_ID_MAX_LENGTH}
              accessibilityLabel="Friend's Melo ID"
              testID="friend-id-input"
              style={[
                styles.input,
                typography.mono,
                { color: colors.textPrimary },
              ]}
            />
          </DashedBorder>

          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                typography.caption,
                styles.message,
                { color: colors.danger },
              ]}
              testID="connect-error"
            >
              {error}
            </Text>
          ) : showMalformedHint ? (
            <Text
              style={[
                typography.caption,
                styles.message,
                { color: colors.textMuted },
              ]}
            >
              Keep typing the full Melo ID.
            </Text>
          ) : null}
        </Animated.View>

        <View
          style={[
            styles.footer,
            { paddingHorizontal: screenPadding, paddingBottom: footerBottom },
          ]}
        >
          <Button
            label="Start chatting"
            rightIcon="arrowRight"
            onPress={() => void onStart()}
            disabled={!canSubmit}
            loading={busy}
            loadingLabel="Finding them…"
            haptic={false}
            testID="start-chat"
          />
          <Button
            label="Recover my account"
            variant="ghost"
            size="compact"
            onPress={() => router.push("/onboarding/recover")}
          />
        </View>

        <MyProfileSheet
          visible={profileOpen}
          onClose={() => setProfileOpen(false)}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1, paddingTop: 8, gap: 2 },
  label: { marginTop: 24, marginBottom: 8 },
  ownId: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 68,
    paddingVertical: 8,
    borderWidth: 1,
    borderCurve: "continuous",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  ownIdLeft: { flex: 1, minWidth: 0, gap: 2 },
  inputWrapper: { minHeight: 54, borderCurve: "continuous" },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    letterSpacing: 2,
  },
  message: { marginTop: 8 },
  footer: { paddingTop: 8, gap: 4 },
});
