import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import {
  loadOrCreateIdentity,
  loadProfile,
  type LocalIdentity,
} from "@/services/profile";
import { loadDraft } from "@/services/onboardingDraft";
import { createLogger } from "@/services/logger";

const log = createLogger("onboarding.id");

type SaveState =
  | { status: "drafting" }
  | { status: "saving"; identity: LocalIdentity }
  | { status: "ready"; identity: LocalIdentity }
  | { status: "failed"; identity: LocalIdentity; message: string };

export default function MeloIdScreen() {
  const { colors, typography, isDark, fontFamily } = useTheme();
  const router = useRouter();
  const { create, update, completeOnboarding } = useProfile();

  const [state, setState] = useState<SaveState>({ status: "drafting" });

  const identityRef = useRef<LocalIdentity | null>(null);
  const updateRef = useRef(update);
  const draftRef = useRef<{
    displayName?: string;
    readingLanguage?: string;
    avatarKey?: string | null;
  }>({});

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  const save = useCallback(
    async (identity: LocalIdentity) => {
      setState({ status: "saving", identity });
      const { displayName, readingLanguage, avatarKey } = draftRef.current;
      log.info("creating the profile", {
        meloId: identity.meloId,
        name: displayName ?? "(none)",
        reads: readingLanguage ?? "(none)",
        avatar: avatarKey ?? "initials",
      });
      try {
        if (!displayName || !readingLanguage) {
          throw new Error("The onboarding draft is incomplete.");
        }
        const profile = await create(identity, {
          displayName,
          readingLanguage,
          avatarKey,
        });
        const settled: LocalIdentity = {
          id: profile.id,
          meloId: profile.melo_id,
        };
        identityRef.current = settled;
        setState({ status: "ready", identity: settled });
        // A redrawn Melo ID means the id the user was about to share is stale.
        // The card re-renders from `settled`, so log it explicitly.
        if (settled.meloId !== identity.meloId) {
          log.warn(
            `Melo ID changed during creation: ${identity.meloId} → ${settled.meloId}`,
          );
        }
      } catch (error) {
        log.error(
          "the profile could not be created",
          {
            meloId: identity.meloId,
            shown:
              error instanceof Error && error.name === "MeloIdTakenError"
                ? "couldn't find a free id. try again."
                : "something went wrong. try again",
          },
          error,
        );
        setState({
          status: "failed",
          identity,
          message:
            error instanceof Error && error.name === "MeloIdTakenError"
              ? "couldn't find a free id. try again."
              : "Something went wrong. Try again.",
        });
      }
    },
    [create],
  );

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      // A profile can exist while the user is still finishing onboarding.
      const existing = await loadProfile();
      if (existing) {
        const draft = await loadDraft();
        if (cancelled) return;

        const changes: {
          displayName?: string;
          readingLanguage?: string;
          avatarKey?: string | null;
        } = {};
        if (draft?.displayName !== undefined)
          changes.displayName = draft.displayName;
        if (draft?.readingLanguage !== undefined)
          changes.readingLanguage = draft.readingLanguage;
        if (draft?.avatarKey !== undefined) changes.avatarKey = draft.avatarKey;

        let updated = existing;
        if (Object.keys(changes).length > 0) {
          try {
            updated = await updateRef.current(changes);
          } catch (error) {
            log.error(
              "unfinished onboarding profile could not be updated from its saved draft",
              error,
            );
            Alert.alert(
              "Couldn't save your latest changes",
              "Your saved profile is safe. You can continue and edit these details later.",
            );
          }
        }
        if (cancelled) return;
        const settled: LocalIdentity = {
          id: updated.id,
          meloId: updated.melo_id,
        };
        identityRef.current = settled;
        setState({ status: "ready", identity: settled });
        if (Object.keys(changes).length > 0) {
          log.info(
            "updated the unfinished onboarding profile from its saved draft",
          );
        }
        return;
      }

      // Order matters: the readable half of the Melo ID is derived from the
      // display name, so the draft has to be read before the identity is drawn.
      const draft = await loadDraft();
      if (cancelled) return;
      const displayName = draft?.displayName ?? "";
      draftRef.current = { ...draft };

      const identity = await loadOrCreateIdentity(displayName);
      if (cancelled) return;
      identityRef.current = identity;
      await save(identity);
    })();

    return () => {
      cancelled = true;
    };
  }, [save]);

  const onRetry = useCallback(() => {
    const identity = identityRef.current;
    if (identity) {
      log.info("user tapped retry on the profile card", {
        meloId: identity.meloId,
      });
      void save(identity);
    }
  }, [save]);

  const onShare = useCallback(async () => {
    if (state.status === "drafting") return;
    try {
      await Share.share({
        title: "Come chat with me on melo.",
        message: `Come chat with me on melo. i type in my language, you read it in yours. my melo id: ${state.identity.meloId}`,
      });
      log.info("user shared their Melo ID", { meloId: state.identity.meloId });
    } catch (error) {
      // A dismissed share sheet rejects on some platforms; that is not a fault.
      log.debug("the share sheet closed without sharing", {
        name: error instanceof Error ? error.name : typeof error,
      });
    }
  }, [state]);

  const onContinue = useCallback(async () => {
    try {
      await completeOnboarding();
      router.replace("/chats");
    } catch (error) {
      log.error("onboarding could not be marked complete", error);
      Alert.alert(
        "Couldn't finish setup",
        "Your profile is saved, but setup couldn't be completed. Please try again.",
      );
    }
  }, [completeOnboarding, router]);

  const identity = state.status === "drafting" ? null : state.identity;
  const saving = state.status === "drafting" || state.status === "saving";
  const failed = state.status === "failed";

  const cardBorder = failed
    ? colors.danger
    : isDark
      ? "rgba(255, 255, 255, 0.12)"
      : colors.border;

  return (
    <OnboardingScreen
      step={4}
      eyebrow="Your Melo ID"
      title="this is your melo id"
      subtitle="send it to your people. it's how they find you."
      onBack={() => router.back()}
      footer={
        failed ? (
          <Button
            label="Try again"
            icon="retry"
            onPress={onRetry}
            testID="retry"
          />
        ) : (
          <Button
            label="Next"
            onPress={() => void onContinue()}
            disabled={saving}
            testID="continue"
          />
        )
      }
      testID="id-screen"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.idWell,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {identity ? (
            <>
              <View
                style={[styles.idValue, { backgroundColor: colors.surface }]}
              >
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Melo ID
                </Text>
                <Text
                  accessibilityLabel={`Melo ID, ${identity.meloId.split("").join(" ")}`}
                  style={[
                    typography.mono,
                    styles.meloId,
                    { color: colors.textPrimary, fontFamily: fontFamily.mono },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {identity.meloId}
                </Text>
              </View>
              <CopyButton meloId={identity.meloId} compact />
            </>
          ) : (
            <View
              accessible
              accessibilityLabel="Creating your Melo ID"
              accessibilityLiveRegion="polite"
              style={styles.idPlaceholder}
            >
              <View style={styles.idPlaceholderText}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Melo ID
                </Text>
                <Text
                  style={[
                    typography.body,
                    styles.idPlaceholderLabel,
                    { color: colors.textPrimary },
                  ]}
                >
                  Creating your unique ID
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.cardStatus} accessibilityLiveRegion="polite">
          <View
            style={[
              styles.statusDot,
              { backgroundColor: failed ? colors.danger : colors.accent },
            ]}
          />
          <Text
            style={[
              typography.caption,
              { color: failed ? colors.danger : colors.textMuted },
            ]}
          >
            {failed
              ? "Your ID is ready"
              : saving
                ? identity
                  ? "Finishing your profile…"
                  : "Creating your ID…"
                : "Ready to share"}
          </Text>
        </View>

        {failed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.caption, styles.error, { color: colors.danger }]}
          >
            {state.status === "failed" ? state.message : ""}
          </Text>
        ) : null}
      </View>

      <View style={styles.share}>
        <Button
          label="Share my ID"
          icon="share"
          variant="surface"
          onPress={() => void onShare()}
          disabled={saving}
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderRadius: 24,
    borderCurve: "continuous",
    marginTop: 24,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeading: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  idMark: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeadingText: { flex: 1, gap: 3 },
  idWell: {
    width: "100%",
    minHeight: 76,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  idValue: { flex: 1, minWidth: 0, gap: 2 },
  idPlaceholder: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  idPlaceholderMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  idPlaceholderText: { flex: 1, gap: 2 },
  idPlaceholderLabel: { fontSize: 15, lineHeight: 20 },
  meloId: { fontSize: 16, letterSpacing: 1.5 },
  cardStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 18,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  error: { textAlign: "center" },
  share: { marginTop: 16 },
});
