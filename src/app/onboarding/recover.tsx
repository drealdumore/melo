import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import {
  MELO_ID_MAX_LENGTH,
  isValidMeloId,
  normalizeMeloId,
  recoverIdentity,
  type RecoverResult,
} from "@/services/profile";
import { createLogger } from "@/services/logger";
import { formatServiceError } from "@/utils/serviceError";

const log = createLogger("onboarding.recover");

type Failure = Exclude<RecoverResult, { ok: true }>["reason"] | "completion_failed";

const MESSAGES: Record<Failure, string> = {
  malformed: "that doesn't look like a melo id. it's your name + 5 characters.",
  not_found: "no account with that id. check the spelling.",
  unconfigured: "recovery isn't available in this build.",
  lookup_failed: "can't connect. check your wifi or data and try again.",
  completion_failed: "your account was recovered, but setup couldn't be finished. please try again.",
};

function getLookupErrorDetails(error: unknown): string {
  return formatServiceError(error, "Supabase lookup failed");
}

export default function RecoverScreen() {
  const {
    colors,
    typography,
    fontFamily,
    isDark,
    screenPadding,
    spacing,
    radii,
  } = useTheme();
  const router = useRouter();
  const { reload, completeOnboarding } = useProfile();

  const [value, setValue] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [lookupErrorDetails, setLookupErrorDetails] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = useCallback((next: string) => {
    setValue(normalizeMeloId(next).slice(0, MELO_ID_MAX_LENGTH));
    setFailure(null);
    setLookupErrorDetails(null);
  }, []);

  const onSubmit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setLookupErrorDetails(null);
    try {
      const result = await recoverIdentity(value);
      if (!result.ok) {
        // A missing ID is a mistyped ID far more often than a real one, so the
        // haptic belongs on the failure and not just the success.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFailure(result.reason);
        return;
      }
      // Recovery writes the profile into AsyncStorage itself, so the provider
      // has to re-read it before the router will stop redirecting to onboarding.
      await reload();
      try {
        await completeOnboarding();
      } catch (error) {
        log.error("the recovered account could not be marked complete", error);
        setFailure("completion_failed");
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/chats");
    } catch (error) {
      // `findProfileByMeloId` rethrows on a transport or PostgREST failure, so
      // this is "the server could not be reached", which is a different thing
      // from "no such account" and worth its own message and its own log line.
      log.error(`the lookup for ${value} threw`, error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLookupErrorDetails(getLookupErrorDetails(error));
      setFailure("lookup_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, completeOnboarding, reload, router, value]);

  const inputBg = isDark ? "rgba(255, 255, 255, 0.05)" : colors.surface;
  const inputBorder = failure
    ? colors.danger
    : isDark
      ? "rgba(255, 255, 255, 0.12)"
      : colors.border;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="welcome back" onBack={() => router.back()} />

      <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
        <Text
          style={[
            typography.screenTitle,
            styles.title,
            { color: colors.textPrimary },
          ]}
        >
          drop your melo id
        </Text>
        <Text
          style={[
            typography.body,
            styles.subtitle,
            { color: colors.textMuted },
          ]}
        >
          it&rsquo;s your name + 5 characters. we&rsquo;ll bring your chats back
          to this phone.
        </Text>

        <View style={[styles.field, { marginTop: spacing.xl }]}>
          <Text
            style={[
              typography.label,
              styles.fieldLabel,
              { color: colors.textMuted },
            ]}
          >
            Your Melo ID
          </Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.surface,
                borderColor: inputBorder,
                borderRadius: radii.input,
              },
            ]}
          >
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="your ID"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
              maxLength={MELO_ID_MAX_LENGTH}
              accessibilityLabel="Your Melo ID"
              testID="recover-id-input"
              style={[
                styles.input,
                typography.mono,
                { color: colors.textPrimary, fontFamily: fontFamily.mono },
              ]}
            />
          </View>

          {failure ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                typography.caption,
                styles.message,
                { color: colors.danger },
              ]}
              testID="recover-error"
            >
              {MESSAGES[failure]}
              {failure === "lookup_failed" && lookupErrorDetails
                ? ` (${lookupErrorDetails})`
                : ""}
            </Text>
          ) : null}

          <Text
            style={[
              typography.caption,
              styles.warning,
              { color: colors.textMuted },
            ]}
          >
            Your Melo ID is your recovery key. Keep it safe.
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingHorizontal: screenPadding }]}>
        <Button
          label="Get my chats back"
          onPress={() => void onSubmit()}
          disabled={!isValidMeloId(value)}
          loading={busy}
          loadingLabel="Getting you back in…"
          testID="recover-submit"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingTop: 12 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  field: { gap: 10 },
  fieldLabel: { fontSize: 12, letterSpacing: 0.8 },
  inputContainer: {
    borderWidth: 1.5,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 60,
    justifyContent: "center",
  },
  input: { fontSize: 15, lineHeight: 26, padding: 0 },
  message: { marginTop: 4 },
  warning: { marginTop: 12, lineHeight: 17 },
  footer: { paddingBottom: 28 },
});
