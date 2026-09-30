import { useEffect } from "react";
import { StyleSheet, Text, View, Image } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Button } from "@/components/ui/Button";
import { AmbientGlow } from "@/components/ui/AmbientGlow";

export default function WelcomeScreen() {
  const { colors, typography, screenPadding, duration, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useReducedMotion();

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: duration.slow });
  }, [duration.slow, progress]);

  const markStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: progress.value }
      : {
          opacity: progress.value,
          transform: [{ scale: 0.88 + progress.value * 0.12 }],
        },
  );

  const heroCardBorder = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.05)";

  return (
    <View style={styles.root}>
      <AmbientGlow />

      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 48,
            paddingBottom: Math.max(insets.bottom, 20) + 12,
            paddingHorizontal: screenPadding,
          },
        ]}
      >
        <View style={styles.center}>
          <Animated.View style={[markStyle, styles.badgeWrapper]}>
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
            entering={FadeInUp.delay(120).duration(400)}
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
              Walk with Melo
            </Text>
            <Text
              style={[
                typography.body,
                styles.tagline,
                { color: colors.textMuted },
              ]}
            >
              Say it your way. Real-time translation, effortless connection.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeIn.delay(240).duration(300)}
          style={styles.footer}
        >
          <Button
            label="Get started"
            onPress={() => router.push("/onboarding/language")}
            testID="get-started"
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
