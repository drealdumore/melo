import { StyleSheet, Text, View, Image } from "react-native";
import { useRouter } from "expo-router";
import Animated from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Button } from "@/components/ui/Button";
import { screenEnter, screenFadeEnter } from "@/theme/motion";

const WELCOME_MARK_ENTER = screenEnter();
const WELCOME_MARK_REDUCED_ENTER = screenFadeEnter();
const WELCOME_COPY_ENTER = screenEnter(60);
const WELCOME_COPY_REDUCED_ENTER = screenFadeEnter(60);
const WELCOME_FOOTER_ENTER = screenEnter(120);
const WELCOME_FOOTER_REDUCED_ENTER = screenFadeEnter(120);

export default function WelcomeScreen() {
  const { colors, typography, screenPadding, spacing, isDark } = useTheme();
  const { headerTop, footerBottom } = useScreenInsets();
  const router = useRouter();
  const reduced = useReducedMotion();

  const heroCardBorder = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.05)";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      <View
        style={[
          styles.container,
          {
            paddingTop: headerTop + spacing.xxxl,
            paddingBottom: footerBottom + spacing.xs,
            paddingHorizontal: screenPadding,
          },
        ]}
      >
        <View style={styles.center}>
          <Animated.View
            entering={reduced ? WELCOME_MARK_REDUCED_ENTER : WELCOME_MARK_ENTER}
            style={styles.badgeWrapper}
          >
            <View
              style={[
                styles.markBadge,
                {
                  backgroundColor: "transparent",
                  borderColor: heroCardBorder,
                },
              ]}
            >
              <Image
                source={require("../../../assets/splash-icon.png")}
                style={styles.splashIcon}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reduced ? WELCOME_COPY_REDUCED_ENTER : WELCOME_COPY_ENTER}
            style={styles.copy}
          >
            <Text
              accessibilityRole="header"
              style={[
                typography.hero,
                styles.titleText,
                { color: colors.textPrimary },
              ]}
            >
              Say it your way.{"\n"}They get it in theirs.
            </Text>
            <Text
              style={[
                typography.body,
                styles.tagline,
                { color: colors.textMuted },
              ]}
            >
              You type in your language. they read it in theirs. 
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          entering={reduced ? WELCOME_FOOTER_REDUCED_ENTER : WELCOME_FOOTER_ENTER}
          style={styles.footer}
        >
          <Button
            label="Let’s go"
            onPress={() => router.push("/onboarding/language")}
            testID="get-started"
          />

          <Button
            label="I have a melo id"
            onPress={() => router.push("/onboarding/recover")}
            variant="ghost"
            testID="recover"
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  badgeWrapper: { marginBottom: 12 },
  markBadge: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  splashIcon: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },
  copy: { alignItems: "center", marginTop: 24, paddingHorizontal: 16 },
  eyebrow: { textAlign: "center", letterSpacing: 0.8, marginBottom: 8 },
  titleText: {
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.8,
    textAlign: "center",
  },
  tagline: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 300,
  },
  footer: { width: "100%", gap: 14 },
  disclaimer: { textAlign: "center", fontSize: 12, opacity: 0.7 },
});
